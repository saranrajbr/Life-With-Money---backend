import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import User from "../models/user.js";

const router=express.Router();
const client=new OAuth2Client(process.env.GOOGLE_CLIENT_ID)


router.post("/register",async (req,res)=>{
    const {email,password}=req.body;
    const exists=await User.findOne({email});
    if(exists) return res.status(400).json({msg:"user exist"});
    const hashed=await bcrypt.hash(password,9);
    const user=await User.create({email,password:hashed});
    res.json({msg:"Registered"});
});

router.post("/login",async(req,res)=>{
    const {email,password}=req.body;
    const user=await User.findOne({email});
    if(!user) return res.status(400).json({msg:"Error"});
    const pass=await bcrypt.compare(password,user.password);
    if(!pass) return res.status(400).json({msg:"Error"});
    const token=jwt.sign({id:user._id},process.env.JWT_SECRET);
    res.json({token});
});


router.post("/google",async(req,res)=>{
try{
console.log("📥 Google auth endpoint hit");
    console.log("🔑 GOOGLE_CLIENT_ID exists:", !!process.env.GOOGLE_CLIENT_ID);

    const {token}=req.body;
    if(!token){
        console.log("❌ No token provided");

        return res.status(400).json({msg:"Token missing"});
    }
    const ticket=await client.verifyIdToken({
        idToken:token,
        audience:process.env.GOOGLE_CLIENT_ID
    });

    const payload=ticket.getPayload();
    if (!payload){


        console.log("❌ No payload from token");


        return res.status(400).json({msg:"Invalid token payload"})
    }
    const {email,sub,email_verified}=payload;

    console.log("✅ Token verified for email:", email);
        console.log("📧 Email verified:", email_verified);

    if(!email){res.status(400).json({msg:"Email not available"})}
    
    if(!email_verified){res.status(400).json({msg:"Email not verified by google"})};
    let user=await User.findOne({email});
    if(!user){
        user=await User.create({email,googleid:sub});
    }

    const jwttoken=jwt.sign({id:user._id},process.env.JWT_SECRET,{expiresIn:"8d"});

    console.log("✅ Login successful for:", email);

    res.json({token:jwttoken});
}catch (error) {
        console.error("❌ Google auth error:", error.message);
        if (error.message.includes("audience")) {
            return res.status(400).json({ msg: "Invalid Google Client ID configuration" });
        }
        return res.status(500).json({ msg: "Server error during Google authentication" });
    }
});

export default router;