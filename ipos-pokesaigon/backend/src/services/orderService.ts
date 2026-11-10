import { randomUUID } from "crypto";
import {
  Order, OrderItem, OrderStatus, CreateOrderRequest, ListOrdersFilter,
} from "../types/order";
import { MENU, BASE_BOWL_PRICE } from "../constants/menu";
import { orderRepository } from "../repositories/orderRepository";

export const VALID_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: [], // Payment is reserved for cashier /payment endpoint.
  PAID: [],
  CANCELLED: [],
};

export class InvalidOrderTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOrderTransitionError";
  }
}

export function assertStatusTransition(current: OrderStatus, next: OrderStatus): void {
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    throw new InvalidOrderTransitionError(
      `Cannot transition from ${current} to ${next}. Allowed: ${allowed.join(", ") || "none"}`,
    );
  }
}

export function assertPaymentAllowed(order: Pick<Order, "status" | "paymentStatus">): void {
  // The existing application uses pay-after-ready. Prepayment requires
  // splitting fulfillment and payment state machines, not bypassing this guard.
  if (order.status !== "READY" || order.paymentStatus !== "UNPAID") {
    throw new InvalidOrderTransitionError(
      `Payment requires READY/UNPAID order, found ${order.status}/${order.paymentStatus}`,
    );
  }
}

export function generateOrderId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `ORD-${date}-${randomUUID()}`;
}

function calculateItemPrice(item: OrderItem): number {
  let price = BASE_BOWL_PRICE;
  price += MENU.bases[item.base as keyof typeof MENU.bases]?.price ?? 0;
  price += MENU.proteins[item.protein as keyof typeof MENU.proteins]?.price ?? 0;
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
    const items: OrderItem[] = request.items.map((raw) => ({
      base: raw.base, protein: raw.protein, toppings: raw.toppings ?? [],
      sauce: raw.sauce, drink: raw.drink ?? "water", quantity: raw.quantity ?? 1,
      note: raw.note,
    }));
    const totalAmount = items.reduce((sum, item) => sum + calculateItemPrice(item), 0);
    const order: Order = {
      orderId: generateOrderId(),
      tableNumber: request.tableNumber.trim(),
      customerPhone: request.customerPhone.trim(),
      items, status: "PENDING", paymentStatus: "UNPAID",
      totalAmount, createdAt: now, updatedAt: now,
    };
    await orderRepository.save(order);
    console.log(JSON.stringify({ event: "ORDER_CREATED", orderId: order.orderId, total: order.totalAmount }));
    return order;
  },

  async getOrder(orderId: string): Promise<Order | null> {
    return orderRepository.findById(orderId);
  },

  async listOrders(filters?: ListOrdersFilter): Promise<Order[]> {
    return orderRepository.findAll(filters);
  },

  async updateOrderStatus(orderId: string, newStatus: OrderStatus): Promise<Order | null> {
    const order = await orderRepository.findById(orderId);
    if (!order) return null;
    assertStatusTransition(order.status, newStatus);
    const updated = await orderRepository.updateStatus(orderId, order.status, newStatus);
    console.log(JSON.stringify({ event: "ORDER_STATUS_UPDATED", orderId, from: order.status, to: newStatus }));
    return updated;
  },

  async markOrderPaid(orderId: string): Promise<Order | null> {
    const order = await orderRepository.findById(orderId);
    if (!order) return null;
    assertPaymentAllowed(order);
    const updated = await orderRepository.markPaid(orderId);
    console.log(JSON.stringify({ event: "ORDER_PAID", orderId, total: order.totalAmount }));
    return updated;
  },
};
