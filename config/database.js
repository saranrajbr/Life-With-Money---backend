import mongoose from "mongoose";

const cursor=async()=>{
    try{
        await mongoose.connect(process.env.MONGO_URI);
        console.log("db connected")

    }catch(err){
        console.error(err);
        process.exit(1)
    }
};


export default cursor;