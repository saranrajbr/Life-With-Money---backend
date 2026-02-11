import jwt from "jsonwebtoken";


export default function (req,res,next){
    const head=req.headers.authorization;
    if(!head) return res.status(401).json({msg:"No token"});
    const parts =head.split(' ');
    if(parts.length!==2){
        return res.status(401).json({msg:"Token error"});

    }
    const [schema,token]=parts;

    if (!/^Bearer$/i.test(schema)){
        return res.status(401).json({msg:"token malformatted"});
    }

    if(!token) return res.status(401).json({msg:"Error"})
        
    try{
        const decode=jwt.verify(token,process.env.JWT_SECRET);
        req.user=decode
        next();

    }catch{
        res.status(401).json({msg:"Error"});
    }
}