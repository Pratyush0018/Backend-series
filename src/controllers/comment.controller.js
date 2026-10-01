import mongoose from "mongoose"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { Video } from "../models/video.model.js"

const getVideoComments = asyncHandler(async (req, res) => {
    
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query;

    if(!mongoose.isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid videoId");
    }
    // check video exists
    const video = await Video.findById(videoId);

    if(!video){
        throw new ApiError(404, "video not found")
    }

    const userId = new mongoose.Types.ObjectId(req.user._id)
    
    const commentAggregate = Comment.aggregate([

        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId)
            }
        },
        // get comment owner
        {
            $lookup: {
                 from: "users",
                 localField: "owner",
                 foreignField: "_id",
                 as: "owner"
            }
        },
        // get likes/dislikes of comment 
        {
            $lookup: {
                 from: "likes",
                 localField: "_id",
                 foreignField: "comment",
                 as: "likes"
            }
        },
        // calculate owner, counts and user reaction
        {
            $addFields: {

       // owner array ko object banana
              owner: {
                $first: "$owner"
              }, 
              // total likes 
              likeCount: {
                  $size: {
                    $filter: {
                         input: "$likes",
                                    as: "1",
                                    cond: { $eq: ["$$l.type", "like"] },

                    }
                  }
              },
              // total dislikes
              dislikesCount: {
                  $size: {
                       $filter: {
                         input: "$likes",
                         as: "1",
                         cond: { $eq: ["$$l.type", "like"] },

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
                createdAt: 1,
                updatedAt: 1,

                owner: {
                    _id: 1,
                    username: 1,
                    fullname: 1,
                    avatar: 1
                },

                likeCount: 1,
                dislikesCount: 1,
                isLiked: 1,
                isDisLiked: 1
            }
        }
    ]);

    // pagination options
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const comments = await Comment.aggregatePaginate(
        commentAggregate,
        options
    );
    return res
    .status(200)
    .json(
        new ApiResponse(
            200, comments, "comments fetched successfully"
        )
    );

});

const addComment = asyncHandler(async (req, res) => {
    
  const { videoId } = req.params;
  const { content } = req.body;

  if (!mongoose.isValidObjectId(videoId)){
    throw new ApiError(400, "Invalid videoId")
  }

  if ( !content || !content.trim() ){
    throw new ApiError(400, "content is required")
  }

  // check video is exists or not
 const video = await Video.findById(videoId);

 if( !video ){
    throw new ApiError(404 ,"Video not found")
 }

 // create comment
 const comment = await Comment.create({
    content: content.trim(),
    video: new mongoose.Types.ObjectId(videoId),
    owner: req.user._id
 });

 const populatedComment = await Comment.findById(comment._id)
            .populate("owner", "username avatar");

  return res
  .status(200)
  .json(new ApiResponse (201, populatedComment, "comment added successfully"))

});

const updateComment = asyncHandler(async (req, res) => {
    
     const { commentId } = req.params;
     const { content }   = req.body;

     if( !mongoose.isValidObjectId(commentId)){
        throw new ApiError(400, "Invalid commnetId")
     }

     if ( !content || !content.trim()){
        throw new ApiError(400, "Content is required")
     }

     // find comment
     const comment = await Comment.findById(commentId);

     if (!comment) {
        throw new ApiError(404, "comment not found")
     }

     // check ownership
     if (
        comment.owner.toString() !== req.user._id.toString()
     ){
        throw new ApiError(403, "You are not autorized to update this comment")
     }

     // update comment 
     const updatedComment = await Comment.findByIdAndUpdate(
        commentId,
        {
            $set: {
                content: content.trim()
            }
        },
        {
            new: true
            // runValidators: true
        }
     )
      .populate(
        "owner",
        "username avatar"
      );
 return res 
 .status(200)
 .json(
    new ApiError(200, updateComment, 
        "comment updated successfully"
    )
 )

});

const deleteComment = asyncHandler(async (req, res) => {
    
   const { commentId } = req.params;

   if ( !mongoose.isValidObjectId(commentId)){
    throw new ApiError(400, "Invalid commentId")
   }

   // find comment
   const comment = await Comment.findById(commentId);

   if (!comment) {
    throw new ApiError(404, "comment not found")
   }

   // check ownership
   if (
        comment.owner.toString() !== req.user._id.toString()
     ){
        throw new ApiError(403, "You are not autorized to delete this comment")
     }
     // delete comment
     await Comment.findByIdAndDelete(commentId);

     return res
     .status(200)
     .json(
        new ApiResponse(200,
            {commentId}, "comment deleted successfully"
        )
     )

});

export {
    getVideoComments, 
    addComment, 
    updateComment,
    deleteComment
    }