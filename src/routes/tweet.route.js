import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getAllTweets, createTweet, deleteTweet, getUserTweets, updateTweet } from "../controllers/tweet.controller.js";
import { upload } from "../middlewares/multer.middleware.js";



const router=Router()

router.use( upload.none())
router.use(verifyJWT);

router.route("/create-tweet").post( createTweet )
router.route("/alltweets/user/:userId").get( getAllTweets );
router.route("/user/:userId").get( getUserTweets )
router.route("/:tweetId").patch( updateTweet ).delete( deleteTweet )


export default router