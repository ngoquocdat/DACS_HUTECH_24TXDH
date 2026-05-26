import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import OrderPage from "./pages/OrderPage";
import KitchenPage from "./pages/KitchenPage";
import CashierPage from "./pages/CashierPage";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<BrowserRouter>
			<Routes>
				<Route path='/' element={<Navigate to='/order' replace />} />
				<Route path='/order' element={<OrderPage />} />
				<Route path='/kitchen' element={<KitchenPage />} />
				<Route path='/cashier' element={<CashierPage />} />
			</Routes>
		</BrowserRouter>
	</React.StrictMode>,
);
