const asyncHandler = (requestHandler)=>{
    (req,res,next) =>{
        Promise.resolve(requestHandler(req,res,next)).catch((Error) => next(error))
    }
}

export { asyncHandler }



// const asyncHandler = ()  => {}
// const asyncHandler = (func) => ( ) => {}
// const asyncHandler = (func) => async () => {}

// const asyncHandler = (fn) => async (req,res,next) => {
//     try {
//         await fn(req,res,next)
//     } catch (error) {
//         res.status(error || 500 ).json({
//             success:false,
//             message:error.message,
//         })
//     }
// }