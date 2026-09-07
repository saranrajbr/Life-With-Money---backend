import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import User from "../models/user.js";
import auth from "../middleware/authmiddleware.js";
import { sendPasswordResetEmail } from "../utils/mailer.js";

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const normalizeEmail = (email) => String(email || "").toLowerCase().trim();
const signToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "8d" });

const isValidPassword = (pw) =>
  typeof pw === "string" && pw.length >= 6;

function publicUser(user) {
  return {
    _id: user._id,
    email: user.email,
    googleid: user.googleid,
    salary: user.salary,
    hasPassword: Boolean(user.password)
  };
}

router.post("/register", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ msg: "Valid email is required" });
    }
    if (!password || !isValidPassword(password)) {
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
    } catch (verifyErr) {
      // The frontend sends an id_token via @react-oauth/google. If verification
      // fails here, it is almost always an audience/client-id mismatch on the
      // server. Only fall back to the userinfo exchange for actual access tokens.
      const looksLikeIdToken = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
      if (looksLikeIdToken) {
        console.error("Google id_token verification failed:", verifyErr.message, {
          configuredAudience: process.env.GOOGLE_CLIENT_ID
        });
        return res.status(401).json({ msg: "Google id_token could not be verified. Check the server GOOGLE_CLIENT_ID matches the frontend VITE_GOOGLE_CLIENT_ID." });
      }
      // Legacy fallback: treat as access token
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
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json(publicUser(user));
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
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    user.salary = salary;
    await user.save();
    res.json(publicUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Request a password reset link (emailed to the account)
router.post("/forgot-password", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ msg: "Email is required" });

    const user = await User.findOne({ email });
    // Always return the same message to avoid leaking which emails exist
    if (!user) {
      return res.json({ ok: true, msg: "If that email exists, a reset link has been sent." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = resetToken;
    user.resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await user.save();

    const origin = process.env.FRONTEND_URL || "https://life-with-money.vercel.app";
    const resetUrl = `${origin}/#/reset-password?token=${resetToken}`;
    await sendPasswordResetEmail({ to: user.email, resetUrl });

    res.json({ ok: true, msg: "If that email exists, a reset link has been sent." });
  } catch (err) {
    console.error("Forgot password error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Complete the reset with a token + new password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token) return res.status(400).json({ msg: "Reset token is required" });
    if (!isValidPassword(password)) {
      return res.status(400).json({ msg: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    });
    if (!user) {
      return res.status(400).json({ msg: "Reset link is invalid or has expired" });
    }

    user.password = await bcrypt.hash(password, 12);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ ok: true, msg: "Password updated. You can now sign in." });
  } catch (err) {
    console.error("Reset password error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Logged-in user changes their own password (email+password accounts)
router.put("/change-password", auth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ msg: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (!user.password) {
      return res.status(400).json({ msg: "This account has no password. Use 'Set password' instead." });
    }

    const ok = await bcrypt.compare(oldPassword || "", user.password);
    if (!ok) return res.status(401).json({ msg: "Current password is incorrect" });

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ ok: true, msg: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Google-only accounts can add a password so they can sign in with email/password too
router.put("/set-password", auth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!isValidPassword(password)) {
      return res.status(400).json({ msg: "Password must be at least 6 characters" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (user.password) {
      return res.status(400).json({ msg: "This account already has a password" });
    }

    user.password = await bcrypt.hash(password, 12);
    await user.save();
    res.json({ ok: true, msg: "Password set successfully. You can now sign in with email & password." });
  } catch (err) {
    console.error("Set password error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

export default router;