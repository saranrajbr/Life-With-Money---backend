import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import User from "../models/user.js";
import auth from "../middleware/authmiddleware.js";

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const normalizeEmail = (email) => String(email || "").toLowerCase().trim();
const signToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "8d" });

router.post("/register", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ msg: "Valid email is required" });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ msg: "Password must be at least 6 characters" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ msg: "An account with this email already exists" });

    const hashed = await bcrypt.hash(password, 12);
    await User.create({ email, password: hashed });
    res.status(201).json({ msg: "Registered successfully" });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ msg: "Invalid credentials" });
    if (!user.password) return res.status(400).json({ msg: "This account uses Google sign-in" });

    const pass = await bcrypt.compare(password, user.password);
    if (!pass) return res.status(401).json({ msg: "Invalid credentials" });

    res.json({ token: signToken(user) });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

router.post("/google", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ msg: "Token missing" });
    }

    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      payload = ticket.getPayload();
    } catch {
      // Fallback to userinfo exchange for access tokens (used by the legacy UI flow)
      const userInfoResponse = await axios.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      payload = userInfoResponse.data;
    }

    const { email: rawEmail, sub, email_verified } = payload;
    const email = normalizeEmail(rawEmail);
    if (!email) return res.status(400).json({ msg: "Email not available from Google" });
    if (!email_verified) return res.status(400).json({ msg: "Email not verified by Google" });

    let user = await User.findOne({ email });
    if (user) {
      if (!user.googleid) {
        user.googleid = sub;
        await user.save();
      }
    } else {
      user = await User.create({ email, googleid: sub });
    }

    res.json({ token: signToken(user) });
  } catch (error) {
    console.error("Google auth error:", error.message);
    res.status(500).json({ msg: "Server error during Google authentication" });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json(user);
  } catch {
    res.status(500).json({ msg: "Server Error" });
  }
});

router.put("/salary", auth, async (req, res) => {
  try {
    const salary = Number(req.body.salary);
    if (!Number.isFinite(salary) || salary < 0) {
      return res.status(400).json({ msg: "Salary must be a non-negative number" });
    }
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { salary },
      { new: true }
    ).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

export default router;