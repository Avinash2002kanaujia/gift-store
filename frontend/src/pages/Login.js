import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../utils/authStorage";

function Login({ user, setUser }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (user) {
      setEmail(user.email || "");
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formEmail = String(e.currentTarget?.elements?.namedItem("login-email")?.value ?? email);
    const trimmedEmail = formEmail.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorText("Enter a valid email address.");
      return;
    }

    if (password.trim().length < 4) {
      setErrorText("Enter your password.");
      return;
    }

    const result = await loginUser({ email: trimmedEmail, password });
    if (!result.ok) {
      setErrorText(result.error);
      return;
    }

    setUser(result.user);
    setErrorText("");
    navigate("/account");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <p className="auth-kicker">Customer Login</p>
          <h1>{user ? "Welcome back" : "Login to view your orders"}</h1>
          <p>Use your registered email and password to view order status and profile details.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>Email Address</label>
          <input
            name="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Set a password"
          />

          {errorText && <p className="auth-error">{errorText}</p>}

          <button type="submit">Login</button>
        </form>

        <div className="auth-footer">
          <Link to="/">Back to store</Link>
          <Link to="/signup">Create account</Link>
          <Link to="/account">My Orders</Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
