import mongoose from "mongoose";

const Expenseschema=mongoose.Schema({
    userId:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
    date:{type:String},
    expenses:[{
        name:String,
        amount:Number
    }]
});

export default mongoose.model("Expense",Expenseschema);

