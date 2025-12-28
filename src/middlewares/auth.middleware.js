import { User } from "../models/user.models";
import { ApiError } from "../utils/Apierror";
import { asyncHandler } from "../utils/asyncHandler";
import jwt from "jsonwebtoken";
// this method will check whether user is there or not OR logged in at present or not 

// if after verification of access and refresh token we got correct user then add a object in req.body named as req.user

export const verifyJWT = asyncHandler(async(req,res,next)=>{
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","")
        // ? because maybe cookie not present as is not there in the case of mobile apps (no cookies are present there)
        // maybe user had sent a custom header
    
    
        if(!token ){
            throw new ApiError(401 , " Unauthorized request ")
        }
        // if token present then with the help of jwt we have check if token is correct & to verify what info token has 
        
        const decodedToken = jwt.verify(token , process.env.ACCESS_TOKEN_SECRET)
        /* decodedToken me wo saare fields rhenge jab JWT token form hua tha jwt.sign() method se in 
           generateAccessToken me then uske response me jo jo data aaya tha wo decoded token me aa jayega */ 
    
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
        //._id from User.models.js file  in this function userSchema.methods.generateAccessToken
    
        if(!user){
            // NEXT_VIDEO : frontend
            throw new ApiError(401, "Invalid Access Token")
        }
    
        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(401 , error?.message || "Invalid AccessToken")
    }


})
