import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: "Too many requests. Please try again later." }
});

export const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: "Too many requests. Please try again later." }
});