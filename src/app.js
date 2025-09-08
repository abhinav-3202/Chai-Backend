import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser';

// cookie-parser -->> from my server access user browser cookies and set them also 
const app = express();
app.use(cors({
    origin : process.env.CORS_ORIGIN,
    credentials : true,
}))

app.use(express.json({limit : "16kb"})) // from se jo data aaya 
app.use(express.urlencoded({extended : true , limit : "16kb"})) // url se dta ke liye
app.use(express.static("public")) // storing something at the server in public folder just now created 
app.use(cookieParser())


// router import 

import userRouter from './routes/user.routes.js'


// router declaration 

app.use("/api/v1/users" , userRouter);

// the url created will be .....    http://localhost:8000/api/v1/users/register

export { app }