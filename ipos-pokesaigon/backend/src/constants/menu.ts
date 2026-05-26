// Trusted menu constants — backend is source of truth for prices.// Frontend sends IDs; backend calculates totalAmount from these values.

export const BASE_BOWL_PRICE = 89000; // Base poke bowl price (VND)

export const MENU = {
	bases: {
		white_rice: { name: "Cơm trắng", price: 0 },
		brown_rice: { name: "Gạo lức", price: 5000 },
		quinoa: { name: "Quinoa", price: 15000 },
		half_rice_salad: { name: "1/2 cơm + salad", price: 10000 },
	},
	proteins: {
		salmon: { name: "Salmon", price: 45000 },
		tuna: { name: "Tuna", price: 40000 },
	},
	toppings: {
		avocado: { name: "Avocado", price: 15000 },
		corn: { name: "Corn", price: 5000 },
		seaweed: { name: "Seaweed", price: 5000 },
		edamame: { name: "Edamame", price: 10000 },
	},
	sauces: {
		spicy_mayo: { name: "Spicy Mayo", price: 0 },
		soy_sauce: { name: "Soy Sauce", price: 0 },
		sesame: { name: "Sesame Sauce", price: 0 },
	},
	drinks: {
		water: { name: "Water", price: 10000 },
		coke: { name: "Coke", price: 15000 },
		tea: { name: "Tea", price: 12000 },
	},
} as const;

export type BaseId = keyof typeof MENU.bases;
export type ProteinId = keyof typeof MENU.proteins;
export type ToppingId = keyof typeof MENU.toppings;
export type SauceId = keyof typeof MENU.sauces;
export type DrinkId = keyof typeof MENU.drinks;
