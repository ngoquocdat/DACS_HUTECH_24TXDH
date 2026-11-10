import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import OrderPage from "./pages/OrderPage";
import KitchenPage from "./pages/KitchenPage";
import CashierPage from "./pages/CashierPage";
import { accessToken, finishLogin, hasRole, login, type UiRole } from "./auth/cognito";
import "./index.css";

function Protected({ roles, children }: { roles: UiRole[]; children: React.ReactNode }) {
  const location = useLocation();
  if (!accessToken()) return <Navigate to={"/login?next=" + encodeURIComponent(location.pathname)} replace />;
  if (!hasRole(roles)) return <div className="container"><h2>403 — Không đủ quyền truy cập</h2><a href="/order">Quay về đặt món</a></div>;
  return <>{children}</>;
}
function Login() {
  const location = useLocation();
  const [error, setError] = useState("");
  const next = new URLSearchParams(location.search).get("next") || "/order";
  if (accessToken()) return <Navigate to={next.startsWith("/") && !next.startsWith("//") ? next : "/order"} replace />;
  return <main className="container" style={{ maxWidth: 520, paddingTop: 60 }}>
    <h1>🐟 iPOS Pokesaigon</h1>
    <p>Đăng nhập bằng tài khoản Cognito để tiếp tục. Tài khoản nhân viên được Manager cấp quyền.</p>
    <button type="button" onClick={() => { login(next).catch(e => setError(e instanceof Error ? e.message : "Login failed")); }}>
      Đăng nhập / Đăng ký
    </button>
    {error && <p role="alert">{error}</p>}
  </main>;
}
function Callback() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    finishLogin().then(next => navigate(next, { replace: true }))
      .catch(e => setError(e instanceof Error ? e.message : "Authentication failed"));
  }, [navigate]);
  return <main className="container"><h2>Đang xác thực…</h2>{error && <><p role="alert">{error}</p><a href="/login">Đăng nhập lại</a></>}</main>;
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/order" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<Callback />} />
        <Route path="/order" element={<Protected roles={["CUSTOMER","MANAGER","KITCHEN","CASHIER"]}><OrderPage /></Protected>} />
        <Route path="/kitchen" element={<Protected roles={["KITCHEN","MANAGER"]}><KitchenPage /></Protected>} />
        <Route path="/cashier" element={<Protected roles={["CASHIER","MANAGER"]}><CashierPage /></Protected>} />
        <Route path="*" element={<Navigate to="/order" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
