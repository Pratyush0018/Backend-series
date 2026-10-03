import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import { Like } from "../models/like.model.js";
import { Comment } from "../models/comments.model.js";
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary , deleteOnCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {

  const {
    page = 1,
    limit = 10,
    query,
    sortBy,
    sortType,
    userId,
  } = req.query;

  const pipeline = [];

  if (query) {

    pipeline.push({
      $search: {
        index: "search-videos",
        text: {
          query: query,
          path: ["title", "description"],
        },
      },
    });

  }

  // FILTER BY USER

  if (userId) {

    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "Invalid userId");
    }

    pipeline.push({
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    });

  }

  // ONLY PUBLISHED VIDEOS

  pipeline.push({
    $match: {
      isPublished: true,
    },
  });

  if (sortBy && sortType) {

    pipeline.push({
      $sort: {
        [sortBy]: sortType === "asc" ? 1 : -1,
      },
    });

  } else {

    pipeline.push({
      $sort: {
        createdAt: -1,
      },
    });

  }

  // GET OWNER DETAILS

  pipeline.push(

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
                 avatar: 1,
            },
          },
        ],
      },
    },

    {
      $unwind: "$ownerDetails",
    },

    // GET LIKES
    {
      $lookup: {
           from: "likes",
           localField: "_id",
           foreignField: "video",
           as: "likes",
      },
    },

    {
      $addFields: {

        likesCount: {
          $size: {
            $filter: {

              input: "$likes",
              as: "l",

              cond: {
                $eq: ["$$l.type", "like"],
              },
            },
          },
        },


        dislikesCount: {
          $size: {
            $filter: {

              input: "$likes",
              as: "l",

              cond: {
                $eq: ["$$l.type", "dislike"],
              },
            },
          },
        },

        isLiked: {
          $in: [
            new mongoose.Types.ObjectId(req.user._id),

            {
              $map: {

                input: {
                  $filter: {

                    input: "$likes",
                    as: "l",

                    cond: {
                      $eq: ["$$l.type", "like"],
                    },

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

                    cond: {
                      $eq: ["$$l.type", "dislike"],
                    },

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
      $project: {

        title: 1,
        thumbnail: 1,
        ownerDetails: 1,
        likesCount: 1,
        dislikesCount: 1,
        duration: 1,
        createdAt: 1,
        views: 1,
        isLiked: 1,
        isDisLiked: 1,
      },
    }

  );

  const videoAggregate =
    Video.aggregate(pipeline);

  const options = {

    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };

  const video = await Video.aggregatePaginate( videoAggregate, options );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        video,
        "Videos fetched successfully"
      )
    );

});


const publishAVideo = asyncHandler(async (req, res) => {

  const { title, description } = req.body;

  if (
    [title, description].some(
      (field) => !field?.trim()
    )
  ) {
    throw new ApiError(
      400, "Title and description are required"
    );
  }

// file path
  const videoFile = await uploadOnCloudinary(
    req.files?.videoFile[0].path,  "video");
    
  const thumbnail = await uploadOnCloudinary(
    req.files?.thumbnail[0].path);

  if (!videoFile) {
    throw new ApiError(400, "Video file not found");
  }

  if (!thumbnail) {
    throw new ApiError(400, "Thumbnail not found");
  }


//   const videoFile = await uploadOnCloudinary(
//       videoFileLocalPath,
//       "video"
//     );


//   if (!videoFile?.url) {
//     throw new ApiError(
//       400,
//       "Video upload failed"
//     );
//   }

//   const thumbnail = await uploadOnCloudinary(
//       thumbnailLocalPath
//     );


//   if (!thumbnail?.url) {
//     throw new ApiError(
//       400,
//       "Thumbnail upload failed"
//     );
//   }

  // CREATE VIDEO
 
  const video = await Video.create({

    title: title.trim(),
    description: description.trim(),
    duration: videoFile.duration || 0,

    videoFile: {
      url: videoFile.url,
      public_id: videoFile.public_id
    },

    thumbnail: {
      url: thumbnail.url,
      public_id: thumbnail.public_id
    },
    
    owner: req.user?._id,
    isPublished: true,
  });


  const videoUploaded =
    await Video.findById(video._id);


  if (!videoUploaded) {
    throw new ApiError(
      500, "Video upload failed, please try again");
  }

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        videoUploaded,
        "Video uploaded successfully"
      )
    );

});


