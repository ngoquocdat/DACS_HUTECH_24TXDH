const test = require("node:test");
const assert = require("node:assert/strict");
const { can, principalFromVerifiedGatewayEvent } = require("../dist/auth/principal");
const { handler } = require("../dist/handler");

const previous = process.env.COGNITO_CLIENT_ID;
process.env.COGNITO_CLIENT_ID = "uat-public-client";

function event({ method = "GET", path = "/orders", groups, sub = "user-1", tokenUse = "access", clientId = "uat-public-client" } = {}) {
  const claims = {
    sub, token_use: tokenUse, client_id: clientId,
    ...(groups === undefined ? {} : { "cognito:groups": groups }),
  };
  return {
    rawPath: path,
    requestContext: {
      http: { method, path },
      authorizer: { jwt: { claims, scopes: [] } },
    },
  };
}
test("rejects missing verified claims", async () => {
  const e = event();
  delete e.requestContext.authorizer;
  assert.equal((await handler(e)).statusCode, 401);
});
test("rejects ID tokens and mismatched client IDs", () => {
  assert.equal(principalFromVerifiedGatewayEvent(event({ tokenUse: "id" })), null);
  assert.equal(principalFromVerifiedGatewayEvent(event({ clientId: "another-app" })), null);
});
test("does not accept user-controlled Authorization or role headers", () => {
  const e = event();
  delete e.requestContext.authorizer;
  e.headers = { authorization: "Bearer fake", "x-role": "MANAGER" };
  assert.equal(principalFromVerifiedGatewayEvent(e), null);
});
test("customer receives no staff privilege", () => {
  const principal = principalFromVerifiedGatewayEvent(event());
  assert.deepEqual(principal.roles, ["CUSTOMER"]);
  assert.equal(can(principal, "order:status"), false);
  assert.equal(can(principal, "order:payment"), false);
  assert.equal(can(principal, "order:list"), false);
});
test("kitchen cannot confirm payment", async () => {
  const e = event({ method: "PATCH", path: "/orders/ORD-1/payment", groups: ["KITCHEN"] });
  assert.equal((await handler(e)).statusCode, 403);
});
test("cashier cannot update kitchen status", async () => {
  const e = event({ method: "PATCH", path: "/orders/ORD-1/status", groups: "CASHIER" });
  assert.equal((await handler(e)).statusCode, 403);
});
test("customer cannot read all orders", async () => {
  assert.equal((await handler(event())).statusCode, 403);
});
test("manager permissions are read, status and payment", () => {
  const p = principalFromVerifiedGatewayEvent(event({ groups: ["MANAGER"] }));
  assert.equal(can(p, "order:read-all"), true);
  assert.equal(can(p, "order:status"), true);
  assert.equal(can(p, "order:payment"), true);
});
test("unknown group grants no staff privileges", () => {
  const p = principalFromVerifiedGatewayEvent(event({ groups: ["ADMIN", "CUSTOMER"] }));
  assert.deepEqual(p.roles, ["CUSTOMER"]);
});
test("customer can read own order but not another user's order", async () => {
  const service = require("../dist/services/orderService").orderService;
  const original = service.getOrder;
  try {
    service.getOrder = async () => ({
      orderId: "ORD-1",
      ownerSub: "customer-owner",
      customerPhone: "0900000000",
      tableNumber: "A1",
      items: [], status: "PENDING", paymentStatus: "UNPAID", totalAmount: 0,
      createdAt: "2026-11-10T00:00:00.000Z", updatedAt: "2026-11-10T00:00:00.000Z",
    });
    const own = await handler(event({ path: "/orders/ORD-1", sub: "customer-owner" }));
    const other = await handler(event({ path: "/orders/ORD-1", sub: "customer-other" }));
    const manager = await handler(event({ path: "/orders/ORD-1", sub: "manager", groups: ["MANAGER"] }));
    assert.equal(own.statusCode, 200);
    assert.equal(other.statusCode, 404);
    assert.equal(manager.statusCode, 200);
  } finally {
    service.getOrder = original;
  }
});
test("legacy orders without ownerSub are staff only", async () => {
  const service = require("../dist/services/orderService").orderService;
  const original = service.getOrder;
  try {
    service.getOrder = async () => ({
      orderId: "ORD-LEGACY", customerPhone: "0900000000", tableNumber: "A1",
      items: [], status: "PENDING", paymentStatus: "UNPAID", totalAmount: 0,
      createdAt: "2026-11-10T00:00:00.000Z", updatedAt: "2026-11-10T00:00:00.000Z",
    });
    assert.equal((await handler(event({ path: "/orders/ORD-LEGACY" }))).statusCode, 404);
    assert.equal((await handler(event({ path: "/orders/ORD-LEGACY", groups: ["CASHIER"] }))).statusCode, 200);
  } finally {
    service.getOrder = original;
  }
});
test.after(() => {
  if (previous === undefined) delete process.env.COGNITO_CLIENT_ID;
  else process.env.COGNITO_CLIENT_ID = previous;
});
