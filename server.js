import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cursor from "./config/database.js";
import authRoutes from "./routes/authoroutes.js"
import expenseRoutes from "./routes/expense.js"


dotenv.config();
cursor();

const app = express();
app.use(cors({
    origin: ['https://saranrajbr.github.io', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Add this TEMPORARY route to check env variables
app.get("/api/test-env", (req, res) => {
    res.json({
        googleClientIdExists: !!process.env.GOOGLE_CLIENT_ID,
        googleClientIdPrefix: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 10) + '...' : null,
        jwtSecretExists: !!process.env.JWT_SECRET,
        port: process.env.PORT
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/expense", expenseRoutes);
import budgetRoutes from "./routes/budget.js";
app.use("/api/budget", budgetRoutes);
app.listen(2000, () => console.log("server running"));
