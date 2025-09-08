import { asyncHandler } from '../utils/asyncHandler.js'
import {Apierror} from '../utils/Apierror.js'
import { User } from '../models/user.models.js'
import { uploadOnCloudinary } from '../utils/cloudnary.js'
import { ApiResponse } from '../utils/ApiResponse.js'

const registerUser = asyncHandler( async (req , res ) =>{
    //get user details from frontend 
    // validation -- non empty
    // check if user account is already registered , username , email 
    // check for images , check for avatar user has given or not 
    // upload them to cloudinary , check if multer has successfully uploaded it to cloudinary
    // create user object --- create entry in db
    // remove password and refresh token field from the response
    // check for user creation 
    // return response 
    // else error send 

    const {fullName, email , userName , password } = req.body
    console.log("email : " , email);

    // if(fullName === ""){
    //     throw new Apierror(400 , "Full Name is required ")
    // }

    if(
        [fullName, userName , email , password ].some((field) =>
        field?.trim() === "")
    ){
        throw new Apierror(400 , "All fields are required ")
    }
    

    const existedUser = User.findOne({
        $or : [ { userName } , { email }]
    })

    if(existedUser){
        throw new Apierror(409, " user with email or username already exist ")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;   // local path becoz file on server not yet on cloudinary
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new Apierror(400 ,"Avatar required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new Apierror(400 ,"Avatar required");
    }

    const user = await User.create({
        fullName,
        avatar:avatar.url,
        coverImage : coverImage?.url || "",
        email,
        password,
        userName : userName.toLowerCase(),

    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new Apierror(500, "Something went wrong while registering the user ")
    }

    return res.status(201).json(
        new ApiResponse(200 , createdUser , "User registered succesfully")
    )
})

export { registerUser }