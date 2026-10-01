import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import { Like } from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    
 const { content } = req.body;

 if (!content || content.trim() === ""){
    throw new ApiError(400, "Content required")
 }

 let tweet = await Tweet.create({
     content: content.trim(),
     owner: req.user._id
 })

 if(!tweet){
    throw new ApiError(500, "Failed to create tweet")
 }

 return res
 .status(200)
 .json( new ApiResponse (
    201, tweet, "Tweet created successfully"
 ))

})

const getUserTweets = asyncHandler(async (req, res) => {
        const { userId } = req.params
        const { page = 1, limit = 5 } = req.query;

  if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user id");
    }

    const user = await User.findById(userId)

    if (!user) {
        throw new ApiError(404, "User not found")
    }

         const options = {
        page: parseInt(page),
        limit: parseInt(limit),
    };

  const tweets = await Tweet.aggregate([
     {
        $match: {
            owner: new mongoose.Types.ObjectId(userId),
        }
     },
     {
        $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "ownerDetails",
            
            pipeline: [
                {
                    $project: {
                        username: 1,
                        avatar: 1
                    }
                }
            ]

        }
     },
     {
        $addFields: {
            owner: {
                $first: "$ownerDetails",
            },
        }
     },
     {
        $lookup: {
            from: "likes",
            localField: "_id",
            foreignField: "tweet",
            as: "likes"
        }
     },
     {
        $addFields: {
            likesCount: {
                $size: {
                    $filter: {
                        input: "likes",
                        as: "1",
                        cond: { $eq: ["$$l.type", "like"] },
                    }
                }
            },
            
                dislikesCount: {
                    $size: {
                        $filter: {
                            input: "likes",
                            as: "1",
                            cond:  { $eq: ["$$l.type", "dislike"] },
                        }
                    }
                },
                isLiked: {
                    $in: [
                        new mongoose.Types.ObjectId(req.user._id),
                        {
                            $map: {
                                input: {
                                  $filter: {
                                    input: "$likes",
                                    as: "1",
                                    cond: { $eq: ["$$l.type", "like"] },
                                  }
                                },
                                as: "1",
                                in: "$$1.likedBy",
                            }
                        }
                    ]
                },
                isDisLiked: {
                    $in: [
                        new mongoose.Types.ObjectId(req.user._id),
                        {
                            $map: {
                                input: {
                                    $filter: {
                                        input: "$likes",
                                        as: "1",
                                        cond: { $eq: ["$$l.type", "dislike"] },
                                    }
                                },
                                as: "1",
                                in: "$$l.likedBy"
                            }
                        }
                    ]
                }
            }
        },
        {
            $sort: {
                createdAt: -1,
            },
        },
   {
        $project: {

        content: 1,
        owner: 1,
        createdAt: 1,
        updatedAt: 1,
        likesCount: 1,
        dislikesCount: 1,
        isLiked: 1,
        isDisLiked: 1,
        }
     }
  ]);

   return res
    .status(200)
    .json(new ApiResponse(200, tweets, "Here is Your tweets"));

});

const updateTweet = asyncHandler(async (req, res) => {
    
  const { tweetId } = req.params;
    const { content } = req.body;

    if (!content) {
        throw new ApiError(400, "content is required");
    }

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet id");
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(tweetId,
        {
            $set: {
                content
            }
        }, { new: true }
    )

    if (!updatedTweet) {
        throw new ApiError(400, "Tweet not found")
    }

    return res.status(200).json(new ApiResponse(200, updatedTweet, "Tweet updated Successfully"))

})

const deleteTweet = asyncHandler(async (req, res) => {
    
    const { tweetId } = req.params;

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet id");
    }

    const tweetdelete = await Tweet.findByIdAndDelete(tweetId)

    await Like.deleteMany({ tweet: tweetId});

    if (!tweetdelete) {
        throw new ApiError(400, "Tweet not found")
    }

    return res
    .status(200)
    .json( new ApiResponse(
    200, tweetId, "Tweet deleted Successfully"))

})


const getAllTweets = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user id")
  }

  const tweets = await Tweet.aggregate([
    {
      $match: {
        owner: {
          $ne: new mongoose.Types.ObjectId(userId),
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $addFields: { owner: { $first: "$owner" } },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "tweet",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "tweet",
        as: "dislikes",
      },
    },
    {
      $addFields: {
        likesCount: { $size: "$likes" },
        dislikesCount: { $size: "$dislikes" },
        isLiked: {
          $in: [
            new mongoose.Types.ObjectId(req.user._id),
            {
              $map: {
                input: {
                  $filter: {
                    input: "$likes",
                    as: "l",
                    cond: { $eq: ["$$l.type", "like"] },
                  },
                },
                as: "l",
                in: "$$l.likedBy",
              },
            },
          ],
        },
        isDisLiked: {
          $in: [
             new mongoose.Types.ObjectId(req.user._id),
            {
              $map: {
                input: {
                  $filter: {
                    input: "$likes",
                    as: "l",
                    cond: { $eq: ["$$l.type", "dislike"] },
                  },
                },
                as: "l",
                in: "$$l.likedBy",
              },
            },
          ],
        },
      },
    },
    {
      $sort: { createdAt: -1 },
    },

    {
      $project: {
        content: 1,
        createdAt: 1,
        likesCount: 1,
        isLiked: 1,
        dislikesCount: 1,
        isDisLiked: 1,
        "owner.username": 1,
        "owner.avatar": 1,
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, tweets, "All Tweets fetched successfully"));
});


export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet,
    getAllTweets
}