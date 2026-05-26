import type { Order } from "../types/order";
import { STATUS_LABELS, STATUS_COLORS, formatPrice } from "../constants/menu";

interface Props {
	order: Order;
	/** Buttons to render in the card footer */
	actions?: React.ReactNode;
}

export default function OrderCard({ order, actions }: Props) {
	const statusColor = STATUS_COLORS[order.status] ?? "#6b7280";

	return (
		<div className='order-card' style={{ borderLeftColor: statusColor }}>
			<div className='order-card-header'>
				<div>
					<div className='order-table'>Bàn {order.tableNumber}</div>
					<div className='order-id'>{order.orderId}</div>
				</div>
				<span
					className='badge'
					style={{ background: statusColor + "22", color: statusColor }}>
					{STATUS_LABELS[order.status] ?? order.status}
				</span>
			</div>

			<div className='order-items'>
				{order.items.map((item, i) => (
					<div key={i}>
						<strong>{item.protein}</strong> · {item.base}
						{item.toppings.length > 0 && ` · ${item.toppings.join(", ")}`}
						{` · ${item.sauce}`}
						{item.drink && ` · ${item.drink}`}
						{item.quantity > 1 && ` ×${item.quantity}`}
						{item.note && <em className='text-muted'> ({item.note})</em>}
					</div>
				))}
			</div>

			<div className='order-footer'>
				<span className='order-total'>{formatPrice(order.totalAmount)}</span>
				<span className='order-time'>
					{new Date(order.createdAt).toLocaleTimeString("vi-VN", {
						hour: "2-digit",
						minute: "2-digit",
					})}
				</span>
				{actions && <div className='flex gap-2'>{actions}</div>}
			</div>
		</div>
	);
}
