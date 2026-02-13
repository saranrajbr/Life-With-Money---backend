import express from "express";
import Expense from "../models/expenses.js";
import auth from "../middleware/authmiddleware.js";

const router = express.Router();

router.post("/", auth, async (req, res) => {
    const { date, expenses } = req.body;
    await Expense.findOneAndUpdate(
        { userId: req.user.id, date },
        { $set: { expenses } },
        { upsert: true, new: true }
    );
    res.json({ msg: "saved" });
});

// Get all expenses for validaiton/overview
router.get("/", auth, async (req, res) => {
    try {
        const expenses = await Expense.find({ userId: req.user.id });
        res.json(expenses);
    } catch (err) {
        res.status(500).json({ msg: "Server Error" });
    }
});



router.get("/:date", auth, async (req, res) => {
    const data = await Expense.findOne({
        userId: req.user.id,
        date: req.params.date
    });
    res.json(data || { expenses: [] });
});

export default router;