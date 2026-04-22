import { Link, NavLink } from "react-router-dom";

function Navbar({ cartCount = 0, user = null }) {
  const displayCount = cartCount > 99 ? "99+" : cartCount;

  const logout = () => {
    localStorage.removeItem("gift-store-user");
    window.location.href = "/login";
  };

  return (
    <div className="navbar">
      <div className="nav-left">
        <Link to="/" className="brand-link">
          Gift Store
        </Link>
      </div>

      <div className="nav-right">
        {user ? (
          <NavLink to="/account" className={({ isActive }) => (isActive ? "nav-active" : "")}>My Orders</NavLink>
        ) : (
          <NavLink to="/auth" className={({ isActive }) => (isActive ? "nav-active" : "")}>Login / Sign Up</NavLink>
        )}
        <NavLink to="/cart" className={({ isActive }) => `nav-cart-link ${isActive ? "nav-active" : ""}`}>
          <span>Cart</span>
          <span className="nav-cart-badge">{displayCount}</span>
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) => (isActive ? "nav-active" : "")}>Admin</NavLink>
        {user && (
          <button type="button" className="nav-logout-btn" onClick={logout}>
            Logout
          </button>
        )}
      </div>
    </div>
  );
}

export default Navbar;