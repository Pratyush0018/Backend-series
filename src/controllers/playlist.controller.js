import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {Video} from "../models/video.model.js"


const createPlaylist = asyncHandler(async (req, res) => {

    const {name, description} = req.body
    
    if(!name || !description){
        throw new ApiError(400, "All fields are required")
    }

    const playList = await Playlist.create(
        {
            name,
            description
        }
    )

    return res.status(200)
    .json(
        new ApiResponse(200, playList, "Playlist created successfully" )
    )
})

const getUserPlaylists = asyncHandler(async (req, res) => {

    const {userId} = req.params

    const playLists = await Playlist.findById(userId);

    if(!playLists || playLists.length === 0 ){
        throw new ApiError(409, "No playlists found for this user")
    }
    return res.status(200).json(
        new ApiResponse(200, playLists, "Playlists fetched successfully")
    );


})

const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    

    if(isValidObjectId(playList)){
        throw new ApiError(400, "invalid playlistId")
    }
    const playList = await Playlist.findById(playlistId);

    if(!playList){
        throw ApiError(409, "Playlist not found")
    }

    const playListVideos = await Playlist.aggregate([
        {
            $match : {
                videos : new mongoose.Types.ObjectId(playlistId)
            }
        },
        {
            $lookup : {
                from : "videos",
                localField : "videos",
                foreignField : "_id",
                as : "videos"
            }
        },
        {
            $match : {
                "videos.isPublished" : true
            }
        },
        {
            $lookup : {
                from : "users",
                localField : "owner",
                foreignField : "_id",
                as : "users"
            }
        },
        {
            $addFields : {
                totalVideos : {
                    $size : "$videos"
                },
                totalViews : {
                    $sum : "$videos.views"
                },
                owner : {
                    $first : "$users"
                }
            }
        },
        {
            $project : {
                name : 1,
                description : 1,
                createdAt : 1,
                updatedAt : 1,
                totalVideos : 1,
                totoalViews : 1,

                videos : {
                    _id: 1,
                    "videoFile.url": 1,
                    "thumbnail.url": 1,
                    title: 1,
                    description: 1,
                    duration: 1,
                    createdAt: 1,
                    views: 1

                },
                owner: {
                    username : 1,
                    fullname : 1,
                    "avatar.url" : 1
                }

            }
        }
    ]);

    return res.status(200)
    .json(
        new ApiResponse(200, playListVideos, "PlayList fetched successfully")
    )


})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params;

    if(!isValidObjectId(playlistId) || !isValidObjectId(videoId)){
        throw new ApiError(400, "invalid playlistId or videoId")
    }

    const playList = await Playlist.findById(playlistId);

    if(!playList){
        throw new ApiError(404, "playList does not found")
    }

    const video = await Video.findById(videoId);

    if(!video){
        throw new ApiError(404, "video does not found")
    }

    if(playList.owner.toString() && video.owner.toString() !== req.user._id){
        throw new ApiError(400, "only owner can add video to thier playlist");
    }
    
    const updatedPlayList = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $addToSet : {
                videos : videoId
            }
        },
        {
            new : true
        }
    )
    return res.status(200)
    .json(
        new ApiResponse(200, updatedPlayList, "Video added to playlist successfully")
    )
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
  
    if(!isValidObjectId(playlistId) || !isValidObjectId(videoId)){
        throw new ApiError(400,"invalid playlist or video")
    }

    const playList = await Playlist.findById(playlistId);
    if(!playList){
        throw new ApiError(404, "Playlist not found")
    }

    const video = await Video.findById(videoId);
    if(!video){
        throw new ApiError(404, "video not found")
    }

    if(playList?.owner.toString() && video?.owner.toString() !== req.user._id){
        throw new ApiError(
            404,
            "only owner can remove video from thier playlist"
        )
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $pull : {
                videos : videoId
            },
        },
        {
            new : true
        }
    ) 
    return res.status(200)
    .json(
        new ApiResponse(200, updatedPlaylist, "Video deleted from playlist successfully")
    )


})

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params

    const playList = await Playlist.findById(playlistId);

    if(!playList){
        throw new ApiError(404,"Playlist not found")
    }

    if(playList.owner.toString() !== req.user._id.toString()){
        throw new ApiError(403,"You are not authorized to delete this playlist")
    }

    await Playlist.findByIdAndDelete(playList?._id)
    
    return res.status(200).json(
        new ApiResponse(200, null, "Playlist deleted successfully")
    );
})


const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body

    const playList = await Playlist.findById(playlistId);

    if(!playList){
        throw new ApiError(404,"Playlist not found")
    }

    if(playList.owner.toString() !== req.user._id.toString()){
        throw new ApiError(403,"You are not authorized to update this playlist")
    }

    const updatedPlayList = await Playlist.findByIdAndUpdate(
        playList?._id,
        {
            $set : {
                name,
                description
            }
        }
    )

    if(!updatePlaylist){
        throw new ApiError(500, "Something wents wrong while updated playlist")
    }

    return res.status(200).json(
        new ApiResponse(200, updatedPlayList, "Playlist updated successfully")
    );
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}