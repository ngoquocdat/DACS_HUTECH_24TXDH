import { useState, useEffect, useCallback } from "react";
import Nav from "../components/Nav";
import OrderCard from "../components/OrderCard";
import { listOrders, updateOrderStatus } from "../services/orderApi";
import type { Order, OrderStatus } from "../types/order";

const POLL_INTERVAL_MS = 8000; // refresh every 8 seconds

// Kitchen only cares about active orders
const ACTIVE_STATUSES: OrderStatus[] = ["PENDING", "PREPARING"];

export default function KitchenPage() {
	const [orders, setOrders] = useState<Order[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [updatingId, setUpdatingId] = useState<string | null>(null);
	const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

	// ── Data fetching ─────────────────────────────────────────────────────────

	const fetchOrders = useCallback(async () => {
		try {
			// Fetch PENDING and PREPARING orders combined
			const [pendingRes, preparingRes] = await Promise.all([
				listOrders({ status: "PENDING" }),
				listOrders({ status: "PREPARING" }),
			]);
			const all = [...pendingRes.items, ...preparingRes.items];
			// Sort: PENDING first, then PREPARING; within each group by createdAt asc
			all.sort((a, b) => {
				if (a.status !== b.status) {
					return a.status === "PENDING" ? -1 : 1;
				}
				return (
					new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
				);
			});
			setOrders(all);
			setLastRefresh(new Date());
			setError("");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Không thể tải orders");
		} finally {
			setLoading(false);
		}
	}, []);

	// Initial load + polling
	useEffect(() => {
		fetchOrders();
		const interval = setInterval(fetchOrders, POLL_INTERVAL_MS);
		return () => clearInterval(interval);
	}, [fetchOrders]);

	// ── Status update ─────────────────────────────────────────────────────────

	const handleStatusChange = async (
		orderId: string,
		newStatus: OrderStatus,
	) => {
		setUpdatingId(orderId);
		try {
			await updateOrderStatus(orderId, newStatus);
			// Remove order from list immediately if it's no longer an active status
			if (!ACTIVE_STATUSES.includes(newStatus)) {
				setOrders((prev) => prev.filter((o) => o.orderId !== orderId));
			} else {
				// Update status locally while waiting for next poll
				setOrders((prev) =>
					prev.map((o) =>
						o.orderId === orderId ? { ...o, status: newStatus } : o,
					),
				);
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Cập nhật thất bại");
		} finally {
			setUpdatingId(null);
		}
	};

	// ── Render ────────────────────────────────────────────────────────────────

	const pendingOrders = orders.filter((o) => o.status === "PENDING");
	const preparingOrders = orders.filter((o) => o.status === "PREPARING");

	return (
		<>
			<Nav />
			<div className='page-wide'>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginBottom: 8,
					}}>
					<h1>Kitchen Board 🍳</h1>
					<button className='btn btn-outline btn-sm' onClick={fetchOrders}>
						↻ Làm mới
					</button>
				</div>
				<p className='subtitle'>
					Tự động cập nhật mỗi {POLL_INTERVAL_MS / 1000}s · Lần cuối:{" "}
					{lastRefresh.toLocaleTimeString("vi-VN")}
				</p>

				{error && <div className='alert alert-error'>{error}</div>}

				{loading ? (
					<div className='empty-state'>
						<div className='icon'>⏳</div>
						<p>Đang tải...</p>
					</div>
				) : (
					<>
						{/* ─ PENDING ─ */}
						<h2 style={{ color: "#f59e0b", marginBottom: 12 }}>
							Chờ xác nhận ({pendingOrders.length})
						</h2>
						{pendingOrders.length === 0 ? (
							<p className='text-muted text-sm' style={{ marginBottom: 28 }}>
								Không có order mới.
							</p>
						) : (
							<div className='order-grid' style={{ marginBottom: 32 }}>
								{pendingOrders.map((order) => (
									<OrderCard
										key={order.orderId}
										order={order}
										actions={
											<>
												<button
													className='btn btn-primary btn-sm'
													disabled={updatingId === order.orderId}
													onClick={() =>
														handleStatusChange(order.orderId, "PREPARING")
													}>
													{updatingId === order.orderId ? (
														<span className='spinner' />
													) : (
														"Bắt đầu làm"
													)}
												</button>
												<button
													className='btn btn-outline btn-sm'
													disabled={updatingId === order.orderId}
													onClick={() =>
														handleStatusChange(order.orderId, "CANCELLED")
													}>
													Hủy
												</button>
											</>
										}
									/>
								))}
							</div>
						)}

						{/* ─ PREPARING ─ */}
						<h2 style={{ color: "#3b82f6", marginBottom: 12 }}>
							Đang làm ({preparingOrders.length})
						</h2>
						{preparingOrders.length === 0 ? (
							<p className='text-muted text-sm'>Không có order đang làm.</p>
						) : (
							<div className='order-grid'>
								{preparingOrders.map((order) => (
									<OrderCard
										key={order.orderId}
										order={order}
										actions={
											<button
												className='btn btn-success btn-sm'
												disabled={updatingId === order.orderId}
												onClick={() =>
													handleStatusChange(order.orderId, "READY")
												}>
												{updatingId === order.orderId ? (
													<span className='spinner' />
												) : (
													"✓ Xong rồi"
												)}
											</button>
										}
									/>
								))}
							</div>
						)}

						{orders.length === 0 && (
							<div className='empty-state'>
								<div className='icon'>🎉</div>
								<p>Không có order nào đang chờ. Tuyệt vời!</p>
							</div>
						)}
					</>
				)}
			</div>
		</>
	);
}
