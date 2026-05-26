import { useState } from "react";
import Nav from "../components/Nav";
import { POKE_MENU, BASE_BOWL_PRICE, formatPrice } from "../constants/menu";
import { createOrder } from "../services/orderApi";
import type { CreateOrderRequest } from "../types/order";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
	tableNumber: string;
	customerPhone: string;
	base: string;
	protein: string;
	toppings: string[];
	sauce: string;
	drink: string;
	note: string;
}

const STEP_TITLES = [
	"Thông tin",
	"Base",
	"Protein",
	"Toppings",
	"Sauce",
	"Nước uống",
	"Review",
];
const TOTAL_STEPS = STEP_TITLES.length; // 0-6; step 7 = success screen

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrderPage() {
	const [step, setStep] = useState(0);
	const [form, setForm] = useState<FormState>({
		tableNumber: "",
		customerPhone: "",
		base: "",
		protein: "",
		toppings: [],
		sauce: "",
		drink: "",
		note: "",
	});
	const [submitted, setSubmitted] = useState<{
		orderId: string;
		status: string;
	} | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	// ── Derived ─────────────────────────────────────────────────────────────────

	const calcTotal = () => {
		let total = BASE_BOWL_PRICE;
		total += POKE_MENU.bases.find((b) => b.id === form.base)?.price ?? 0;
		total += POKE_MENU.proteins.find((p) => p.id === form.protein)?.price ?? 0;
		total += form.toppings.reduce(
			(s, t) => s + (POKE_MENU.toppings.find((tp) => tp.id === t)?.price ?? 0),
			0,
		);
		total += POKE_MENU.sauces.find((s) => s.id === form.sauce)?.price ?? 0;
		total += POKE_MENU.drinks.find((d) => d.id === form.drink)?.price ?? 0;
		return total;
	};

	const canNext = () => {
		switch (step) {
			case 0:
				return (
					form.tableNumber.trim() !== "" &&
					/^\d{9,11}$/.test(form.customerPhone.replace(/\D/g, ""))
				);
			case 1:
				return form.base !== "";
			case 2:
				return form.protein !== "";
			case 3:
				return true; // toppings optional
			case 4:
				return form.sauce !== "";
			case 5:
				return form.drink !== "";
			default:
				return true;
		}
	};

	// ── Actions ──────────────────────────────────────────────────────────────────

	const next = () => {
		if (canNext()) setStep((s) => s + 1);
	};
	const back = () => setStep((s) => Math.max(0, s - 1));

	const toggleTopping = (id: string) =>
		setForm((f) => ({
			...f,
			toppings: f.toppings.includes(id)
				? f.toppings.filter((t) => t !== id)
				: [...f.toppings, id],
		}));

	const handleSubmit = async () => {
		setLoading(true);
		setError("");
		try {
			const req: CreateOrderRequest = {
				tableNumber: form.tableNumber.trim(),
				customerPhone: form.customerPhone.trim(),
				items: [
					{
						base: form.base,
						protein: form.protein,
						toppings: form.toppings,
						sauce: form.sauce,
						drink: form.drink,
						quantity: 1,
						note: form.note || undefined,
					},
				],
			};
			const result = await createOrder(req);
			setSubmitted(result);
			setStep(7);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Tạo order thất bại. Thử lại.");
		} finally {
			setLoading(false);
		}
	};

	const handleNewOrder = () => {
		setForm({
			tableNumber: "",
			customerPhone: "",
			base: "",
			protein: "",
			toppings: [],
			sauce: "",
			drink: "",
			note: "",
		});
		setSubmitted(null);
		setError("");
		setStep(0);
	};

	// ── Renders ──────────────────────────────────────────────────────────────────

	const renderStep = () => {
		switch (step) {
			// ── Step 0: table + phone ────────────────────────────────────────────────
			case 0:
				return (
					<>
						<h2>Thông tin khách hàng</h2>
						<div className='form-group'>
							<label>Số bàn *</label>
							<input
								type='text'
								placeholder='VD: A01, B02'
								value={form.tableNumber}
								onChange={(e) =>
									setForm((f) => ({ ...f, tableNumber: e.target.value }))
								}
							/>
						</div>
						<div className='form-group'>
							<label>Số điện thoại *</label>
							<input
								type='tel'
								placeholder='VD: 0901234567'
								value={form.customerPhone}
								onChange={(e) =>
									setForm((f) => ({ ...f, customerPhone: e.target.value }))
								}
							/>
							<p className='text-sm text-muted' style={{ marginTop: 4 }}>
								Dùng để thông báo trạng thái order
							</p>
						</div>
					</>
				);

			// ── Step 1: base ─────────────────────────────────────────────────────────
			case 1:
				return (
					<>
						<h2>Chọn Base</h2>
						<p className='subtitle'>Nền của poke bowl</p>
						<div className='option-grid'>
							{POKE_MENU.bases.map((b) => (
								<div
									key={b.id}
									className={`option-card ${form.base === b.id ? "selected" : ""}`}
									onClick={() => setForm((f) => ({ ...f, base: b.id }))}>
									<div className='name'>{b.name}</div>
									<div className={`price ${b.price === 0 ? "free" : ""}`}>
										{b.price === 0 ? "Miễn phí" : `+${formatPrice(b.price)}`}
									</div>
								</div>
							))}
						</div>
					</>
				);

			// ── Step 2: protein ──────────────────────────────────────────────────────
			case 2:
				return (
					<>
						<h2>Chọn Protein</h2>
						<p className='subtitle'>Nguồn đạm chính</p>
						<div className='option-grid'>
							{POKE_MENU.proteins.map((p) => (
								<div
									key={p.id}
									className={`option-card ${form.protein === p.id ? "selected" : ""}`}
									onClick={() => setForm((f) => ({ ...f, protein: p.id }))}>
									<div className='name'>{p.name}</div>
									<div className='price'>+{formatPrice(p.price)}</div>
								</div>
							))}
						</div>
					</>
				);

			// ── Step 3: toppings ─────────────────────────────────────────────────────
			case 3:
				return (
					<>
						<h2>Chọn Topping</h2>
						<p className='subtitle'>Có thể chọn nhiều loại (không bắt buộc)</p>
						<div className='option-grid'>
							{POKE_MENU.toppings.map((t) => (
								<div
									key={t.id}
									className={`option-card ${form.toppings.includes(t.id) ? "selected" : ""}`}
									onClick={() => toggleTopping(t.id)}>
									<div className='name'>{t.name}</div>
									<div className='price'>+{formatPrice(t.price)}</div>
								</div>
							))}
						</div>
						{form.toppings.length === 0 && (
							<p className='text-sm text-muted mt-4'>
								Không chọn topping cũng được.
							</p>
						)}
					</>
				);

			// ── Step 4: sauce ────────────────────────────────────────────────────────
			case 4:
				return (
					<>
						<h2>Chọn Sauce</h2>
						<p className='subtitle'>Gia vị đi kèm</p>
						<div className='option-grid'>
							{POKE_MENU.sauces.map((s) => (
								<div
									key={s.id}
									className={`option-card ${form.sauce === s.id ? "selected" : ""}`}
									onClick={() => setForm((f) => ({ ...f, sauce: s.id }))}>
									<div className='name'>{s.name}</div>
									<div className='price free'>Miễn phí</div>
								</div>
							))}
						</div>
					</>
				);

			// ── Step 5: drink ────────────────────────────────────────────────────────
			case 5:
				return (
					<>
						<h2>Chọn Nước uống</h2>
						<div className='option-grid'>
							{POKE_MENU.drinks.map((d) => (
								<div
									key={d.id}
									className={`option-card ${form.drink === d.id ? "selected" : ""}`}
									onClick={() => setForm((f) => ({ ...f, drink: d.id }))}>
									<div className='name'>{d.name}</div>
									<div className='price'>+{formatPrice(d.price)}</div>
								</div>
							))}
						</div>
					</>
				);

			// ── Step 6: review ───────────────────────────────────────────────────────
			case 6: {
				const baseItem = POKE_MENU.bases.find((b) => b.id === form.base);
				const proteinItem = POKE_MENU.proteins.find(
					(p) => p.id === form.protein,
				);
				const sauceItem = POKE_MENU.sauces.find((s) => s.id === form.sauce);
				const drinkItem = POKE_MENU.drinks.find((d) => d.id === form.drink);
				const toppingNames = form.toppings
					.map((t) => POKE_MENU.toppings.find((tp) => tp.id === t)?.name)
					.filter(Boolean)
					.join(", ");

				return (
					<>
						<h2>Xem lại order</h2>

						<div className='summary-row'>
							<span>Bàn</span>
							<strong>{form.tableNumber}</strong>
						</div>
						<div className='summary-row'>
							<span>SĐT</span>
							<strong>{form.customerPhone}</strong>
						</div>
						<div className='divider' />

						<div className='summary-row'>
							<span>Base bowl</span>
							<span>{formatPrice(BASE_BOWL_PRICE)}</span>
						</div>
						<div className='summary-row'>
							<span>{baseItem?.name}</span>
							<span>
								{baseItem && baseItem.price > 0
									? `+${formatPrice(baseItem.price)}`
									: "miễn phí"}
							</span>
						</div>
						<div className='summary-row'>
							<span>{proteinItem?.name}</span>
							<span>+{formatPrice(proteinItem?.price ?? 0)}</span>
						</div>
						{form.toppings.length > 0 && (
							<div className='summary-row'>
								<span>Toppings: {toppingNames}</span>
								<span>
									+
									{formatPrice(
										form.toppings.reduce(
											(s, t) =>
												s +
												(POKE_MENU.toppings.find((tp) => tp.id === t)?.price ??
													0),
											0,
										),
									)}
								</span>
							</div>
						)}
						<div className='summary-row'>
							<span>{sauceItem?.name}</span>
							<span>miễn phí</span>
						</div>
						<div className='summary-row'>
							<span>{drinkItem?.name}</span>
							<span>+{formatPrice(drinkItem?.price ?? 0)}</span>
						</div>
						<div className='summary-row total'>
							<span>Tổng cộng</span>
							<strong style={{ color: "var(--primary)" }}>
								{formatPrice(calcTotal())}
							</strong>
						</div>

						{form.note === "" && (
							<div className='form-group mt-4'>
								<label>Ghi chú (không bắt buộc)</label>
								<textarea
									rows={2}
									placeholder='VD: ít sauce, không ăn được avocado...'
									value={form.note}
									onChange={(e) =>
										setForm((f) => ({ ...f, note: e.target.value }))
									}
								/>
							</div>
						)}

						{error && <div className='alert alert-error'>{error}</div>}
					</>
				);
			}

			// ── Step 7: success ──────────────────────────────────────────────────────
			case 7:
				return (
					<div className='success-screen'>
						<div className='success-icon'>✅</div>
						<h2>Order đã được gửi!</h2>
						<p className='subtitle'>Kitchen đang nhận order của bạn.</p>
						<div className='order-code'>{submitted?.orderId}</div>
						<p className='text-sm text-muted mt-4'>Trạng thái: PENDING</p>
						<button className='btn btn-primary mt-4' onClick={handleNewOrder}>
							Tạo order mới
						</button>
					</div>
				);

			default:
				return null;
		}
	};

	// ── Layout ───────────────────────────────────────────────────────────────────

	return (
		<>
			<Nav />
			<div className='page'>
				{step < TOTAL_STEPS && (
					<>
						{/* Step indicator */}
						<div className='steps'>
							{STEP_TITLES.map((_, i) => (
								<div
									key={i}
									className={`step-dot ${i < step ? "done" : i === step ? "active" : ""}`}
								/>
							))}
						</div>

						<div className='card'>
							{step < TOTAL_STEPS && (
								<p className='text-sm text-muted' style={{ marginBottom: 4 }}>
									Bước {step + 1} / {TOTAL_STEPS}
								</p>
							)}

							{renderStep()}

							<div
								className='flex gap-2 mt-4'
								style={{ justifyContent: "space-between" }}>
								{step > 0 ? (
									<button className='btn btn-outline' onClick={back}>
										← Quay lại
									</button>
								) : (
									<span />
								)}

								{step < TOTAL_STEPS - 1 ? (
									<button
										className='btn btn-primary'
										disabled={!canNext()}
										onClick={next}>
										Tiếp theo →
									</button>
								) : step === TOTAL_STEPS - 1 ? (
									<button
										className='btn btn-success'
										disabled={loading}
										onClick={handleSubmit}>
										{loading ? (
											<>
												<span className='spinner' /> Đang gửi...
											</>
										) : (
											"Xác nhận order"
										)}
									</button>
								) : null}
							</div>
						</div>
					</>
				)}

				{/* Success step rendered outside the card */}
				{step === 7 && <div className='card'>{renderStep()}</div>}
			</div>
		</>
	);
}
