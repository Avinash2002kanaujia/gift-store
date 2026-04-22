import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { requestSignupOtp, verifySignupOtp } from "../utils/authStorage";

function Signup({ setUser }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [successText, setSuccessText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorText("");
    setSuccessText("");

    if (isOtpStep) {
      if (!/^\d{6}$/.test(otp.trim())) {
        setErrorText("Enter a valid 6-digit OTP.");
        return;
      }

      setIsSubmitting(true);
      const verifyResult = await verifySignupOtp({ email: pendingPayload?.email, otp });
      setIsSubmitting(false);

      if (!verifyResult.ok) {
        setErrorText(verifyResult.error);
        return;
      }

      setUser(verifyResult.user);
      navigate("/account");
      return;
    }

    const trimmedName = String(e.currentTarget?.elements?.namedItem("signup-name")?.value ?? name).trim();
    const trimmedEmail = String(e.currentTarget?.elements?.namedItem("signup-email")?.value ?? email).trim().toLowerCase();
    const trimmedContact = String(e.currentTarget?.elements?.namedItem("signup-contact")?.value ?? contactNumber).trim();
    const trimmedAddress = String(e.currentTarget?.elements?.namedItem("signup-address")?.value ?? address).trim();

    if (trimmedName.length < 2) {
      setErrorText("Enter your full name.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorText("Enter a valid email address.");
      return;
    }

    if (!/^[0-9+\-()\s]{7,20}$/.test(trimmedContact)) {
      setErrorText("Enter a valid contact number.");
      return;
    }

    if (!trimmedAddress) {
      setErrorText("Enter your address.");
      return;
    }

    if (password.trim().length < 4) {
      setErrorText("Password must be at least 4 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorText("Passwords do not match.");
      return;
    }

    const payload = {
      name: trimmedName,
      email: trimmedEmail,
      contactNumber: trimmedContact,
      address: trimmedAddress,
      password
    };

    setIsSubmitting(true);
    const result = await requestSignupOtp(payload);
    setIsSubmitting(false);

    if (!result.ok) {
      setErrorText(result.error);
      return;
    }

    setPendingPayload(payload);
    setIsOtpStep(true);
    setOtp("");
    setSuccessText(result.message || "OTP sent to your email.");
  };

  const resendOtp = async () => {
    setErrorText("");
    setSuccessText("");

    if (!pendingPayload) {
      setErrorText("Please fill details first.");
      setIsOtpStep(false);
      return;
    }

    setIsSubmitting(true);
    const result = await requestSignupOtp(pendingPayload);
    setIsSubmitting(false);

    if (!result.ok) {
      setErrorText(result.error);
      return;
    }

    setSuccessText(result.message || "OTP resent.");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <p className="auth-kicker">Create Account</p>
          <h1>Register your details</h1>
          <p>Sign up once to place orders and track your delivery status in your account page.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>Full Name</label>
          <input
            name="signup-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            autoComplete="name"
            disabled={isOtpStep}
          />

          <label>Email Address</label>
          <input
            name="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            disabled={isOtpStep}
          />

          <label>Contact Number</label>
          <input
            name="signup-contact"
            autoComplete="tel"
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
            placeholder="9876543210"
            disabled={isOtpStep}
          />

          <label>Address</label>
          <textarea
            name="signup-address"
            autoComplete="street-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Your address"
            rows="4"
            disabled={isOtpStep}
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create password"
            disabled={isOtpStep}
          />

          <label>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat password"
            disabled={isOtpStep}
          />

          {isOtpStep && (
            <>
              <label>Email OTP</label>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                inputMode="numeric"
              />
              <p className="auth-help">An OTP has been sent to {pendingPayload?.email}.</p>
            </>
          )}

          {errorText && <p className="auth-error">{errorText}</p>}
          {successText && <p className="auth-success">{successText}</p>}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (isOtpStep ? "Verifying OTP..." : "Sending OTP...") : (isOtpStep ? "Verify OTP" : "Send OTP")}
          </button>

          {isOtpStep && (
            <button type="button" className="secondary-btn" onClick={resendOtp} disabled={isSubmitting}>
              Resend OTP
            </button>
          )}
        </form>

        <div className="auth-footer">
          <Link to="/login">Already have an account?</Link>
          <Link to="/account">My Orders</Link>
        </div>
      </div>
    </div>
  );
}

export default Signup;
