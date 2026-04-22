// api/auth-signup-request-otp.js (Vercel serverless function)
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const User = require('../backend/models/User');
const crypto = require('crypto');

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/giftstore";
const OTP_SECRET = process.env.OTP_SECRET || "gift-store-dev-otp-secret";
const OTP_TTL_MS = Math.max(1, Number(process.env.OTP_TTL_MINUTES || 10)) * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = Math.max(5, Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 30)) * 1000;
const OTP_MAX_VERIFY_ATTEMPTS = Math.max(1, Number(process.env.OTP_MAX_VERIFY_ATTEMPTS || 5));

const pendingSignupOtps = new Map();

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

function validateSignupBody(body) {
  const name = String(body.name || "").trim();
  const email = normalizeEmail(body.email);
  const contactNumber = String(body.contactNumber || "").trim();
  const address = String(body.address || "").trim();
  const password = String(body.password || "");
  if (name.length < 2) return "Enter your full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
  if (!/^[0-9+\-()\s]{7,20}$/.test(contactNumber)) return "Enter a valid contact number.";
  if (address.length < 4) return "Enter your address.";
  if (password.trim().length < 4) return "Password must be at least 4 characters.";
  return "";
}

function makeOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(email, otp) {
  return crypto.createHash("sha256").update(`${normalizeEmail(email)}|${String(otp)}|${OTP_SECRET}`).digest("hex");
}

async function sendOtpEmail({ email, otp, name }) {
  // For demo, just log OTP. Add real email logic as needed.
  console.log(`OTP for ${email}: ${otp}`);
  return true;
}

module.exports = async (req, res) => {
  await dbConnect();
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  const validationError = validateSignupBody(req.body || {});
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const email = normalizeEmail(req.body.email);
  const existingUser = await User.findOne({ email }).lean().exec();
  if (existingUser) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }
  const now = Date.now();
  const existingOtp = pendingSignupOtps.get(email);
  if (existingOtp && now - existingOtp.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - existingOtp.lastSentAt)) / 1000);
    return res.status(429).json({ error: `Please wait ${waitSeconds}s before requesting another OTP.` });
  }
  const otp = makeOtpCode();
  pendingSignupOtps.set(email, {
    otpHash: hashOtp(email, otp),
    expiresAt: now + OTP_TTL_MS,
    remainingAttempts: OTP_MAX_VERIFY_ATTEMPTS,
    lastSentAt: now,
    payload: req.body
  });
  await sendOtpEmail({ email, otp, name: req.body.name });
  return res.json({ ok: true, message: "OTP sent to your email address.", expiresInSeconds: Math.round(OTP_TTL_MS / 1000) });
};
