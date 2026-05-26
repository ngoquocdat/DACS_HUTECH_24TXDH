import { MENU } from "../constants/menu";
import { CreateOrderRequest, OrderStatus } from "../types/order";

const VALID_STATUSES: OrderStatus[] = [
	"PENDING",
	"PREPARING",
	"READY",
	"PAID",
	"CANCELLED",
];

/**
 * Validates a create-order request body.
 * Returns an error message string, or null if valid.
 */
export function validateCreateOrder(body: unknown): string | null {
	if (!body || typeof body !== "object") {
		return "Request body is required";
	}

	const req = body as Record<string, unknown>;

	if (
		!req.tableNumber ||
		typeof req.tableNumber !== "string" ||
		req.tableNumber.trim() === ""
	) {
		return "tableNumber is required";
	}

	if (!req.customerPhone || typeof req.customerPhone !== "string") {
		return "customerPhone is required";
	}
	const phoneDigits = req.customerPhone.replace(/\D/g, "");
	if (phoneDigits.length < 9 || phoneDigits.length > 11) {
		return "customerPhone must be 9–11 digits";
	}

	if (!req.items || !Array.isArray(req.items) || req.items.length === 0) {
		return "items must be a non-empty array";
	}

	for (let i = 0; i < req.items.length; i++) {
		const item = req.items[i] as Record<string, unknown>;

		if (!item.base || !Object.keys(MENU.bases).includes(item.base as string)) {
			return `items[${i}].base must be one of: ${Object.keys(MENU.bases).join(", ")}`;
		}

		if (
			!item.protein ||
			!Object.keys(MENU.proteins).includes(item.protein as string)
		) {
			return `items[${i}].protein must be one of: ${Object.keys(MENU.proteins).join(", ")}`;
		}

		if (
			!item.sauce ||
			!Object.keys(MENU.sauces).includes(item.sauce as string)
		) {
			return `items[${i}].sauce must be one of: ${Object.keys(MENU.sauces).join(", ")}`;
		}

		if (
			item.drink !== undefined &&
			!Object.keys(MENU.drinks).includes(item.drink as string)
		) {
			return `items[${i}].drink must be one of: ${Object.keys(MENU.drinks).join(", ")}`;
		}

		if (item.quantity !== undefined) {
			if (
				typeof item.quantity !== "number" ||
				!Number.isInteger(item.quantity) ||
				item.quantity < 1
			) {
				return `items[${i}].quantity must be an integer greater than 0`;
			}
		}

		if (item.toppings !== undefined) {
			if (!Array.isArray(item.toppings)) {
				return `items[${i}].toppings must be an array`;
			}
			for (const topping of item.toppings as unknown[]) {
				if (!Object.keys(MENU.toppings).includes(topping as string)) {
					return `items[${i}].toppings contains invalid value: ${topping}. Valid: ${Object.keys(MENU.toppings).join(", ")}`;
				}
			}
		}
	}

	return null;
}

/**
 * Validates an update-status request body.
 */
export function validateUpdateStatus(body: unknown): string | null {
	if (!body || typeof body !== "object") {
		return "Request body is required";
	}
	const req = body as Record<string, unknown>;
	if (!req.status || !VALID_STATUSES.includes(req.status as OrderStatus)) {
		return `status must be one of: ${VALID_STATUSES.join(", ")}`;
	}
	return null;
}

/**
 * Validates an update-payment request body.
 */
export function validateUpdatePayment(body: unknown): string | null {
	if (!body || typeof body !== "object") {
		return "Request body is required";
	}
	const req = body as Record<string, unknown>;
	if (req.paymentStatus !== "PAID") {
		return 'paymentStatus must be "PAID"';
	}
	return null;
}
