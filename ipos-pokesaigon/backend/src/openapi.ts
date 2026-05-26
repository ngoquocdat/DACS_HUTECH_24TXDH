// OpenAPI 3.0 spec for iPOS Pokesaigon API// Used only by the local dev Swagger UI — not deployed to AWS.

export const openApiSpec = {
	openapi: "3.0.3",
	info: {
		title: "iPOS Pokesaigon API",
		description:
			"REST API for the Pokesaigon poke bowl ordering system.\n\nAWS Architecture: **API Gateway → Lambda → DynamoDB**",
		version: "1.0.0",
	},
	servers: [
		{
			url: `http://localhost:${process.env.PORT || 5681}`,
			description: "Local dev server",
		},
	],
	tags: [{ name: "Orders", description: "Order management" }],
	paths: {
		"/orders": {
			post: {
				tags: ["Orders"],
				summary: "Create a new order",
				description:
					"Customer/staff submits a poke bowl order. Backend calculates totalAmount from trusted menu constants.",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/CreateOrderRequest" },
							example: {
								tableNumber: "A01",
								customerPhone: "0901234567",
								items: [
									{
										base: "brown_rice",
										protein: "salmon",
										toppings: ["avocado", "corn"],
										sauce: "spicy_mayo",
										drink: "coke",
										quantity: 1,
										note: "less sauce",
									},
								],
							},
						},
					},
				},
				responses: {
					"201": {
						description: "Order created successfully",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/CreateOrderResponse" },
							},
						},
					},
					"400": { $ref: "#/components/responses/ValidationError" },
					"500": { $ref: "#/components/responses/InternalError" },
				},
			},
			get: {
				tags: ["Orders"],
				summary: "List orders",
				description:
					"Returns all orders. Use query params to filter. Kitchen uses `?status=PENDING`, cashier uses `?tableNumber=` or `?customerPhone=`.",
				parameters: [
					{
						name: "status",
						in: "query",
						description: "Filter by order status",
						schema: { $ref: "#/components/schemas/OrderStatus" },
					},
					{
						name: "tableNumber",
						in: "query",
						description: "Filter by table number",
						schema: { type: "string", example: "A01" },
					},
					{
						name: "customerPhone",
						in: "query",
						description: "Filter by customer phone number",
						schema: { type: "string", example: "0901234567" },
					},
				],
				responses: {
					"200": {
						description: "List of orders",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										items: {
											type: "array",
											items: { $ref: "#/components/schemas/Order" },
										},
									},
								},
							},
						},
					},
					"500": { $ref: "#/components/responses/InternalError" },
				},
			},
		},

		"/orders/{orderId}": {
			get: {
				tags: ["Orders"],
				summary: "Get order by ID",
				parameters: [{ $ref: "#/components/parameters/orderId" }],
				responses: {
					"200": {
						description: "Order detail",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Order" },
							},
						},
					},
					"404": { $ref: "#/components/responses/NotFound" },
				},
			},
		},

		"/orders/{orderId}/status": {
			patch: {
				tags: ["Orders"],
				summary: "Update order status",
				description:
					"Valid transitions: PENDING→PREPARING, PREPARING→READY, READY→PAID, PENDING/PREPARING→CANCELLED.",
				parameters: [{ $ref: "#/components/parameters/orderId" }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["status"],
								properties: {
									status: { $ref: "#/components/schemas/OrderStatus" },
								},
							},
							example: { status: "PREPARING" },
						},
					},
				},
				responses: {
					"200": {
						description: "Status updated",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										orderId: { type: "string" },
										status: { $ref: "#/components/schemas/OrderStatus" },
										message: { type: "string" },
									},
								},
							},
						},
					},
					"400": { $ref: "#/components/responses/ValidationError" },
					"404": { $ref: "#/components/responses/NotFound" },
				},
			},
		},

		"/orders/{orderId}/payment": {
			patch: {
				tags: ["Orders"],
				summary: "Mark order as paid",
				description:
					"Cashier confirms payment. Sets both paymentStatus and status to PAID.",
				parameters: [{ $ref: "#/components/parameters/orderId" }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["paymentStatus"],
								properties: {
									paymentStatus: { type: "string", enum: ["PAID"] },
								},
							},
							example: { paymentStatus: "PAID" },
						},
					},
				},
				responses: {
					"200": {
						description: "Payment confirmed",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										orderId: { type: "string" },
										paymentStatus: { type: "string" },
										status: { $ref: "#/components/schemas/OrderStatus" },
										message: { type: "string" },
									},
								},
							},
						},
					},
					"400": { $ref: "#/components/responses/ValidationError" },
					"404": { $ref: "#/components/responses/NotFound" },
				},
			},
		},
	},

	components: {
		parameters: {
			orderId: {
				name: "orderId",
				in: "path",
				required: true,
				description: "Order ID",
				schema: { type: "string", example: "ORD-20260519-1234" },
			},
		},
		schemas: {
			OrderStatus: {
				type: "string",
				enum: ["PENDING", "PREPARING", "READY", "PAID", "CANCELLED"],
				description: "Current status of the order",
			},
			OrderItem: {
				type: "object",
				required: ["base", "protein", "sauce"],
				properties: {
					base: {
						type: "string",
						enum: ["white_rice", "brown_rice", "quinoa", "half_rice_salad"],
					},
					protein: { type: "string", enum: ["salmon", "tuna"] },
					toppings: {
						type: "array",
						items: {
							type: "string",
							enum: ["avocado", "corn", "seaweed", "edamame"],
						},
					},
					sauce: {
						type: "string",
						enum: ["spicy_mayo", "soy_sauce", "sesame"],
					},
					drink: { type: "string", enum: ["water", "coke", "tea"] },
					quantity: { type: "integer", minimum: 1, default: 1 },
					note: { type: "string", example: "less sauce" },
				},
			},
			Order: {
				type: "object",
				properties: {
					orderId: { type: "string", example: "ORD-20260519-1234" },
					tableNumber: { type: "string", example: "A01" },
					customerPhone: { type: "string", example: "0901234567" },
					items: {
						type: "array",
						items: { $ref: "#/components/schemas/OrderItem" },
					},
					status: { $ref: "#/components/schemas/OrderStatus" },
					paymentStatus: { type: "string", enum: ["UNPAID", "PAID"] },
					totalAmount: {
						type: "integer",
						example: 159000,
						description: "Total in VND, calculated by backend",
					},
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			CreateOrderRequest: {
				type: "object",
				required: ["tableNumber", "customerPhone", "items"],
				properties: {
					tableNumber: { type: "string", example: "A01" },
					customerPhone: {
						type: "string",
						example: "0901234567",
						description: "9–11 digits",
					},
					items: {
						type: "array",
						minItems: 1,
						items: { $ref: "#/components/schemas/OrderItem" },
					},
				},
			},
			CreateOrderResponse: {
				type: "object",
				properties: {
					orderId: { type: "string", example: "ORD-20260519-1234" },
					status: { $ref: "#/components/schemas/OrderStatus" },
					message: { type: "string", example: "Order created successfully" },
				},
			},
			ErrorResponse: {
				type: "object",
				properties: {
					error: {
						type: "object",
						properties: {
							code: { type: "string", example: "VALIDATION_ERROR" },
							message: { type: "string", example: "customerPhone is required" },
						},
					},
				},
			},
		},
		responses: {
			ValidationError: {
				description: "Validation error",
				content: {
					"application/json": {
						schema: { $ref: "#/components/schemas/ErrorResponse" },
					},
				},
			},
			NotFound: {
				description: "Order not found",
				content: {
					"application/json": {
						schema: { $ref: "#/components/schemas/ErrorResponse" },
					},
				},
			},
			InternalError: {
				description: "Internal server error",
				content: {
					"application/json": {
						schema: { $ref: "#/components/schemas/ErrorResponse" },
					},
				},
			},
		},
	},
};
