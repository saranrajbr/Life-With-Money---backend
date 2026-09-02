import express from "express";
import mongoose from "mongoose";
import Transaction from "../models/transaction.js";
import auth from "../middleware/authmiddleware.js";
import { getRange, RANGE_TYPES } from "../utils/dateRange.js";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  TRANSACTION_TYPES,
  isValidCategoryForType
} from "../config/constants.js";

const router = express.Router();

const toDateStr = (d) => new Date(d).toISOString().slice(0, 10);

router.get("/categories", auth, (req, res) => {
  res.json({
    expense: EXPENSE_CATEGORIES,
    income: INCOME_CATEGORIES,
    types: TRANSACTION_TYPES
  });
});

router.get("/", auth, async (req, res) => {
  try {
    const { range = "all", dateStr, type } = req.query;

    if (!RANGE_TYPES.includes(range)) {
      return res.status(400).json({ msg: "Invalid range" });
    }

    let query = { userId: new mongoose.Types.ObjectId(req.user.id) };
    if (type && TRANSACTION_TYPES.includes(type)) query.type = type;

    let rangeBounds = null;
    try {
      rangeBounds = getRange({ range, dateStr });
    } catch (e) {
      return res.status(400).json({ msg: "Invalid date or range" });
    }

    const [{ transactions, summary, categories }] = await Transaction.aggregate([
      { $match: { ...query, date: { $gte: rangeBounds.start, $lte: rangeBounds.end } } },
      {
        $facet: {
          transactions: [{ $sort: { date: -1 } }, { $limit: 500 }],
          summary: [
            {
              $group: {
                _id: null,
                totalIncome: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
                totalExpense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
                count: { $sum: 1 }
              }
            }
          ],
          categories: [
            {
              $group: {
                _id: { type: "$type", category: "$category" },
                amount: { $sum: "$amount" }
              }
            }
          ]
        }
      }
    ]);

    const summaryRow = summary[0] || { totalIncome: 0, totalExpense: 0, count: 0 };
    const categoryMap = { income: {}, expense: {} };
    categories.forEach((c) => {
      categoryMap[c._id.type][c._id.category] = c.amount;
    });

    res.json({
      range,
      rangeBounds: { start: rangeBounds.start.toISOString(), end: rangeBounds.end.toISOString() },
      transactions,
      summary: {
        totalIncome: summaryRow.totalIncome,
        totalExpense: summaryRow.totalExpense,
        net: summaryRow.totalIncome - summaryRow.totalExpense,
        count: summaryRow.count
      },
      categories: categoryMap
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const {
      type,
      category,
      amount,
      description = "",
      date,
      dateStr
    } = req.body;

    if (!type || !TRANSACTION_TYPES.includes(type)) {
      return res.status(400).json({ msg: "Type must be income or expense" });
    }
    if (!category || !isValidCategoryForType(type, category)) {
      return res.status(400).json({ msg: `Invalid category for type '${type}'` });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ msg: "Amount must be a positive number" });
    }
    if (!date && !dateStr) {
      return res.status(400).json({ msg: "Date is required" });
    }

    const parsedDate = date
      ? new Date(date)
      : new Date(`${dateStr}T00:00:00.000Z`);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ msg: "Invalid date" });
    }

    const tx = await Transaction.create({
      userId: req.user.id,
      type,
      category,
      amount: amt,
      description,
      date: parsedDate,
      dateStr: toDateStr(parsedDate)
    });

    res.status(201).json(tx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const tx = await Transaction.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });
    if (!tx) return res.status(404).json({ msg: "Transaction not found" });
    res.json({ msg: "Transaction removed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

export default router;