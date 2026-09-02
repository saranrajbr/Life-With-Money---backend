import mongoose from "mongoose";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import connectDB from "./config/database.js";
import { authLimiter } from "./middleware/rateLimit.js";
import authRoutes from "./routes/authoroutes.js";
import transactionRoutes from "./routes/transactions.js";
import portfolioRoutes from "./routes/portfolio.js";

dotenv.config();

connectDB();

const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin: [
      "https://saranrajbr.github.io",
      "http://localhost:5173",
      "http://localhost:3000"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json({ limit: "1mb" }));

// Lightweight health check (no sensitive info)
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/portfolio", portfolioRoutes);

// 404 handler for unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({ msg: "Route not found" });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ msg: "Server Error" });
});

const PORT = process.env.PORT || 2000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;