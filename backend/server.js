
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
// Security and performance middlewares
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const xss = require("xss-clean");
const mongoSanitize = require("express-mongo-sanitize");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();

// Apply security HTTP headers
app.use(helmet());

// Sanitize user input prevent XSS attacks
app.use(xss());

// Sanitize user input prevent NoSQL injection
app.use(mongoSanitize());

// Apply rate limiting to all API routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, 
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/api", limiter);
const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/giftstore";
const LOCAL_MONGO_URI = "mongodb://127.0.0.1:27017/giftstore";

app.disable("x-powered-by");

const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:3000";

app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: "3mb" }));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    ok: true,
    service: "gift-store-api",
    timestamp: new Date().toISOString(),
    dbReadyState: mongoose.connection.readyState,
    dbConnected: mongoose.connection.readyState === 1
  });
});

// Main API routes
app.use("/api", require("./routes"));

// 404 handler for API routes
app.use("/api/*rest", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const message = err.message || "Unexpected server error";

  if (statusCode >= 500) {
    console.error("Unhandled error:", message, err.stack);
  }

  res.status(statusCode).json({ error: message });
});

// Starts the server and keep API reachable even if DB is temporarily unavailable
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Database connection and reconnection logic
let isReconnectInProgress = false;

const connectToDatabase = async (uri, label) => {
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000
    });
    console.log(`DB connected (${label})`);
    return true;
  } catch (err) {
    console.error(`MongoDB connection failed (${label}):`, err.message);
    return false;
  }
};

(async () => {
  const primaryOk = await connectToDatabase(MONGO_URI, "primary");
  if (!primaryOk && MONGO_URI !== LOCAL_MONGO_URI) {
    await connectToDatabase(LOCAL_MONGO_URI, "local-fallback");
  }
})();

const attemptReconnect = async () => {
  if (mongoose.connection.readyState === 1 || isReconnectInProgress) {
    return;
  }
  isReconnectInProgress = true;
  try {
    const primaryOk = await connectToDatabase(MONGO_URI, "reconnect-primary");
    if (!primaryOk && MONGO_URI !== LOCAL_MONGO_URI) {
      await connectToDatabase(LOCAL_MONGO_URI, "reconnect-local-fallback");
    }
  } finally {
    isReconnectInProgress = false;
  }
};

const reconnectTimer = setInterval(attemptReconnect, 15000);

mongoose.connection.on("connected", () => {
  console.log("MongoDB connection is active.");
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected. Reconnect loop will retry automatically.");
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`${signal} received. Closing server...`);
  clearInterval(reconnectTimer);
  server.close(() => {
    mongoose.connection.close(false).finally(() => {
      process.exit(0);
    });
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));