import type {	CreateOrderRequest,
	CreateOrderResponse,
	Order,
	ListOrdersResponse,
	OrderStatus,
} from "../types/order";

// Vite exposes env vars via import.meta.env.VITE_*
// Set VITE_API_BASE_URL in frontend/.env (copy from .env.example)
const BASE_URL =
	(import.meta.env.VITE_API_BASE_URL as string | undefined) ??
	"http://localhost:3000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${BASE_URL}${path}`, {
		headers: { "Content-Type": "application/json" },
		...init,
	});

	const data = await response.json();

	if (!response.ok) {
		const message: string =
			(data as { error?: { message?: string } })?.error?.message ??
			`HTTP ${response.status}`;
		throw new Error(message);
	}

	return data as T;
}

export function createOrder(
	body: CreateOrderRequest,
): Promise<CreateOrderResponse> {
	return request<CreateOrderResponse>("/orders", {
		method: "POST",
		body: JSON.stringify(body),
	});
}

export function getOrder(orderId: string): Promise<Order> {
	return request<Order>(`/orders/${orderId}`);
}

export function listOrders(params?: {
	status?: string;
	tableNumber?: string;
	customerPhone?: string;
}): Promise<ListOrdersResponse> {
	const qs = new URLSearchParams();
	if (params?.status) qs.set("status", params.status);
	if (params?.tableNumber) qs.set("tableNumber", params.tableNumber);
	if (params?.customerPhone) qs.set("customerPhone", params.customerPhone);
	const query = qs.toString() ? `?${qs.toString()}` : "";
	return request<ListOrdersResponse>(`/orders${query}`);
}

export function updateOrderStatus(
	orderId: string,
	status: OrderStatus,
): Promise<{ orderId: string; status: OrderStatus; message: string }> {
	return request(`/orders/${orderId}/status`, {
		method: "PATCH",
		body: JSON.stringify({ status }),
	});
}

export function markOrderPaid(
	orderId: string,
): Promise<{
	orderId: string;
	paymentStatus: string;
	status: OrderStatus;
	message: string;
}> {
	return request(`/orders/${orderId}/payment`, {
		method: "PATCH",
		body: JSON.stringify({ paymentStatus: "PAID" }),
	});
}
