import mongoose from "mongoose";
import { isValidCategoryForType } from "../config/constants.js";

const TransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ["income", "expense"],
      required: true
    },
    category: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: [0, "Amount cannot be negative"]
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, "Description too long"],
      default: ""
    },
    date: {
      type: Date,
      required: true,
      index: true
    },
    dateStr: {
      type: String,
      required: true,
      index: true,
      match: /^\d{4}-\d{2}-\d{2}$/
    }
  },
  { timestamps: true }
);

TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ userId: 1, dateStr: 1 });

TransactionSchema.pre("validate", function () {
  if (!isValidCategoryForType(this.type, this.category)) {
    throw new Error(`Invalid category "${this.category}" for type "${this.type}"`);
  }
});

TransactionSchema.post("validate", function () {
  if (this.date instanceof Date && !isNaN(this.date)) {
    this.dateStr = this.date.toISOString().slice(0, 10);
  }
});

export default mongoose.model("Transaction", TransactionSchema);