import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/Apierror.js'
import { User } from '../models/user.models.js'
import { uploadOnCloudinary } from '../utils/cloudnary.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import cookieParser from 'cookie-parser'
import jwt from "jsonwebtoken"; 
import mongoose from 'mongoose'
 // error might be in line 176 because accidently pressed backspace dont know if anything happpened or not 
const generateAccessAndRefreshTokens = async (userId) =>{
    try {
        const user = await User.findById(userId);
        const refreshToken = user.generateRefreshToken()
        const accessToken = user.generateAccessToken()
        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave : false }) // taaki baaki models na kick in ho jaaye mongoose user ke 
        // because here sirf refresh tokens save karne ko keh rhe baki fields nhi h save karne ke liye 

        return {accessToken , refreshToken}

    } catch (error) {
        throw new ApiError(500 , "Something went wrong while generating access and refresh tokens")
    }
}

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
    

    // the below line of code for coverImageLocalPath wont work if there is no values or empty and give error becasue we are not checking whether  
    //  the filepath is present or not , just extracting it ... so it will show error as cannot read properties from undefined
    // better to check from another way 

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

const loginUser = asyncHandler( async (req,res)=>{
    // take userName and password as input 
    // check if both fields have characters non-empty
    // check with DB if both fields exist 
    // if not give user notification of incorrect credentials 
    // if entry matches with DB then give user an access token which expires in 10 min 
    //   +++++++++++++++++++++++++ sir's todos ++++++++++++++++++++++++
    // req.body se data 
    // username / email based login 
    // find the user 
    // password check 
    // access and refresh token 
    // send these token in secure cookies
    // at the end send res that successfully logined

    const {email , userName , password } = req.body

    if(!userName || !email ){
        throw new ApiError(400, "userName or email is required ")
    }

    const user = await User.findOne({
        $or : [{userName} , {email}]
    })

    if(!user){
        throw new ApiError(404 , "user does not exist " )
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401 , "Invalid user credentials Password is incorrect " )
    }

    const {accessToken , refreshToken} = await generateAccessAndRefreshTokens(user._id);

    // after here the user at line 127 does not have access to refreshTokens as it is empty and now will be as the 
    // call for accessToken and refreshToken was made after user has been called .
    // so here we have two options either to call DB once again and (OR) to update the previous user .
    // Here we have to decide whether calling DB once again will be an expensive option or not ...
    // Here we are doing it by calling the backend query ...

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    // DB wale User me update krna refreshtokens
    
    // now generating cookies 
    // these are options being generated for assisting cookies 
    const options = { 
        httpOnly : true,
        secure : true // through this only modifiable from server
    }

    return res
    .status(200)
    .cookie("accessToken" , accessToken , options)
    .cookie("refreshToken" , refreshToken , options)
    .json(
        new ApiResponse(
            200,
            {
                user : accessToken,refreshToken, loggedInUser // already saved in cookie then why again sending 
                // because user might be willing to save those maybe developing mobile app then 
            },
            "User loggedIn successfully"
        )
    )

})

const logoutUser = asyncHandler( async(req, res) =>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set : {
                refreshToken : undefined,
            }
        },
        {
            new : true
        }
    )
    const options = { 
        httpOnly : true,
        secure : true ,
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken" ,options)
    .json(new ApiResponse(200 , {} , "User logged Out"))
} )

const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401 , "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify( incomingRefreshToken , process.env.REFRESH_TOKEN_SECRET )
    
        /*jwt.verify() guarantees authenticity and validity of the token itself,
        but not authorization or current legitimacy of the user/session.*/
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401 , "invalid refresh token ")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401 , "Refresh Token is expired or used")
        }
    
        const options={
            httpOnly:true,
            secure : true,
        }
    
        const {accessToken , refreshToken } = await generateAccessAndRefreshTokens(user._id);
    
        return res
        .status(200)
        .cookie("accessToken",accessToken , options)
        .cookie("refreshToken",refreshToken,options)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken,
                    refreshToken : refreshToken
                },
                "Access Token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token ")
    }
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{

    const {oldPassword , newPassword} = req.body
    
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid Old Password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave : false})

    return res
    .status(200)
    .json(new ApiResponse(200 , {} , "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200 , req.user , "Current user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullName , email } = req.body
    if(!fullName && !email){
        throw new ApiError(400 , "All fields are required")
    }
    
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName:fullName,
                email:email
            }
        },
        {new : true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200 , user , "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async (req,res)=>{
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new ApiError(400,"Error while uploading the avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar : avatar.url
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200 , user , "Avatar updated successfully"))
})

const updateUserCoverImage = asyncHandler(async (req,res)=>{
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover Image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading the Cover Image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage : coverImage.url
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200 , user , "Cover Image updated successfully"))
})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
    const {username} = req.params

    if (!username?.trim()) {
        throw new ApiError(400 , "Username is missing")
    }

    const channel = await User.aggregate([
        {
           $match:{
                username:username?.toLowerCase()
           } 
        },
        {
            $lookup:{
                from: "subscriptions",
                localField:"_id",
                foreignField : "channel",
                as:"subscribers"
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField : "subscriber",
                as:"subscribedTo"
            }
        },
        {
            $addFields :{
                subscribersCount:{
                    $size:"$subscribers"
                },
                channelsSubscribedToCount:{
                    $size:"$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if: { $in : [req.user?._id , "$subscribers.subscriber"]},
                        then:true,
                        else : false 
                    }
                }
            }
        },
        {
            $project:{
                fullName:1,
                username : 1,
                subscribersCount : 1,
                channelsSubscribedToCount: 1,
                isSubscribed : 1,
                avatar : 1 , 
                coverImage:1,
                email:1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404,"Channel does not exist")
    }

    return res
    .status(200)
    .json(new ApiResponse(200,channel[0] , "user channel fetched successfully"))
})

const getWatchHistory = asyncHandler(async(req,res)=>{
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)  // pipelines ka code as it is jaata h so objectid create karni padti h 
            }
        },
        {
            $lookup:{
                from:"videos",
                localField : "watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline :[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullName:1,
                                        userName:1,
                                        avatar:1,
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(new ApiResponse(
        200, 
        user[0].watchHistory,
        "Watch History fetched successfully"
    ))
})

export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}