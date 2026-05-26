import { NavLink } from "react-router-dom";

export default function Nav() {
	return (
		<nav className='nav'>
			<a className='nav-brand' href='/order'>
				🐟 iPOS Pokesaigon
			</a>
			<NavLink
				className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
				to='/order'>
				Order
			</NavLink>
			<NavLink
				className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
				to='/kitchen'>
				Kitchen
			</NavLink>
			<NavLink
				className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
				to='/cashier'>
				Cashier
			</NavLink>
		</nav>
	);
}
