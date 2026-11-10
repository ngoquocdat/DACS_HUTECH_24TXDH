import {	DynamoDBDocumentClient,
	PutCommand,
	GetCommand,
	UpdateCommand,
	ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import {
	ConditionalCheckFailedException,
	DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import { Order, OrderStatus, ListOrdersFilter } from "../types/order";

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "PokesaigonOrders";

const clientConfig = process.env.DYNAMODB_ENDPOINT
	? {
			region: process.env.AWS_REGION || "ap-southeast-1",
			endpoint: process.env.DYNAMODB_ENDPOINT,
		}
	: { region: process.env.AWS_REGION || "ap-southeast-1" };

const dynamoClient = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
	marshallOptions: { removeUndefinedValues: true },
});

export const orderRepository = {
	/**
	 * Saves a new order to DynamoDB. Overwrites if orderId already exists (safe for create flow).
	 */
	async save(order: Order): Promise<Order> {
		await docClient.send(
			new PutCommand({
				TableName: TABLE_NAME,
				Item: order,
				ConditionExpression: "attribute_not_exists(orderId)",
			}),
		);
		return order;
	},

	/**
	 * Gets a single order by orderId. Returns null if not found.
	 */
	async findById(orderId: string): Promise<Order | null> {
		const result = await docClient.send(
			new GetCommand({
				TableName: TABLE_NAME,
				Key: { orderId },
				ConsistentRead: true,
			}),
		);
		return (result.Item as Order) ?? null;
	},

	/**
	 * Scans all orders and applies optional in-memory filters.
	 * For demo scale this is fine. Production would use GSI + Query.
	 */
	async findAll(filters?: ListOrdersFilter): Promise<Order[]> {
		const all: Order[] = [];
    let cursor: Record<string, unknown> | undefined;
    do {
      const result = await docClient.send(new ScanCommand({
        TableName: TABLE_NAME, ExclusiveStartKey: cursor,
      }));
      all.push(...((result.Items as Order[]) ?? []));
      cursor = result.LastEvaluatedKey;
    } while (cursor);
    let items = all;

		if (filters?.status) {
			items = items.filter((item) => item.status === filters.status);
		}
		if (filters?.tableNumber) {
			items = items.filter((item) => item.tableNumber === filters.tableNumber);
		}
		if (filters?.customerPhone) {
			items = items.filter(
				(item) => item.customerPhone === filters.customerPhone,
			);
		}

		items.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);

		return items;
	},

	/**
	 * Updates the status of an existing order. Throws if order does not exist.
	 */
	async updateStatus(
		orderId: string,
		expectedStatus: OrderStatus,
    status: OrderStatus,
	): Promise<Order | null> {
		const now = new Date().toISOString();
		try {
			const result = await docClient.send(
				new UpdateCommand({
					TableName: TABLE_NAME,
					Key: { orderId },
					UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
					ExpressionAttributeNames: { "#status": "status" },
					ExpressionAttributeValues: { ":status": status, ":expected": expectedStatus, ":unpaid": "UNPAID", ":updatedAt": now },
					ConditionExpression: "attribute_exists(orderId) AND #status = :expected AND paymentStatus = :unpaid",
					ReturnValues: "ALL_NEW",
				}),
			);
			return (result.Attributes as Order) ?? null;
		} catch (err) {
			if (err instanceof ConditionalCheckFailedException) throw new Error("ORDER_CONFLICT: Order changed; refresh and retry");
			throw err;
		}
	},

	/**
	 * Marks an order as PAID (both paymentStatus and status fields).
	 */
	async markPaid(orderId: string): Promise<Order | null> {
		const now = new Date().toISOString();
		try {
			const result = await docClient.send(
				new UpdateCommand({
					TableName: TABLE_NAME,
					Key: { orderId },
					UpdateExpression:
						"SET paymentStatus = :paymentStatus, #status = :status, updatedAt = :updatedAt",
					ExpressionAttributeNames: { "#status": "status" },
					ExpressionAttributeValues: {
						":paymentStatus": "PAID",
						":ready": "READY",
						":unpaid": "UNPAID",
						":status": "PAID",
						":updatedAt": now,
					},
					ConditionExpression: "attribute_exists(orderId) AND #status = :ready AND paymentStatus = :unpaid",
					ReturnValues: "ALL_NEW",
				}),
			);
			return (result.Attributes as Order) ?? null;
		} catch (err) {
			if (err instanceof ConditionalCheckFailedException) throw new Error("ORDER_CONFLICT: Order changed; refresh and retry");
			throw err;
		}
	},
};
