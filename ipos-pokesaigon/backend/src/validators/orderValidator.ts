import { MENU } from "../constants/menu";
import { OrderStatus } from "../types/order";

const VALID_STATUSES: OrderStatus[] = ["PENDING", "PREPARING", "READY", "CANCELLED"];

export function validateCreateOrder(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Request body is required";
  const req = body as Record<string, unknown>;
  if (typeof req.tableNumber !== "string" || !req.tableNumber.trim() || req.tableNumber.length > 40) {
    return "tableNumber must be a non-empty string of at most 40 characters";
  }
  if (typeof req.customerPhone !== "string" || req.customerPhone.length > 30) {
    return "customerPhone must be a string of at most 30 characters";
  }
  const digits = req.customerPhone.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 11) return "customerPhone must be 9-11 digits";
  if (!Array.isArray(req.items) || req.items.length === 0 || req.items.length > 30 || req.items.length > 30) {
    return "items must contain 1-30 entries";
  }
  for (let i = 0; i < req.items.length; i++) {
    const raw: unknown = req.items[i];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return `items[${i}] must be an object`;
    const item = raw as Record<string, unknown>;
    for (const field of ["base", "protein", "sauce"] as const) {
      const values = MENU[field === "base" ? "bases" : field === "protein" ? "proteins" : "sauces"];
      if (typeof item[field] !== "string" || !Object.prototype.hasOwnProperty.call(values, item[field])) {
        return `items[${i}].${field} must be a valid menu option`;
      }
    }
    if (item.drink !== undefined &&
      (typeof item.drink !== "string" || !Object.prototype.hasOwnProperty.call(MENU.drinks, item.drink))) {
      return `items[${i}].drink must be a valid menu option`;
    }
    if (item.quantity !== undefined &&
      (typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || (item.quantity < 1 || item.quantity > 30) || item.quantity > 30)) {
      return `items[${i}].quantity must be between 1 and 30`;
    }
    if (item.note !== undefined && (typeof item.note !== "string" || item.note.length > 500)) {
      return `items[${i}].note must have at most 500 characters`;
    }
    if (item.toppings !== undefined) {
      if (!Array.isArray(item.toppings) || item.toppings.length > 15) {
        return `items[${i}].toppings must be an array of at most 15 entries`;
      }
      for (const topping of item.toppings) {
        if (typeof topping !== "string" || !Object.prototype.hasOwnProperty.call(MENU.toppings, topping)) {
          return `items[${i}].toppings contains an invalid option`;
        }
      }
    }
  }
  return null;
}

export function validateUpdateStatus(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Request body is required";
  const status = (body as Record<string, unknown>).status;
  if (!VALID_STATUSES.includes(status as OrderStatus)) {
    return `status must be one of: ${VALID_STATUSES.join(", ")}; use /payment to mark paid`;
  }
  return null;
}

export function validateUpdatePayment(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Request body is required";
  return (body as Record<string, unknown>).paymentStatus === "PAID"
    ? null : 'paymentStatus must be "PAID"';
}
