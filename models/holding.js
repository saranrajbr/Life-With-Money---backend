import mongoose from "mongoose";

const PortfolioHoldingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 10
    },
    name: {
      type: String,
      trim: true,
      maxlength: 120,
      default: ""
    },
    type: {
      type: String,
      enum: ["stock", "mutual_fund", "crypto", "other"],
      default: "stock"
    },
    lots: [
      {
        qty: {
          type: Number,
          required: true,
          min: 0
        },
        buyPrice: {
          type: Number,
          required: true,
          min: 0
        },
        buyDate: {
          type: Date,
          required: true,
          default: Date.now
        },
        _id: false
      }
    ],
    avgBuyPrice: {
      type: Number,
      default: 0
    },
    totalQty: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

PortfolioHoldingSchema.index({ userId: 1, symbol: 1 }, { unique: true });

PortfolioHoldingSchema.pre("save", function () {
  const qty = this.lots.reduce((s, l) => s + l.qty, 0);
  const cost = this.lots.reduce((s, l) => s + l.qty * l.buyPrice, 0);
  this.totalQty = qty;
  this.avgBuyPrice = qty > 0 ? cost / qty : 0;
});

export default mongoose.model("Holding", PortfolioHoldingSchema);