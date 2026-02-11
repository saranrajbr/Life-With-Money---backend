import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cursor from "./config/database.js";
import authRoutes from "./routes/authoroutes.js"
import expenseRoutes from "./routes/expense.js"


dotenv.config();
cursor();

const app=express();
app.use(cors({
    origin:'saranrajbr.github.io/Life-With-Money/',
    credentials:true,
    methods:['GET','POST','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json());

app.use("/api/auth",authRoutes);
app.use("/api/expense",expenseRoutes);
app.listen(2000,()=>console.log("server running"));
