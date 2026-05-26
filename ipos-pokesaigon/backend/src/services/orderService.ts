import {
	Order,
	OrderItem,
	OrderStatus,
	CreateOrderRequest,
	ListOrdersFilter,
} from "../types/order";
import { MENU, BASE_BOWL_PRICE } from "../constants/menu";
import { orderRepository } from "../repositories/orderRepository";

// Valid status transitions — prevents invalid state changes
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
	PENDING: ["PREPARING", "CANCELLED"],
	PREPARING: ["READY", "CANCELLED"],
	READY: ["PAID"],
	PAID: [],
	CANCELLED: [],
};

/**
 * Generates a human-readable orderId: ORD-YYYYMMDD-XXXX
 */
function generateOrderId(): string {
	const now = new Date();
	const date = now.toISOString().slice(0, 10).replace(/-/g, "");
	const rand = String(Math.floor(Math.random() * 9000) + 1000);
	return `ORD-${date}-${rand}`;
}

/**
 * Calculates the price of a single order item using trusted backend prices.
 * Frontend price values are ignored — only IDs are used.
 */
function calculateItemPrice(item: OrderItem): number {
	let price = BASE_BOWL_PRICE;

	price += MENU.bases[item.base as keyof typeof MENU.bases]?.price ?? 0;
	price +=
		MENU.proteins[item.protein as keyof typeof MENU.proteins]?.price ?? 0;

	for (const toppingId of item.toppings) {
		price += MENU.toppings[toppingId as keyof typeof MENU.toppings]?.price ?? 0;
	}

	price += MENU.sauces[item.sauce as keyof typeof MENU.sauces]?.price ?? 0;
	price += MENU.drinks[item.drink as keyof typeof MENU.drinks]?.price ?? 0;

	return price * item.quantity;
}

export const orderService = {
	async createOrder(request: CreateOrderRequest): Promise<Order> {
		const now = new Date().toISOString();
		const orderId = generateOrderId();

		// Normalise items — apply defaults for optional fields
		const items: OrderItem[] = request.items.map((raw) => ({
			base: raw.base,
			protein: raw.protein,
			toppings: raw.toppings ?? [],
			sauce: raw.sauce,
			drink: raw.drink ?? "water",
			quantity: raw.quantity ?? 1,
			note: raw.note,
		}));

		const totalAmount = items.reduce(
			(sum, item) => sum + calculateItemPrice(item),
			0,
		);

		const order: Order = {
			orderId,
			tableNumber: request.tableNumber.trim(),
			customerPhone: request.customerPhone.trim(),
			items,
			status: "PENDING",
			paymentStatus: "UNPAID",
			totalAmount,
			createdAt: now,
			updatedAt: now,
		};

		await orderRepository.save(order);

		console.log(
			JSON.stringify({
				event: "ORDER_CREATED",
				orderId: order.orderId,
				table: order.tableNumber,
				total: order.totalAmount,
			}),
		);

		return order;
	},

	async getOrder(orderId: string): Promise<Order | null> {
		return orderRepository.findById(orderId);
	},

	async listOrders(filters?: ListOrdersFilter): Promise<Order[]> {
		return orderRepository.findAll(filters);
	},

	async updateOrderStatus(
		orderId: string,
		newStatus: OrderStatus,
	): Promise<Order | null> {
		const order = await orderRepository.findById(orderId);
		if (!order) return null;

		const allowed = VALID_TRANSITIONS[order.status];
		if (!allowed.includes(newStatus)) {
			throw new Error(
				`INVALID_STATUS: Cannot transition from ${order.status} to ${newStatus}. Allowed: ${allowed.join(", ") || "none"}`,
			);
		}

		const updated = await orderRepository.updateStatus(orderId, newStatus);

		console.log(
			JSON.stringify({
				event: "ORDER_STATUS_UPDATED",
				orderId,
				from: order.status,
				to: newStatus,
			}),
		);

		return updated;
	},

	async markOrderPaid(orderId: string): Promise<Order | null> {
		const order = await orderRepository.findById(orderId);
		if (!order) return null;

		const updated = await orderRepository.markPaid(orderId);

		console.log(
			JSON.stringify({
				event: "ORDER_PAID",
				orderId,
				table: order.tableNumber,
				total: order.totalAmount,
			}),
		);

		return updated;
	},
};
