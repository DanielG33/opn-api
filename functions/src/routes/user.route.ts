import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { 
  getUserPlaylists,
  createPlaylist,
  deletePlaylist,
  getPlaylistsWithVideoStatus,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  getPlaylistById,
  getFollowedSeries,
  followSeries,
  unfollowSeries,
  checkSeriesFollowStatus,
  getFollowedProducers,
  followProducer,
  unfollowProducer,
  checkProducerFollowStatus
} from "../controllers/user.controller";

export const userRouter = Router();

// Apply auth middleware to all user routes
userRouter.use(authMiddleware);

// Playlist routes
userRouter.get("/playlists", getUserPlaylists);
userRouter.post("/playlists", createPlaylist);
userRouter.get("/playlists/status/:videoId", getPlaylistsWithVideoStatus);
userRouter.get("/playlists/:playlistId", getPlaylistById);
userRouter.delete("/playlists/:playlistId", deletePlaylist);
userRouter.post("/playlists/:playlistId/videos", addVideoToPlaylist);
userRouter.delete("/playlists/:playlistId/videos/:videoId", removeVideoFromPlaylist);

// Series following routes
userRouter.get("/followed-series", getFollowedSeries);
userRouter.post("/follow-series", followSeries);
userRouter.delete("/follow-series/:seriesId", unfollowSeries);
userRouter.get("/follow-series/:seriesId/status", checkSeriesFollowStatus);

// Producer following routes
userRouter.get("/followed-producers", getFollowedProducers);
userRouter.post("/follow-producer", followProducer);
userRouter.delete("/follow-producer/:producerId", unfollowProducer);
userRouter.get("/follow-producer/:producerId/status", checkProducerFollowStatus);