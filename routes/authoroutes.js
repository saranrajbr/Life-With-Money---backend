import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import User from "../models/user.js";

const router=express.Router();
const client=new OAuth2Client(process.env.GOOGLE_CLIENT_ID)


router.post("/register",async (req,res)=>{
    let {email,password}=req.body;
    email=email.toLowerCase().trim();
    const exists=await User.findOne({email});
    if(exists) return res.status(400).json({msg:"user exist"});
    const hashed=await bcrypt.hash(password,9);
    const user=await User.create({email,password:hashed});
    res.json({msg:"Registered"});
});

router.post("/login",async(req,res)=>{
    
    let {email,password}=req.body;
    email=email.toLowerCase().trim();
    const user=await User.findOne({email});
    if(!user) return res.status(400).json({msg:"Error"});
    if (!user.password) return res.status(400).json({msg:"use Google lgin"})
    const pass=await bcrypt.compare(password,user.password);
    if(!pass) return res.status(400).json({msg:"Error"});
    const token=jwt.sign({id:user._id},process.env.JWT_SECRET);
    res.json({token});


});


router.post("/google", async (req, res) => {
    try {

        const { token } = req.body;
        console.log("Token received:", token ? "Yes" : "No");

        if (!token) {
            console.log("No token provided");
            return res.status(400).json({ msg: "Token missing" });
        }

      
        console.log("Fetching user info from Google...");
        
        const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log("Google API response status:", userInfoResponse.status);
        const payload = userInfoResponse.data;
        console.log("User email:", payload.email);
        
        const { email, sub, email_verified } = payload;
        const normalizedEmail=email.toLowerCase().trim();
        if (!normalizedEmail) {
            return res.status(400).json({ msg: "Email not available" });
        }

        if (!email_verified) {
            return res.status(400).json({ msg: "Email not verified by Google" });
        }

        
        let user = await User.findOne({ email:normalizedEmail });
        if (user) {
            if (!user.googleid) {
            user.googleid = sub;
            await user.save();
            }
        } else {
            user = await User.create({ email: normalizedEmail, googleid: sub });
        }
         
        const jwttoken = jwt.sign(
            { id: user._id }, 
            process.env.JWT_SECRET, 
            { expiresIn: "8d" }
        );

        console.log("Login successful for:", email);
        return res.json({ token: jwttoken });

    } catch (error) {
        console.error("Google auth error:");
        console.error("Error message:", error.message);
        console.error("Error response:", error.response?.data);
        console.error("Error status:", error.response?.status);
        
        return res.status(500).json({ 
            msg: "Server error during Google authentication",
            details: error.message 
        });
    }
    

});

export default router;