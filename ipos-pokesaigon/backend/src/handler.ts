import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { orderService, InvalidOrderTransitionError } from "./services/orderService";
import { can, principalFromVerifiedGatewayEvent } from "./auth/principal";
import {
	validateCreateOrder,
	validateUpdateStatus,
	validateUpdatePayment,
} from "./validators/orderValidator";

// ─── Helpers ────────────────────────────────────────────────────────────────

const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

const corsHeaders: Record<string, string> = {
	"Content-Type": "application/json",
	"Access-Control-Allow-Origin": CORS_ORIGIN,
	"Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function ok(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
	return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
}

function err(
	statusCode: number,
	code: string,
	message: string,
): APIGatewayProxyResultV2 {
	return {
		statusCode,
		headers: corsHeaders,
		body: JSON.stringify({ error: { code, message } }),
	};
}

function parseBody(raw: string | null | undefined): unknown {
	if (!raw) return {};
	try {
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

// ─── Main handler ────────────────────────────────────────────────────────────

export const handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	const method = event.requestContext.http.method;
	const path = event.rawPath ?? "/";

	// Log every incoming request (visible in CloudWatch)
	console.log(
		JSON.stringify({
			method,
			path,
			query: event.queryStringParameters,
			pathParams: event.pathParameters,
		}),
	);

	// CORS preflight
	if (method === "OPTIONS") {
		return { statusCode: 204, headers: corsHeaders, body: "" };
	}

	// The API Gateway authorizer is mandatory in SAM. Reject direct invocations without
  // verified authorizer context too; never trust a user-supplied role header.
  const principal = principalFromVerifiedGatewayEvent(event);
  if (!principal) return err(401, "UNAUTHORIZED", "Valid Cognito access token required");

  // Parse path segments, e.g. /orders/ORD-123/status → ['orders', 'ORD-123', 'status']
	const segments = path.split("/").filter(Boolean);

	try {
		// ── POST /orders ────────────────────────────────────────────────────────
		if (method === "POST" && path === "/orders") {
      if (!can(principal, "order:create")) return err(403, "FORBIDDEN", "Insufficient role");
			const body = parseBody(event.body);
			const validationError = validateCreateOrder(body);
			if (validationError) return err(400, "VALIDATION_ERROR", validationError);

			const order = await orderService.createOrder(
				body as Parameters<typeof orderService.createOrder>[0],
        principal.sub,
			);

			// Optional: publish SNS notification when a new order is created
			await publishNewOrderNotification(
				order.orderId,
				order.tableNumber,
				order.totalAmount,
			);

			return ok(201, {
				orderId: order.orderId,
				status: order.status,
				message: "Order created successfully",
			});
		}

		// ── GET /orders ─────────────────────────────────────────────────────────
		if (method === "GET" && path === "/orders") {
      if (!can(principal, "order:list")) return err(403, "FORBIDDEN", "Staff role required");
			const qs = event.queryStringParameters ?? {};
			const orders = await orderService.listOrders({
				status: qs.status,
				tableNumber: qs.tableNumber,
				customerPhone: qs.customerPhone,
			});
			return ok(200, { items: orders });
		}

		// ── GET /orders/{orderId} ────────────────────────────────────────────────
		if (method === "GET" && segments.length === 2 && segments[0] === "orders") {
			const orderId = segments[1];
			const order = await orderService.getOrder(orderId);
			if (!order)
				return err(404, "ORDER_NOT_FOUND", `Order ${orderId} not found`);
      if (!can(principal, "order:read-all") && order.ownerSub !== principal.sub) {
        return err(404, "ORDER_NOT_FOUND", "Order not found");
      }
			return ok(200, order);
		}

		// ── PATCH /orders/{orderId}/status ───────────────────────────────────────
		if (
			method === "PATCH" &&
			segments.length === 3 &&
			segments[0] === "orders" &&
			segments[2] === "status"
		) {
      if (!can(principal, "order:status")) return err(403, "FORBIDDEN", "Kitchen or manager role required");
			const orderId = segments[1];
			const body = parseBody(event.body);
			const validationError = validateUpdateStatus(body);
			if (validationError) return err(400, "VALIDATION_ERROR", validationError);

			const updated = await orderService.updateOrderStatus(
				orderId,
				(body as Record<string, string>)
					.status as import("./types/order").OrderStatus,
			);
			if (!updated)
				return err(404, "ORDER_NOT_FOUND", `Order ${orderId} not found`);
			return ok(200, {
				orderId: updated.orderId,
				status: updated.status,
				message: "Status updated",
			});
		}

		// ── PATCH /orders/{orderId}/payment ──────────────────────────────────────
		if (
			method === "PATCH" &&
			segments.length === 3 &&
			segments[0] === "orders" &&
			segments[2] === "payment"
		) {
      if (!can(principal, "order:payment")) return err(403, "FORBIDDEN", "Cashier or manager role required");
			const orderId = segments[1];
			const body = parseBody(event.body);
			const validationError = validateUpdatePayment(body);
			if (validationError) return err(400, "VALIDATION_ERROR", validationError);

			const updated = await orderService.markOrderPaid(orderId);
			if (!updated)
				return err(404, "ORDER_NOT_FOUND", `Order ${orderId} not found`);
			return ok(200, {
				orderId: updated.orderId,
				paymentStatus: updated.paymentStatus,
				status: updated.status,
				message: "Payment confirmed",
			});
		}

		return err(404, "NOT_FOUND", `Route ${method} ${path} not found`);
	} catch (e) {
		const message = e instanceof Error ? e.message : "Unknown error";

		// Known business logic error
		if (e instanceof InvalidOrderTransitionError) {
      return err(409, "INVALID_STATUS", message);
    }

		if (message.startsWith("ORDER_CONFLICT:")) {
      return err(409, "ORDER_CONFLICT", "Order changed; refresh and retry");
    }

		if (message.startsWith("INVALID_STATUS:")) {
			return err(
				409,
				"INVALID_STATUS",
				message.replace("INVALID_STATUS: ", ""),
			);
		}

		console.error("Unhandled error:", e);
		return err(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred");
	}
};

// ─── Optional SNS notification ────────────────────────────────────────────────

async function publishNewOrderNotification(
	orderId: string,
	tableNumber: string,
	totalAmount: number,
): Promise<void> {
	const topicArn = process.env.SNS_NEW_ORDER_TOPIC_ARN;
	if (!topicArn) return; // SNS disabled — skip silently

	try {
		const { SNSClient, PublishCommand } = await import("@aws-sdk/client-sns");
		const snsClient = new SNSClient({
			region: process.env.AWS_REGION || "ap-southeast-1",
		});

		await snsClient.send(
			new PublishCommand({
				TopicArn: topicArn,
				Subject: `New Order — Table ${tableNumber}`,
				Message: [
					`New poke bowl order received!`,
					`Order ID  : ${orderId}`,
					`Table     : ${tableNumber}`,
					`Total     : ${totalAmount.toLocaleString("vi-VN")} VND`,
					`Status    : PENDING`,
					``,
					`Check kitchen board for details.`,
				].join("\n"),
			}),
		);

		console.log(JSON.stringify({ event: "SNS_PUBLISHED", orderId }));
	} catch (snsErr) {
		// Non-critical — log but do not fail the order creation
		console.error("SNS publish failed:", snsErr);
	}
}
