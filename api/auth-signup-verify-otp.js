// api/auth-signup-verify-otp.js (Vercel serverless function)
const mongoose = require('mongoose');
const User = require('../backend/models/User');
const crypto = require('crypto');
const PendingSignupOtp = require('../backend/models/PendingSignupOtp');

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/giftstore";
const OTP_SECRET = process.env.OTP_SECRET || "gift-store-dev-otp-secret";
const OTP_TTL_MS = Math.max(1, Number(process.env.OTP_TTL_MINUTES || 10)) * 60 * 1000;
const OTP_MAX_VERIFY_ATTEMPTS = Math.max(1, Number(process.env.OTP_MAX_VERIFY_ATTEMPTS || 5));



async function dbConnect() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function hashOtp(email, otp) {
  return crypto.createHash("sha256").update(`${normalizeEmail(email)}|${String(otp)}|${OTP_SECRET}`).digest("hex");
}

module.exports = async (req, res) => {
  await dbConnect();
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  const email = normalizeEmail(req.body?.email);
  const otp = String(req.body?.otp || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: "Enter a valid 6-digit OTP." });
  }
  const pending = await PendingSignupOtp.findOne({ email });
  if (!pending) {
    return res.status(400).json({ error: "No OTP request found for this email." });
  }
  if (pending.expiresAt < new Date()) {
    await PendingSignupOtp.deleteOne({ email });
    return res.status(400).json({ error: "OTP expired. Please request a new one." });
  }
  if (pending.remainingAttempts <= 0) {
    await PendingSignupOtp.deleteOne({ email });
    return res.status(400).json({ error: "Too many failed attempts. Please request a new OTP." });
  }
  if (pending.otpHash !== hashOtp(email, otp)) {
    await PendingSignupOtp.updateOne({ email }, { $inc: { remainingAttempts: -1 } });
    return res.status(400).json({ error: "Invalid OTP." });
  }
  // Create user
  const user = await User.create(pending.payload);
  await PendingSignupOtp.deleteOne({ email });
  return res.json({ ok: true, user });
};
