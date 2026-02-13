import express from "express";
import Budget from "../models/budget.js";
import auth from "../middleware/authmiddleware.js";

const router = express.Router();

// Get all budgets for the specific user
router.get("/", auth, async (req, res) => {
    try {
        const budgets = await Budget.find({ userId: req.user.id });
        res.json(budgets);
    } catch (err) {
        res.status(500).json({ msg: "Server Error" });
    }
});

// Add or Update a budget
// If a budget for a category exists, update it? Or just add new one?
// For simplicity and typical budget behavior: User sets a budget for a category.
// If it exists, update it. If not, create it.
router.post("/", auth, async (req, res) => {
    const { category, amount } = req.body;
    try {
        let budget = await Budget.findOne({ userId: req.user.id, category });

        if (budget) {
            budget.amount = amount;
            await budget.save();
            return res.json(budget);
        }

        budget = new Budget({
            userId: req.user.id,
            category,
            amount
        });

        await budget.save();
        res.json(budget);

    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// Delete a budget
router.delete("/:id", auth, async (req, res) => {
    try {
        let budget = await Budget.findById(req.params.id);

        if (!budget) return res.status(404).json({ msg: "Budget not found" });

        // Make sure user owns budget
        if (budget.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: "Not authorized" });
        }

        await Budget.findByIdAndDelete(req.params.id);
        res.json({ msg: "Budget removed" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

export default router;
