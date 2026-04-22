const mongoose = require("mongoose");

const pendingSignupOtpSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  remainingAttempts: { type: Number, required: true },
  lastSentAt: { type: Date, required: true },
  payload: { type: Object, required: true },
}, { timestamps: true });

module.exports = mongoose.models.PendingSignupOtp || mongoose.model("PendingSignupOtp", pendingSignupOtpSchema);
