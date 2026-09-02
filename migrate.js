import mongoose from "mongoose";
import dotenv from "dotenv";
import Expense from "../models/expenses.js";
import Transaction from "../models/transaction.js";

dotenv.config();

const CATEGORY_MAP = {
  grocery: "grocery",
  groceries: "grocery",
  food: "food",
  "food & dining": "food",
  dinner: "food",
  lunch: "food",
  breakfast: "food",
  vehicle: "vehicle",
  fuel: "vehicle",
  petrol: "vehicle",
  diesel: "vehicle",
  gas: "vehicle",
  transport: "transport",
  bus: "transport",
  auto: "transport",
  cab: "transport",
  "auto rickshaw": "transport",
  rent: "rent",
  house: "rent",
  housing: "rent",
  utilities: "utilities",
  electricity: "utilities",
  "electricity bill": "utilities",
  water: "utilities",
  wifi: "subscriptions",
  internet: "subscriptions",
  shopping: "shopping",
  clothes: "shopping",
  entertainment: "entertainment",
  movies: "entertainment",
  health: "health",
  medicine: "health",
  medical: "health",
  pharmacy: "health",
  education: "education",
  books: "education",
  fees: "education",
  subscriptions: "subscriptions",
  subscription: "subscriptions",
  phone: "utilities",
  mobile: "utilities"
};

function mapCategory(original) {
  const key = String(original || "").toLowerCase().trim();
  return CATEGORY_MAP[key] || "other_expense";
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB. Starting migration...");

    const oldExpenses = await Expense.find({}).lean();
    console.log(`Found ${oldExpenses.length} legacy expense records.`);

    let migrated = 0;
    let skipped = 0;

    for (const doc of oldExpenses) {
      if (!doc.userId || !Array.isArray(doc.expenses)) {
        skipped++;
        continue;
      }

      const dateStr = doc.date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        // Unknown format; skip
        skipped++;
        continue;
      }

      for (const item of doc.expenses) {
        const amount = Number(item.amount);
        if (!item.name || !Number.isFinite(amount) || amount <= 0) continue;

        await Transaction.create({
          userId: doc.userId,
          type: "expense",
          category: mapCategory(item.name),
          amount,
          description: `Migrated from legacy: ${item.name}`,
          date: new Date(`${dateStr}T00:00:00`),
          dateStr
        });
        migrated++;
      }
    }

    console.log(`Migration complete. Migrated ${migrated} transactions. Skipped ${skipped} records.`);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from DB.");
  }
}

export { migrate };