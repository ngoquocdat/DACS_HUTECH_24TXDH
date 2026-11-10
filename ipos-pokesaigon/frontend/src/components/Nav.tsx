import { NavLink } from "react-router-dom";
import { hasRole, logout } from "../auth/cognito";

export default function Nav() {
  return <nav className="nav" aria-label="Primary navigation">
    <NavLink className="nav-brand" to="/order">🐟 iPOS Pokesaigon</NavLink>
    <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/order">Order</NavLink>
    {hasRole(["KITCHEN","MANAGER"]) && <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/kitchen">Kitchen</NavLink>}
    {hasRole(["CASHIER","MANAGER"]) && <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/cashier">Cashier</NavLink>}
    <button type="button" className="nav-link" onClick={logout}>Đăng xuất</button>
  </nav>;
}
