// Menu constants for the frontend UI.// IDs must match the backend constants/menu.ts keys.

export const BASE_BOWL_PRICE = 89000;

export const POKE_MENU = {
	bases: [
		{ id: "white_rice", name: "Cơm trắng", price: 0 },
		{ id: "brown_rice", name: "Gạo lức", price: 5000 },
		{ id: "quinoa", name: "Quinoa", price: 15000 },
		{ id: "half_rice_salad", name: "1/2 cơm + salad", price: 10000 },
	],
	proteins: [
		{ id: "salmon", name: "Salmon", price: 45000 },
		{ id: "tuna", name: "Tuna", price: 40000 },
	],
	toppings: [
		{ id: "avocado", name: "Avocado", price: 15000 },
		{ id: "corn", name: "Corn", price: 5000 },
		{ id: "seaweed", name: "Seaweed", price: 5000 },
		{ id: "edamame", name: "Edamame", price: 10000 },
	],
	sauces: [
		{ id: "spicy_mayo", name: "Spicy Mayo", price: 0 },
		{ id: "soy_sauce", name: "Soy Sauce", price: 0 },
		{ id: "sesame", name: "Sesame Sauce", price: 0 },
	],
	drinks: [
		{ id: "water", name: "Water", price: 10000 },
		{ id: "coke", name: "Coke", price: 15000 },
		{ id: "tea", name: "Tea", price: 12000 },
	],
} as const;

export const STATUS_LABELS: Record<string, string> = {
	PENDING: "Chờ xác nhận",
	PREPARING: "Đang làm",
	READY: "Sẵn sàng",
	PAID: "Đã thanh toán",
	CANCELLED: "Đã hủy",
};

export const STATUS_COLORS: Record<string, string> = {
	PENDING: "#f59e0b",
	PREPARING: "#3b82f6",
	READY: "#10b981",
	PAID: "#6b7280",
	CANCELLED: "#ef4444",
};

export function formatPrice(price: number): string {
	return `${price.toLocaleString("vi-VN")}đ`;
}
