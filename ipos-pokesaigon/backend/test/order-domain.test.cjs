const test = require("node:test");
const assert = require("node:assert/strict");
const { validateCreateOrder, validateUpdateStatus, validateUpdatePayment } = require("../dist/validators/orderValidator");
const { generateOrderId, assertStatusTransition, assertPaymentAllowed, InvalidOrderTransitionError } = require("../dist/services/orderService");

const valid = () => ({
  tableNumber: "T01",
  customerPhone: "0912345678",
  items: [{ base: "white_rice", protein: "salmon", sauce: "soy_sauce", quantity: 1 }],
});

test("valid order input", () => assert.equal(validateCreateOrder(valid()), null));
test("rejects missing and oversized item lists", () => {
  assert.ok(validateCreateOrder({ ...valid(), items: [] }));
  assert.ok(validateCreateOrder({ ...valid(), items: Array(31).fill(valid().items[0]) }));
});
test("rejects malformed item and excessive quantities", () => {
  assert.ok(validateCreateOrder({ ...valid(), items: [null] }));
  assert.ok(validateCreateOrder({ ...valid(), items: [{ ...valid().items[0], quantity: 31 }] }));
  assert.ok(validateCreateOrder({ ...valid(), items: [{ ...valid().items[0], note: "x".repeat(501) }] }));
});
test("only staff status transitions can update fulfillment", () => {
  assertStatusTransition("PENDING", "PREPARING");
  assertStatusTransition("PREPARING", "READY");
  assert.throws(() => assertStatusTransition("READY", "PAID"), InvalidOrderTransitionError);
  assert.throws(() => assertStatusTransition("PAID", "PENDING"), InvalidOrderTransitionError);
  assert.ok(validateUpdateStatus({ status: "PAID" }));
});
test("payment only from READY/UNPAID", () => {
  assertPaymentAllowed({ status: "READY", paymentStatus: "UNPAID" });
  assert.throws(() => assertPaymentAllowed({ status: "PENDING", paymentStatus: "UNPAID" }), InvalidOrderTransitionError);
  assert.throws(() => assertPaymentAllowed({ status: "READY", paymentStatus: "PAID" }), InvalidOrderTransitionError);
  assert.equal(validateUpdatePayment({ paymentStatus: "PAID" }), null);
});
test("generated IDs resist collisions", () => {
  const ids = Array.from({ length: 1000 }, generateOrderId);
  assert.equal(new Set(ids).size, 1000);
  assert.ok(ids.every(id => /^ORD-\d{8}-[0-9a-f-]{36}$/.test(id)));
});
