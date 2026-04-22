import axios from "axios";

const CURRENT_USER_KEY = "gift-store-user";

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const loadCurrentUser = () => readJson(CURRENT_USER_KEY, null);
export const saveCurrentUser = (user) => writeJson(CURRENT_USER_KEY, user);
export const clearCurrentUser = () => localStorage.removeItem(CURRENT_USER_KEY);

const authApi = axios.create({
  baseURL: "/api/auth",
  timeout: 10000
});

const mapError = (error, fallback) => {
  return error?.response?.data?.error || fallback;
};

const publicUserFromPayload = (payload) => ({
  name: String(payload?.name || "").trim(),
  email: String(payload?.email || "").trim().toLowerCase(),
  contactNumber: String(payload?.contactNumber || "").trim(),
  address: String(payload?.address || "").trim()
});

export const requestSignupOtp = async ({ name, email, contactNumber, address, password }) => {
  try {
    const res = await authApi.post("/signup/request-otp", {
      name: String(name || "").trim(),
      email: String(email || "").trim().toLowerCase(),
      contactNumber: String(contactNumber || "").trim(),
      address: String(address || "").trim(),
      password: String(password || "")
    });

    return {
      ok: true,
      message: String(res.data?.message || "OTP sent to your email address."),
      expiresInSeconds: Number(res.data?.expiresInSeconds || 600)
    };
  } catch (error) {
    return {
      ok: false,
      error: mapError(error, "Unable to send OTP right now.")
    };
  }
};

export const verifySignupOtp = async ({ email, otp }) => {
  try {
    const res = await authApi.post("/signup/verify-otp", {
      email: String(email || "").trim().toLowerCase(),
      otp: String(otp || "").trim()
    });

    const user = publicUserFromPayload(res.data?.user || {});
    saveCurrentUser(user);

    return { ok: true, user };
  } catch (error) {
    return {
      ok: false,
      error: mapError(error, "Unable to verify OTP right now.")
    };
  }
};

export const registerUser = async (payload) => {
  const otpResult = await requestSignupOtp(payload);
  if (!otpResult.ok) {
    return otpResult;
  }

  return {
    ok: false,
    error: "OTP sent. Please verify OTP to complete signup.",
    requiresOtp: true,
    ...otpResult
  };
};

export const loginUser = async ({ email, password }) => {
  try {
    const res = await authApi.post("/login", {
      email: String(email || "").trim().toLowerCase(),
      password: String(password || "")
    });

    const user = publicUserFromPayload(res.data?.user || {});
    saveCurrentUser(user);

    return { ok: true, user };
  } catch (error) {
    return {
      ok: false,
      error: mapError(error, "Unable to login right now.")
    };
  }
};

export const updateCurrentUserProfile = ({ name, contactNumber, address }) => {
  const currentUser = loadCurrentUser();
  if (!currentUser?.email) {
    return { ok: false, error: "No active user found." };
  }

  const updatedUser = {
    ...currentUser,
    name: String(name || "").trim(),
    contactNumber: String(contactNumber || "").trim(),
    address: String(address || "").trim()
  };

  saveCurrentUser(updatedUser);

  return { ok: true, user: updatedUser };
};