const getVideoById = asyncHandler(async (req, res) => {

  const { videoId } = req.params;

  const userId = req.user._id;


  if (!isValidObjectId(videoId)) {
    throw new ApiError(
      400, "Invalid videoId");
  }

  const video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
        isPublished: true,
      },
    },

    {
      $lookup: {

        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },

    {
      $addFields: {
        likesCount: {
          $size: {
            $filter: {

              input: "$likes",
              as: "l",

              cond: {
                $eq: ["$$l.type", "like"],
              },

            },
          },
        },


        dislikesCount: {
          $size: {
            $filter: {

              input: "$likes",
              as: "l",

              cond: {
                $eq: ["$$l.type", "dislike"],
              },

            },
          },
        },

        isLiked: {

          $in: [new mongoose.Types.ObjectId(userId),

            {
              $map: {

                input: {
                  $filter: {

                    input: "$likes",
                    as: "l",

                    cond: {
                      $eq: ["$$l.type", "like"],
                    },

                  },
                },

                as: "l",
                in: "$$l.likedBy",
              },
            },
          ],
        },

        isDisLiked: {

          $in: [ new mongoose.Types.ObjectId(userId),

            {
              $map: {

                input: {

                  $filter: {
                         input: "$likes",
                         as: "l",

                    cond: {
                      $eq: ["$$l.type", "dislike"],
                    },

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
      $lookup: {

        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",

        pipeline: [

          {
            $lookup: {

              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },

          {
            $addFields: {

              subscribersCount: {
                $size: "$subscribers",
              },


              isSubscribed: {

                $in: [

                  new mongoose.Types.ObjectId(userId),
                 "$subscribers.subscriber",
                ],
              },

            },
          },

          {
            $project: {

              username: 1,
              avatar: 1,
              subscribersCount: 1,
              isSubscribed: 1,
            },
          },

        ],
      },
    },

    {
      $addFields: {

        owner: {
          $first: "$owner",
        },

      },
    },

    {
      $project: {

        videoFile: 1,
        title: 1,
        description: 1,
        views: 1,
        createdAt: 1,
        duration: 1,
        owner: 1,
        isLiked: 1,
        likesCount: 1,
        isDisLiked: 1,
        dislikesCount: 1,
      },
    },

  ]);


  if (!video.length) {
    throw new ApiError( 404, "Video not found");
  }

  await Video.findByIdAndUpdate(

    videoId,

    {
      $inc: {
        views: 1,
      },
    }

  );

  await User.findByIdAndUpdate(

    userId,

    {
      $addToSet: {
        watchHistory: videoId,
      },
    }

  );


  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        video[0],
        "Video fetched successfully"
      )
    );

});

const updateVideo = asyncHandler(async (req, res) => {

  const { videoId } = req.params;

  const { title, description } = req.body;

  const userId = req.user._id;


  if (!isValidObjectId(videoId)) {
    throw new ApiError( 400, "Invalid videoId" );
  }

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid userId");
  }

  if ( !title && !description && !req.file) {
    throw new ApiError( 400, "Nothing to update");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError( 404, "Video not found");
  }

  if ( video.owner.toString() !== userId.toString()) {
    throw new ApiError( 403, "You are not allowed to update this video" );
  }
  const updatePayload = {};

  if (title?.trim()) {
    updatePayload.title = title.trim();
  }

  if (description?.trim()) {
    updatePayload.description = description.trim();
  }

  if (req.file?.path) {

   const oldThumbnailPublicId = video.thumbnail.public_id;

   const uploadedThumbnail = await uploadOnCloudinary( req.file.path);

    if (!uploadedThumbnail?.url) {
      throw new ApiError( 400,"Thumbnail upload failed");
    }

    updatePayload.thumbnail = {
        url: uploadedThumbnail.url,
        public_id: uploadedThumbnail.public_id,
    };
    await deleteOnCloudinary(oldThumbnailPublicId);
  }

  const updatedVideo = await Video.findByIdAndUpdate( videoId,

      {
        $set: updatePayload,
      },

      {
        new: true,
      }

    );


  if (!updatedVideo) {
    throw new ApiError( 400, "Failed to update video");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedVideo,
        "Video updated successfully"
      )
    );

});
// DELETE VIDEO

const deleteVideo = asyncHandler(async (req, res) => {

  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError( 400, "Invalid videoId");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError( 404, "Video not found");
  }

  if ( video.owner.toString() !== req.user._id.toString()) {

    throw new ApiError( 403, "Only video owner can delete the video");
  }

  const deletedVideo = await Video.findByIdAndDelete(videoId);

  if (!deletedVideo) {
    throw new ApiError( 500, "Something went wrong while deleting video");
  }

  await Like.deleteMany({ video: videoId});
  await Comment.deleteMany({video: videoId});

  await deleteOnCloudinary(video.videoFile.public_id);
  await deleteOnCloudinary(video.thumbnail.public_id);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {},
        "Video deleted successfully"
      )
    );

});

// TOGGLE PUBLISH STATUS

const togglePublishStatus = asyncHandler(async (req, res) => {

    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
      throw new ApiError( 400, "Invalid videoId");
    }
    const video =
      await Video.findById(videoId);

    if (!video) {
      throw new ApiError(404, "Video not found");
    }

    if ( video.owner.toString() !== req.user._id.toString()) 
      {
      throw new ApiError(
        403, "You can't toggle publish status as you are not the owner"
      );
    }

    const toggledVideoPublish = await Video.findByIdAndUpdate( 
    videoId,
    {
      $set: {
        isPublished: !video?.isPublished,
      },
    },
    { new: true }
  );

  if (!toggledVideoPublish) {
    return res.status(500).json({
      success: false,
      message: "Failed to toogle video publish status",
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isPublished: toggledVideoPublish.isPublished },
        "Video publish toggled successfully"
      )
    ); 

  });

  export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}
  