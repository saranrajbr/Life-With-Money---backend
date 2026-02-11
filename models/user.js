import mongoose from "mongoose";

const Userschema=new mongoose.Schema({
    email:{type:String,required:true,unique:true},
    password:{type:String},
    googleid:{type:String}
});

export default mongoose.model("User",Userschema);