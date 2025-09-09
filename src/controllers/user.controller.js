import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/Apierror.js'
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

    const {fullName, email , userName , password } = req.body// json me data aata h isse 
    console.log("email : " , req.body);

    // if(fullName === ""){
    //     throw new Apierror(400 , "Full Name is required ")
    // }

    if(
        [fullName, userName , email , password ].some((field) =>  // field is just a variable
        field?.trim() === "") // trim sayad hta dena
    ){
        throw new ApiError(400 , "All fields are required ")
    }
    

    const existedUser = await User.findOne({
        $or : [{ userName } , { email }]  // imported user , koi ek mil gya then $or return true
    })  // $ or check for every object in the array 

    if(existedUser){
        throw new ApiError(409, " user with email or username already exist ")
    }

    // console.log(req.files);
    

    const avatarLocalPath = req.files?.avatar[0]?.path;   // local path becoz file on server not yet on cloudinary
    // const coverImageLocalPath = req.files?.coverImage[0]?.path; // files wala access multer middleware se aata h 
    // In Node.js + Express, when you upload files (using libraries like multer), the uploaded files are attached to req.files.

    let coverImageLocalPath;

    if(req.files && Array.isArray(req.files.coverImage)&& req.files.coverImage.length > 0 ){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400 ,"Avatar required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400 ,"Avatar required");
    } // because avatar is a req field...

    const user = await User.create({ // here User is talking to the db so directly yha pe upload ho rhi db me items 
        fullName,
        avatar:avatar.url,
        coverImage : coverImage?.url || "",
        email,
        password,
        userName : userName.toLowerCase(),

    })

    const createdUser = await User.findById(user._id).select( // .select me jo fields likhe h wo select nnhi honge
        "-password -refreshToken" // _id -->> mongodb automatically adds it to every user
    )

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user ")
    }

    return res.status(201).json(
        new ApiResponse(200 , createdUser , "User registered succesfully")
    )
})

export { registerUser }