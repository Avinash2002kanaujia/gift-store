const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");

const Product = require("../models/Product");
const User = require("../models/User");

const router = express.Router();

const OTP_TTL_MS = Math.max(1, Number(process.env.OTP_TTL_MINUTES || 10)) * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = Math.max(5, Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 30)) * 1000;
const OTP_MAX_VERIFY_ATTEMPTS = Math.max(1, Number(process.env.OTP_MAX_VERIFY_ATTEMPTS || 5));
const OTP_SECRET = String(process.env.OTP_SECRET || "gift-store-dev-otp-secret");

const inMemoryUsers = [];
const pendingSignupOtps = new Map();

const isDbConnected = () => mongoose.connection.readyState === 1;

const toPublicUser = (user) => ({
  name: user.name,
  email: user.email,
  contactNumber: user.contactNumber,
  address: user.address
});

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const validateSignupBody = (body) => {
  const name = String(body.name || "").trim();
  const email = normalizeEmail(body.email);
  const contactNumber = String(body.contactNumber || "").trim();
  const address = String(body.address || "").trim();
  const password = String(body.password || "");

  if (name.length < 2) {
    return "Enter your full name.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Enter a valid email address.";
  }

  if (!/^[0-9+\-()\s]{7,20}$/.test(contactNumber)) {
    return "Enter a valid contact number.";
  }

  if (address.length < 4) {
    return "Enter your address.";
  }

  if (password.trim().length < 4) {
    return "Password must be at least 4 characters.";
  }

  return "";
};

const createPasswordHash = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const verifyPasswordHash = (password, encodedHash) => {
  const parts = String(encodedHash || "").split(":");
  if (parts.length !== 2) {
    return false;
  }

  const [salt, savedHash] = parts;
  const candidateHash = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");

  return crypto.timingSafeEqual(Buffer.from(savedHash, "hex"), Buffer.from(candidateHash, "hex"));
};

const makeOtpCode = () => String(crypto.randomInt(100000, 1000000));

const hashOtp = (email, otp) => {
  return crypto
    .createHash("sha256")
    .update(`${normalizeEmail(email)}|${String(otp)}|${OTP_SECRET}`)
    .digest("hex");
};

const inferSmtpHostFromEmail = (email) => {
  const normalized = String(email || "").trim().toLowerCase();

  if (normalized.endsWith("@gmail.com") || normalized.endsWith("@googlemail.com")) {
    return "smtp.gmail.com";
  }
  if (normalized.endsWith("@outlook.com") || normalized.endsWith("@hotmail.com") || normalized.endsWith("@live.com")) {
    return "smtp.office365.com";
  }
  if (normalized.endsWith("@yahoo.com")) {
    return "smtp.mail.yahoo.com";
  }
  if (normalized.endsWith("@zoho.com")) {
    return "smtp.zoho.com";
  }

  return "";
};

const smtpUser = String(process.env.SMTP_USER || "").trim();//Ensure SMTP_USER is set for OTP email functionality, or it will be disabled. The host will be inferred from this email if SMTP_HOST is not set. 
const smtpHost = String(process.env.SMTP_HOST || inferSmtpHostFromEmail(smtpUser)).trim();// Infer SMTP host from email domain if not explicitly set via SMTP_HOST env var. This allows OTP email functionality to work out-of-the-box with common email providers by just setting SMTP_USER and SMTP_PASS env vars.
const smtpPort = Number(process.env.SMTP_PORT || (smtpHost === "smtp.office365.com" ? 587 : 587)); 

const mailConfig = {
  host: smtpHost,
  port: smtpPort,
  secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
  user: smtpUser,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM || smtpUser || ""
};

const canSendEmail = Boolean(mailConfig.host && mailConfig.port && mailConfig.user && mailConfig.pass && mailConfig.from);

const transporter = canSendEmail
  ? nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.secure,
      auth: {
        user: mailConfig.user,
        pass: mailConfig.pass
      }
    })
  : null;

if (canSendEmail) {
  console.log(`OTP email service enabled (${mailConfig.host}:${mailConfig.port}).`);
} else {
  console.warn("OTP email service not configured. Set SMTP_* vars in backend/.env for real email delivery.");
}

const sendOtpEmail = async ({ email, otp, name }) => {
  if (!canSendEmail || !transporter) {
    console.log(`OTP for ${email}: ${otp}`);
    return false;
  }

  await transporter.sendMail({
    from: mailConfig.from,
    to: email,
    subject: "Your Gift Store verification OTP",
    text: `Hi ${name}, your Gift Store OTP is ${otp}. It expires in ${Math.round(OTP_TTL_MS / 60000)} minutes.`,
    html: `<p>Hi ${name},</p><p>Your Gift Store verification OTP is <strong>${otp}</strong>.</p><p>This OTP will expire in ${Math.round(
      OTP_TTL_MS / 60000
    )} minutes.</p>`
  });

  return true;
};

