export const EXPENSE_CATEGORIES = [
  { key: "grocery", label: "Grocery" },
  { key: "food", label: "Food & Dining" },
  { key: "vehicle", label: "Vehicle & Fuel" },
  { key: "transport", label: "Transport" },
  { key: "rent", label: "Rent & Housing" },
  { key: "utilities", label: "Utilities" },
  { key: "shopping", label: "Shopping" },
  { key: "entertainment", label: "Entertainment" },
  { key: "health", label: "Health & Medical" },
  { key: "education", label: "Education" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "other_expense", label: "Other Expense" }
];

export const INCOME_CATEGORIES = [
  { key: "salary", label: "Salary" },
  { key: "income", label: "Income" },
  { key: "pocket_money", label: "Pocket Money" },
  { key: "gift", label: "Gift" },
  { key: "interest", label: "Interest" },
  { key: "other_income", label: "Other Income" }
];

export const TRANSACTION_TYPES = ["income", "expense"];

export function getCategoryLabel(key) {
  const all = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  return all.find((c) => c.key === key)?.label || key;
}

export function isValidCategoryForType(type, category) {
  const list =
    type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  return list.some((c) => c.key === category);
}