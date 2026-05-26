import { useState } from "react";
import Nav from "../components/Nav";
import OrderCard from "../components/OrderCard";
import { listOrders, markOrderPaid } from "../services/orderApi";
import type { Order } from "../types/order";
import { STATUS_LABELS, formatPrice } from "../constants/menu";

export default function CashierPage() {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<Order[]>([]);
	const [searched, setSearched] = useState(false);
	const [loading, setLoading] = useState(false);
	const [payingId, setPayingId] = useState<string | null>(null);
	const [error, setError] = useState("");

	// ── Search ────────────────────────────────────────────────────────────────

	const handleSearch = async (e?: React.FormEvent) => {
		e?.preventDefault();
		if (!query.trim()) return;

		setLoading(true);
		setError("");
		setSearched(true);

		try {
			// Try searching by table number first, then by phone if it looks like a phone
			const isPhone = /^\d{9,11}$/.test(query.replace(/\D/g, ""));
			const params = isPhone
				? { customerPhone: query.trim() }
				: { tableNumber: query.trim() };

			const res = await listOrders(params);
			setResults(res.items);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Tìm kiếm thất bại");
		} finally {
			setLoading(false);
		}
	};

	// ── Pay ───────────────────────────────────────────────────────────────────

	const handlePay = async (orderId: string) => {
		setPayingId(orderId);
		setError("");
		try {
			await markOrderPaid(orderId);
			// Update order status in local results
			setResults((prev) =>
				prev.map((o) =>
					o.orderId === orderId
						? { ...o, status: "PAID", paymentStatus: "PAID" }
						: o,
				),
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Xác nhận thanh toán thất bại");
		} finally {
			setPayingId(null);
		}
	};

	// ── Render ────────────────────────────────────────────────────────────────

	const unpaidOrders = results.filter((o) => o.paymentStatus !== "PAID");
	const paidOrders = results.filter((o) => o.paymentStatus === "PAID");

	return (
		<>
			<Nav />
			<div className='page'>
				<h1>Cashier 💳</h1>
				<p className='subtitle'>Tìm order theo số bàn hoặc số điện thoại</p>

				<form className='search-bar' onSubmit={handleSearch}>
					<input
						type='search'
						placeholder='Nhập số bàn (VD: A01) hoặc SĐT (VD: 0901234567)'
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
					<button
						type='submit'
						className='btn btn-primary'
						disabled={loading || !query.trim()}>
						{loading ? <span className='spinner' /> : "Tìm"}
					</button>
				</form>

				{error && <div className='alert alert-error'>{error}</div>}

				{searched && !loading && results.length === 0 && (
					<div className='empty-state'>
						<div className='icon'>🔍</div>
						<p>Không tìm thấy order nào.</p>
					</div>
				)}

				{/* ─ Unpaid orders ─ */}
				{unpaidOrders.length > 0 && (
					<>
						<h2 style={{ marginBottom: 12 }}>
							Chưa thanh toán ({unpaidOrders.length})
						</h2>
						<div className='order-grid' style={{ marginBottom: 28 }}>
							{unpaidOrders.map((order) => (
								<div key={order.orderId}>
									<OrderCard
										order={order}
										actions={
											order.status === "READY" ||
											order.status === "PREPARING" ||
											order.status === "PENDING" ? (
												<button
													className='btn btn-success btn-sm'
													disabled={payingId === order.orderId}
													onClick={() => handlePay(order.orderId)}>
													{payingId === order.orderId ? (
														<span className='spinner' />
													) : (
														`💰 Thanh toán ${formatPrice(order.totalAmount)}`
													)}
												</button>
											) : undefined
										}
									/>
									{/* Show current status info below the card */}
									<div
										className='text-sm text-muted'
										style={{
											marginTop: -12,
											marginBottom: 12,
											paddingLeft: 4,
										}}>
										Trạng thái:{" "}
										<strong>
											{STATUS_LABELS[order.status] ?? order.status}
										</strong>
										{order.status !== "READY" && (
											<span> · Kitchen chưa xong</span>
										)}
									</div>
								</div>
							))}
						</div>
					</>
				)}

				{/* ─ Paid orders ─ */}
				{paidOrders.length > 0 && (
					<>
						<h2 style={{ marginBottom: 12, color: "var(--gray-400)" }}>
							Đã thanh toán ({paidOrders.length})
						</h2>
						<div className='order-grid'>
							{paidOrders.map((order) => (
								<OrderCard key={order.orderId} order={order} />
							))}
						</div>
					</>
				)}
			</div>
		</>
	);
}
