import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params

  if (!isValidObjectId(videoId)){
    throw new ApiError(400,"Invalid videoId")
  }

  const userId = req.user._id;

  const existingLike = await Like.findOne({
    video: videoId,
    likedBy: userId
  })

  if(existingLike){
    await Like.findByIdAndDelete(existingLike._id)

    return res.status(200
        .json(new ApiResponse(200, {liked: false}, "video unliked successfully"))
    )
  }
  const like = await Like.create({
               
              video: videoId,
              likedBy: userId
  })
  return res.status(200)
  .json(new ApiResponse (200, {liked: true, like}, "video liked successfully"))

})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    
    if(!isValidObjectId(commentId)){
        throw new ApiError(400, "Invalid commentId")
    }

     const userId = req.user._id;

     const existingcommentLike = await Like.findOne({
         
         comment: commentId,
         user: userId
     })
     if(existingcommentLike){
        await Like.findByIdAndDelete(existingcommentLike._id)

        return res.status(200)
        .json(new ApiResponse(
            200, {liked: false}, "comment unliked successfully"
        ));
    }
        const like = await Like.create({
            comment: commentId,
            user: userId
        });
        return res.status(200)
        .json(new ApiResponse(200, {liked: true, like}, "comment liked successfully"))
     
});

const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params
  
 if(!isValidObjectId(tweetId)){
   throw new ApiError (400, "invalid tweetId")
 }

  const userId = req.user._id;

  const existingtweetLike = await Like.findOne({
       
       tweet: tweetId,
       user: userId
  });

  if(existingtweetLike){
    await Like.findByIdAndDelete(existingtweetLike._id)
    return res.status(200)
    .json(new ApiResponse(200, {liked: false}, "tweet unliked successfully"))
  }
    
  const like = await Like.create({
      
      tweet: tweetId,
      user: userId
  });

  return res.status(200)
  .json(new ApiResponse(
    200, {liked: true, like}, "tweet liked successfully"
  ))
}
)

const getLikedVideos = asyncHandler(async (req, res) => {
    
   const userId = req.user._id; 

    if (!isValidObjectId(userId)) {
        throw new ApiError(404, "user not found");
    }

      const likedVideoAggregate = await Like.aggregate([
    {
      $match: {
        likedBy: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "likedVideo",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "ownerDetails",
            },
          },
          {
            $unwind: "$ownerDetails",
          },
        ],
      },
    },
    {
      $unwind: "$likedVideo",
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {

        _id: 0,

        likedVideo: {
          _id: 1,
          "videoFile.url": 1,
          "thumbnail.url": 1,
          owner: 1,
          title: 1,
          description: 1,
          views: 1,
          duration: 1,
          createdAt: 1,
          isPublished: 1,

          ownerDetails: {

            username: 1,
            fullName: 1,
            avatar: 1,
          },
        },
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        likedVideoAggregate,
        "Liked video fetched successfully"
      )
    );
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}