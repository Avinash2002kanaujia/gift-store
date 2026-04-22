// api/login.js (Vercel serverless function)
const mongoose = require('mongoose');
const User = require('../backend/models/User');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/giftstore";
const JWT_SECRET = process.env.JWT_SECRET || "gift-store-jwt-secret";

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

function verifyPasswordHash(password, encodedHash) {
  const parts = String(encodedHash || "").split(":");
  if (parts.length !== 2) return false;
  const [salt, savedHash] = parts;
  const candidateHash = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(savedHash, "hex"), Buffer.from(candidateHash, "hex"));
}

module.exports = async (req, res) => {
  await dbConnect();
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  const user = await User.findOne({ email }).lean().exec();
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  if (!verifyPasswordHash(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  // Issue JWT
  const token = jwt.sign({
    _id: user._id,
    email: user.email,
    name: user.name,
    role: user.role || 'user'
  }, JWT_SECRET, { expiresIn: '7d' });
  return res.json({ ok: true, token, user: { _id: user._id, email: user.email, name: user.name } });
};
