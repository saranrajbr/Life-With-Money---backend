import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "../config/database.js";
import { authLimiter } from "../middleware/rateLimit.js";
import authRoutes from "../routes/authoroutes.js";
import transactionRoutes from "../routes/transactions.js";
import portfolioRoutes from "../routes/portfolio.js";

dotenv.config();

const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin: [
      "https://life-with-money.vercel.app",
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

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/portfolio", portfolioRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({ msg: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ msg: "Server Error" });
});

export default async function handler(req, res) {
  try {
    await connectDB();
  } catch (err) {
    console.error("DB connect error:", err);
    return res.status(503).json({ msg: "Database unavailable" });
  }
  return app(req, res);
}