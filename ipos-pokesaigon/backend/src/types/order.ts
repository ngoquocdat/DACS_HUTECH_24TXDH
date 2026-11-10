// Order domain types shared between routes, services, and repositories
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
  ownerSub?: string; // legacy orders have no owner and remain staff-only
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

export interface UpdateStatusRequest {
	status: OrderStatus;
}

export interface UpdatePaymentRequest {
	paymentStatus: "PAID";
}

export interface ListOrdersFilter {
	status?: string;
	tableNumber?: string;
	customerPhone?: string;
}

export interface ErrorBody {
	error: {
		code: string;
		message: string;
	};
}
