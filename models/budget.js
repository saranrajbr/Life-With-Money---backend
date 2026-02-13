import mongoose from "mongoose";

const BudgetSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now } // Optional: to track when budget was set
});

export default mongoose.model("Budget", BudgetSchema);
