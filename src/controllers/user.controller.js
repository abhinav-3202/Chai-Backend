import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/Apierror.js'
import { User } from '../models/user.models.js'
import { uploadOnCloudinary } from '../utils/cloudnary.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import cookieParser from 'cookie-parser'
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

export { 
    registerUser,
    loginUser,
    logoutUser,
}