export type OrderStatus =
	| "PENDING"
	| "PREPARING"
	| "READY"
	| "PAID"
	| "CANCELLED";
export type PaymentStatus = "UNPAID" | "PAID";

export interface OrderItem {
	base: string;
	protein: string;
	toppings: string[];
	sauce: string;
	drink: string;
	quantity: number;
	note?: string;
}

export interface Order {
	orderId: string;
	tableNumber: string;
	customerPhone: string;
	items: OrderItem[];
	status: OrderStatus;
	paymentStatus: PaymentStatus;
	totalAmount: number;
	createdAt: string;
	updatedAt: string;
}

export interface CreateOrderRequest {
	tableNumber: string;
	customerPhone: string;
	items: Array<{
		base: string;
		protein: string;
		toppings?: string[];
		sauce: string;
		drink?: string;
		quantity?: number;
		note?: string;
	}>;
}

export interface CreateOrderResponse {
	orderId: string;
	status: OrderStatus;
	message: string;
}

export interface ListOrdersResponse {
	items: Order[];
}
