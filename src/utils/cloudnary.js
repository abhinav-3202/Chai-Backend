import {v2 as cloudinary} from "cloudinary"
import fs from "fs"

cloudinary.config({
    cloud_name : process.env.CLOUDINARY_CLOUD_NAME,
    api_key : process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) =>{ // check on how this localfile path came
    // i think it came from usercontroller file 
    try {
        if(!localFilePath) return null; 
        // upload file on cloudinary 
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type : "auto"
        })
        // file has been uploaded successfully 
        // console.log("File is uploaded on cloudinary ", response);
        fs.unlinkSync(localFilePath); // file uplaod ho gyi h to bhi remove ho jayegi && error pe bhi remove ho jayegi 
        return response;
    } catch (error) {
        console.error("Cloudinary upload failed:", error);
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed
        return null;
        // in case of fialure we are deleting the file but not in the case of success
        // we have to delte the image in case of success also , but as sir told we will do it later done above return response
    }
}

export { uploadOnCloudinary }