import mongoose from "mongoose";

const Userschema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String },
    googleid: { type: String },
    salary: { type: Number, default: 0 }
});

export default mongoose.model("User", Userschema);