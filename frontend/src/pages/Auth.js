import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser, requestSignupOtp, verifySignupOtp } from "../utils/authStorage";

function Auth({ user, setUser, initialMode = "login" }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState(initialMode);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupContactNumber, setSignupContactNumber] = useState("");
  const [signupAddress, setSignupAddress] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [signupOtp, setSignupOtp] = useState("");
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [pendingSignupPayload, setPendingSignupPayload] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  const getPasswordStrength = (value) => {
    const pwd = String(value || "");
    let score = 0;

    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 2) {
      return { label: "Weak", className: "weak", percent: 33 };
    }
    if (score <= 4) {
      return { label: "Medium", className: "medium", percent: 66 };
    }

    return { label: "Strong", className: "strong", percent: 100 };
  };

  const passwordStrength = getPasswordStrength(signupPassword);

  useEffect(() => {
    if (user) {
      setLoginEmail(user.email || "");
      setSignupName(user.name || "");
      setSignupEmail(user.email || "");
      setSignupContactNumber(user.contactNumber || "");
      setSignupAddress(user.address || "");
    }
  }, [user]);

  useEffect(() => {
    setMode(initialMode);
    setErrorText("");
    setSuccessText("");
  }, [initialMode]);

  const resetMessages = () => {
    setErrorText("");
    setSuccessText("");
  };

  const getFormValue = (form, fieldName, fallbackValue = "") => {
    const elementValue = form?.elements?.namedItem(fieldName)?.value;
    return String(elementValue ?? fallbackValue);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    resetMessages();

    const trimmedEmail = getFormValue(e.currentTarget, "login-email", loginEmail).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorText("Enter a valid email address.");
      return;
    }

    if (loginPassword.trim().length < 4) {
      setErrorText("Enter your password.");
      return;
    }

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 250));

    const result = await loginUser({ email: trimmedEmail, password: loginPassword });
    if (!result.ok) {
      setIsSubmitting(false);
      setErrorText(result.error);
      return;
    }

    setUser(result.user);
    setSuccessText("Login successful. Redirecting to your account...");
    setIsSubmitting(false);
    navigate("/account");
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    resetMessages();

    const trimmedName = getFormValue(e.currentTarget, "signup-name", signupName).trim();
    const trimmedEmail = getFormValue(e.currentTarget, "signup-email", signupEmail).trim().toLowerCase();
    const trimmedContact = getFormValue(e.currentTarget, "signup-contact", signupContactNumber).trim();
    const trimmedAddress = getFormValue(e.currentTarget, "signup-address", signupAddress).trim();

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

    if (signupPassword.trim().length < 4) {
      setErrorText("Password must be at least 4 characters.");
      return;
    }

    if (passwordStrength.className === "weak") {
      setErrorText("Please choose a stronger password.");
      return;
    }

    if (signupPassword !== confirmPassword) {
      setErrorText("Passwords do not match.");
      return;
    }

    if (!acceptedTerms) {
      setErrorText("Please accept terms to continue.");
      return;
    }

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 250));

    const payload = {
      name: trimmedName,
      email: trimmedEmail,
      contactNumber: trimmedContact,
      address: trimmedAddress,
      password: signupPassword
    };

    const result = await requestSignupOtp(payload);

    if (!result.ok) {
      setIsSubmitting(false);
      setErrorText(result.error);
      return;
    }

    setPendingSignupPayload(payload);
    setIsOtpStep(true);
    setSignupOtp("");
    setSuccessText(result.message || "OTP sent. Please verify to complete signup.");
    setIsSubmitting(false);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    resetMessages();

    const otp = signupOtp.trim();
    if (!/^\d{6}$/.test(otp)) {
      setErrorText("Enter a valid 6-digit OTP.");
      return;
    }

    if (!pendingSignupPayload?.email) {
      setErrorText("Please request OTP again.");
      setIsOtpStep(false);
      return;
    }

    setIsSubmitting(true);
    const result = await verifySignupOtp({
      email: pendingSignupPayload.email,
      otp
    });

    if (!result.ok) {
      setIsSubmitting(false);
      setErrorText(result.error);
      return;
    }

    setUser(result.user);
    setSuccessText("Account verified and created. Redirecting to your account...");
    setIsSubmitting(false);
    navigate("/account");
  };

  const resendOtp = async () => {
    resetMessages();
    if (!pendingSignupPayload) {
      setErrorText("Please fill signup details first.");
      setIsOtpStep(false);
      return;
    }

    setIsSubmitting(true);
    const result = await requestSignupOtp(pendingSignupPayload);
    setIsSubmitting(false);

    if (!result.ok) {
      setErrorText(result.error);
      return;
    }

    setSuccessText(result.message || "OTP resent successfully.");
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <div className="auth-header">
          <p className="auth-kicker">Customer Access</p>
          <h1>{mode === "login" ? "Login to view your orders" : "Create your account"}</h1>
          <p>Use one screen to login or register. Your order status and profile stay connected.</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "login" ? "view-btn active" : "view-btn"}
            onClick={() => {
              setMode("login");
              resetMessages();
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === "signup" ? "view-btn active" : "view-btn"}
            onClick={() => {
              setMode("signup");
              setIsOtpStep(false);
              setSignupOtp("");
              setPendingSignupPayload(null);
              resetMessages();
            }}
          >
            Sign Up
          </button>
        </div>

        {mode === "login" ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <label>Email Address</label>
            <input
              name="login-email"
              type="email"
              autoComplete="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="name@example.com"
            />

            <label>Password</label>
            <div className="auth-password-row">
              <input
                type={showLoginPassword ? "text" : "password"}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Your password"
              />
              <button
                type="button"
                className="auth-inline-btn"
                onClick={() => setShowLoginPassword((prev) => !prev)}
              >
                {showLoginPassword ? "Hide" : "Show"}
              </button>
            </div>

            {errorText && <p className="auth-error">{errorText}</p>}
            {successText && <p className="auth-success">{successText}</p>}

            <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Logging in..." : "Login"}</button>

            <p className="auth-help">Not registered yet? Switch to Sign Up tab and create your account.</p>
          </form>
        ) : (
          <form className="auth-form" onSubmit={isOtpStep ? handleVerifyOtp : handleSignup}>
            <label>Full Name</label>
            <input
              name="signup-name"
              value={signupName}
              onChange={(e) => setSignupName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              disabled={isOtpStep}
            />

            <label>Email Address</label>
            <input
              name="signup-email"
              type="email"
              autoComplete="email"
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
              placeholder="name@example.com"
              disabled={isOtpStep}
            />

            <label>Contact Number</label>
            <input
              name="signup-contact"
              autoComplete="tel"
              value={signupContactNumber}
              onChange={(e) => setSignupContactNumber(e.target.value)}
              placeholder="9876543210"
              disabled={isOtpStep}
            />

            <label>Address</label>
            <textarea
              name="signup-address"
              autoComplete="street-address"
              value={signupAddress}
              onChange={(e) => setSignupAddress(e.target.value)}
              placeholder="Your address"
              rows="4"
              disabled={isOtpStep}
            />

            <label>Password</label>
            <div className="auth-password-row">
              <input
                type={showSignupPassword ? "text" : "password"}
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="Create password"
                disabled={isOtpStep}
              />
              <button
                type="button"
                className="auth-inline-btn"
                onClick={() => setShowSignupPassword((prev) => !prev)}
              >
                {showSignupPassword ? "Hide" : "Show"}
              </button>
            </div>

            <div className="password-strength">
              <div className="password-strength-track">
                <span
                  className={`password-strength-fill ${passwordStrength.className}`}
                  style={{ width: `${passwordStrength.percent}%` }}
                />
              </div>
              <small>Password strength: {passwordStrength.label}</small>
            </div>

            <label>Confirm Password</label>
            <div className="auth-password-row">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                disabled={isOtpStep}
              />
              <button
                type="button"
                className="auth-inline-btn"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>

            <label className="auth-check-row">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                disabled={isOtpStep}
              />
              <span>I agree to the store terms and privacy policy.</span>
            </label>

            {isOtpStep && (
              <>
                <label>Email OTP</label>
                <input
                  value={signupOtp}
                  onChange={(e) => setSignupOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Enter 6-digit OTP"
                  inputMode="numeric"
                />
                <p className="auth-help">An OTP has been sent to {pendingSignupPayload?.email}. Enter it to complete signup.</p>
              </>
            )}

            {errorText && <p className="auth-error">{errorText}</p>}
            {successText && <p className="auth-success">{successText}</p>}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isOtpStep
                  ? "Verifying OTP..."
                  : "Sending OTP..."
                : isOtpStep
                  ? "Verify OTP"
                  : "Send OTP"}
            </button>

            {isOtpStep && (
              <button type="button" className="secondary-btn" onClick={resendOtp} disabled={isSubmitting}>
                Resend OTP
              </button>
            )}
          </form>
        )}

        <div className="auth-footer">
          <Link to="/">Back to store</Link>
          <Link to="/account">My Orders</Link>
        </div>
      </div>
    </div>
  );
}

export default Auth;