const findUserByEmail = async (email) => {
  const normalized = normalizeEmail(email);

  if (isDbConnected()) {
    return User.findOne({ email: normalized }).lean().exec();
  }

  return inMemoryUsers.find((item) => item.email === normalized) || null;
};

const createUser = async (data) => {
  if (isDbConnected()) {
    const created = await User.create(data);
    return created.toObject();
  }

  const user = {
    _id: `mem-user-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  inMemoryUsers.unshift(user);
  return user;
};

router.get("/products", async (req, res) => {
  try {
    const data = await Product.find().sort({ createdAt: -1 }).lean().exec();
    return res.json(data);
  } catch (err) {
    console.error("Failed to fetch products:", err.message);
    return res.status(500).json({ error: "Failed to fetch products." });
  }
});

router.post("/products", async (req, res) => {
  try {
    const p = new Product(req.body);
    await p.save();
    return res.json(p);
  } catch (err) {
    console.error("Failed to add product:", err.message);
    return res.status(400).json({ error: "Unable to add product." });
  }
});

router.delete("/products/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    return res.json({ message: "Product deleted" });
  } catch (err) {
    console.error("Failed to delete product:", err.message);
    return res.status(400).json({ error: "Unable to delete product." });
  }
});

router.post("/auth/signup/request-otp", async (req, res) => {
  try {
    const validationError = validateSignupBody(req.body || {});
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    if (!canSendEmail) {
      return res.status(503).json({ error: "Email OTP service is not configured. Please contact support." });
    }

    const email = normalizeEmail(req.body.email);
    const existingUser = await findUserByEmail(email);

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
    const passwordHash = createPasswordHash(req.body.password);

    pendingSignupOtps.set(email, {
      otpHash: hashOtp(email, otp),
      expiresAt: now + OTP_TTL_MS,
      remainingAttempts: OTP_MAX_VERIFY_ATTEMPTS,
      lastSentAt: now,
      payload: {
        name: String(req.body.name || "").trim(),
        email,
        contactNumber: String(req.body.contactNumber || "").trim(),
        address: String(req.body.address || "").trim(),
        passwordHash
      }
    });

    let deliveredToEmail = false;
    try {
      deliveredToEmail = await sendOtpEmail({
        email,
        otp,
        name: String(req.body.name || "Customer").trim() || "Customer"
      });
    } catch (mailErr) {
      console.error("OTP email send failed:", mailErr.message);
      pendingSignupOtps.delete(email);
      return res.status(500).json({ error: "Unable to send OTP email right now." });
    }

    if (!deliveredToEmail) {
      pendingSignupOtps.delete(email);
      return res.status(500).json({ error: "Unable to send OTP email right now." });
    }

    return res.json({
      ok: true,
      message: "OTP sent to your email address.",
      expiresInSeconds: Math.round(OTP_TTL_MS / 1000)
    });
  } catch (err) {
    console.error("Failed to request signup OTP:", err.message);
    return res.status(500).json({ error: "Unable to request OTP right now." });
  }
});

router.post("/auth/signup/verify-otp", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: "Enter a valid 6-digit OTP." });
    }

    const pending = pendingSignupOtps.get(email);
    if (!pending) {
      return res.status(400).json({ error: "No OTP request found for this email. Please request a new OTP." });
    }

    if (Date.now() > pending.expiresAt) {
      pendingSignupOtps.delete(email);
      return res.status(400).json({ error: "OTP has expired. Please request a new OTP." });
    }

    const isOtpValid = pending.otpHash === hashOtp(email, otp);
    if (!isOtpValid) {
      pending.remainingAttempts -= 1;
      if (pending.remainingAttempts <= 0) {
        pendingSignupOtps.delete(email);
        return res.status(400).json({ error: "OTP verification failed too many times. Please request a new OTP." });
      }

      return res.status(400).json({ error: `Invalid OTP. ${pending.remainingAttempts} attempt(s) left.` });
    }

    const alreadyExists = await findUserByEmail(email);
    if (alreadyExists) {
      pendingSignupOtps.delete(email);
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const created = await createUser({
      name: pending.payload.name,
      email: pending.payload.email,
      contactNumber: pending.payload.contactNumber,
      address: pending.payload.address,
      passwordHash: pending.payload.passwordHash,
      emailVerified: true
    });

    pendingSignupOtps.delete(email);

    return res.status(201).json({
      ok: true,
      user: toPublicUser(created)
    });
  } catch (err) {
    console.error("Failed to verify signup OTP:", err.message);
    return res.status(500).json({ error: "Unable to verify OTP right now." });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    if (password.trim().length < 4) {
      return res.status(400).json({ error: "Enter your password." });
    }

    const user = await findUserByEmail(email);
    if (!user || !verifyPasswordHash(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    return res.json({ ok: true, user: toPublicUser(user) });
  } catch (err) {
    console.error("Login failed:", err.message);
    return res.status(500).json({ error: "Unable to login right now." });
  }
});

module.exports = router;
