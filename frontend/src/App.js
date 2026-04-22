import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Cart from "./pages/Cart";
import Admin from "./pages/Admin";
import Account from "./pages/Account";
import Auth from "./pages/Auth";

function AppRoutes({ cart, setCart, user, setUser }) {
  const location = useLocation();

  return (
    <main key={location.pathname} className="route-shell">
      <Routes>
        <Route path="/" element={<Home cart={cart} setCart={setCart} />} />
        <Route path="/cart" element={<Cart cart={cart} setCart={setCart} user={user} />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/auth" element={<Auth user={user} setUser={setUser} />} />
        <Route path="/login" element={<Auth user={user} setUser={setUser} initialMode="login" />} />
        <Route path="/signup" element={<Auth user={user} setUser={setUser} initialMode="signup" />} />
        <Route path="/account" element={<Account user={user} setUser={setUser} />} />
      </Routes>
    </main>
  );
}

function App() {
  const [cart, setCart] = useState(() => {
    try {
      const raw = localStorage.getItem("gift-store-cart");
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("gift-store-user");
      const parsed = JSON.parse(raw || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem("gift-store-cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("gift-store-user", JSON.stringify(user));
    } else {
      localStorage.removeItem("gift-store-user");
    }
  }, [user]);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Navbar cartCount={cart.length} user={user} />
        <AppRoutes cart={cart} setCart={setCart} user={user} setUser={setUser} />
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;