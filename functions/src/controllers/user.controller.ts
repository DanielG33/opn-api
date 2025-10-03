import { Request, Response } from "express";
import { db } from "../firebase";

// Types
interface UserPlaylist {
  id?: string;
  title: string; // Changed from 'name' to match frontend interface
  description?: string;
  episodes: string[]; // Array of episode IDs
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  videoCount: number;
  thumbnailUrl?: string;
  isPublic: boolean;
}

interface FollowedSeries {
  id?: string;
  seriesId: string;
  followedAt: Date;
}

interface FollowedProducer {
  id?: string;
  producerId: string;
  followedAt: Date;
}

// Playlist Controllers
export const getUserPlaylists = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    
    const playlistsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("playlists")
      .get();

    const playlists = playlistsSnapshot.docs.map(doc => {
      const data = doc.data() as UserPlaylist;
      return {
        id: doc.id,
        ...data,
        videoCount: data.episodes.length
      };
    });

    res.json(playlists);
  } catch (error) {
    console.error("Error fetching user playlists:", error);
    res.status(500).json({ error: "Failed to fetch playlists" });
  }
};

export const createPlaylist = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { title, description, isPublic } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Playlist title is required" });
    }

    const playlist: UserPlaylist = {
      title,
      description: description || "",
      episodes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      userId,
      videoCount: 0,
      isPublic: isPublic || false
    };

    const docRef = await db
      .collection("users")
      .doc(userId)
      .collection("playlists")
      .add(playlist);

    return res.status(201).json({
      id: docRef.id,
      ...playlist
    });
  } catch (error) {
    console.error("Error creating playlist:", error);
    return res.status(500).json({ error: "Failed to create playlist" });
  }
};

export const deletePlaylist = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { playlistId } = req.params;

    await db
      .collection("users")
      .doc(userId)
      .collection("playlists")
      .doc(playlistId)
      .delete();

    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting playlist:", error);
    return res.status(500).json({ error: "Failed to delete playlist" });
  }
};

// Series Following Controllers
export const getFollowedSeries = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    
    const followedSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("followedSeries")
      .get();

    // Get series details for each followed series
    const followedSeriesData = [];
    
    for (const doc of followedSnapshot.docs) {
      const followData = { id: doc.id, ...doc.data() } as FollowedSeries;
      
      try {
        // Get series details from the series collection
        const seriesDoc = await db.collection("series").doc(followData.seriesId).get();
        
        if (seriesDoc.exists) {
          const seriesData = seriesDoc.data();
          followedSeriesData.push({
            id: followData.id,
            seriesId: followData.seriesId,
            title: seriesData?.title || "Unknown Series",
            description: seriesData?.description,
            thumbnail: seriesData?.thumbnail?.url,
            followedAt: followData.followedAt
          });
        }
      } catch (error) {
        console.error(`Error fetching series ${followData.seriesId}:`, error);
      }
    }

    res.json(followedSeriesData);
  } catch (error) {
    console.error("Error fetching followed series:", error);
    res.status(500).json({ error: "Failed to fetch followed series" });
  }
};

export const followSeries = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { seriesId } = req.body;

    if (!seriesId) {
      return res.status(400).json({ error: "Series ID is required" });
    }

    // Check if already following
    const existingFollow = await db
      .collection("users")
      .doc(userId)
      .collection("followedSeries")
      .where("seriesId", "==", seriesId)
      .get();

    if (!existingFollow.empty) {
      return res.status(409).json({ error: "Already following this series" });
    }

    const followData: FollowedSeries = {
      seriesId,
      followedAt: new Date()
    };

    await db
      .collection("users")
      .doc(userId)
      .collection("followedSeries")
      .add(followData);

    return res.status(201).json({ message: "Successfully followed series" });
  } catch (error) {
    console.error("Error following series:", error);
    return res.status(500).json({ error: "Failed to follow series" });
  }
};

export const unfollowSeries = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { seriesId } = req.params;

    const followSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("followedSeries")
      .where("seriesId", "==", seriesId)
      .get();

    if (followSnapshot.empty) {
      return res.status(404).json({ error: "Not following this series" });
    }

    // Delete all matching follow records (should be only one)
    const batch = db.batch();
    followSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    return res.status(204).send();
  } catch (error) {
    console.error("Error unfollowing series:", error);
    return res.status(500).json({ error: "Failed to unfollow series" });
  }
};

export const checkSeriesFollowStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { seriesId } = req.params;

    const followSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("followedSeries")
      .where("seriesId", "==", seriesId)
      .get();

    res.json({ isFollowing: !followSnapshot.empty });
  } catch (error) {
    console.error("Error checking series follow status:", error);
    res.status(500).json({ error: "Failed to check follow status" });
  }
};

// Producer Following Controllers
export const getFollowedProducers = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    
    const followedSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("followedProducers")
      .get();

    // Get producer details for each followed producer
    const followedProducersData = [];
    
    for (const doc of followedSnapshot.docs) {
      const followData = { id: doc.id, ...doc.data() } as FollowedProducer;
      
      try {
        // Get producer details from the users collection (producers are users with role)
        const producerDoc = await db.collection("users").doc(followData.producerId).get();
        
        if (producerDoc.exists) {
          const producerData = producerDoc.data();
          followedProducersData.push({
            id: followData.id,
            producerId: followData.producerId,
            name: producerData?.displayName || producerData?.name || "Unknown Producer",
            avatar: producerData?.avatar?.url,
            followedAt: followData.followedAt
          });
        }
      } catch (error) {
        console.error(`Error fetching producer ${followData.producerId}:`, error);
      }
    }

    res.json(followedProducersData);
  } catch (error) {
    console.error("Error fetching followed producers:", error);
    res.status(500).json({ error: "Failed to fetch followed producers" });
  }
};

export const followProducer = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { producerId } = req.body;

    if (!producerId) {
      return res.status(400).json({ error: "Producer ID is required" });
    }

    // Check if already following
    const existingFollow = await db
      .collection("users")
      .doc(userId)
      .collection("followedProducers")
      .where("producerId", "==", producerId)
      .get();

    if (!existingFollow.empty) {
      return res.status(409).json({ error: "Already following this producer" });
    }

    const followData: FollowedProducer = {
      producerId,
      followedAt: new Date()
    };

    await db
      .collection("users")
      .doc(userId)
      .collection("followedProducers")
      .add(followData);

    return res.status(201).json({ message: "Successfully followed producer" });
  } catch (error) {
    console.error("Error following producer:", error);
    return res.status(500).json({ error: "Failed to follow producer" });
  }
};

export const unfollowProducer = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { producerId } = req.params;

    const followSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("followedProducers")
      .where("producerId", "==", producerId)
      .get();

    if (followSnapshot.empty) {
      return res.status(404).json({ error: "Not following this producer" });
    }

    // Delete all matching follow records (should be only one)
    const batch = db.batch();
    followSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    return res.status(204).send();
  } catch (error) {
    console.error("Error unfollowing producer:", error);
    return res.status(500).json({ error: "Failed to unfollow producer" });
  }
};

export const checkProducerFollowStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { producerId } = req.params;

    const followSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("followedProducers")
      .where("producerId", "==", producerId)
      .get();

    res.json({ isFollowing: !followSnapshot.empty });
  } catch (error) {
    console.error("Error checking producer follow status:", error);
    res.status(500).json({ error: "Failed to check follow status" });
  }
};

// Enhanced Playlist Controllers
export const getPlaylistsWithVideoStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { videoId } = req.params;

    const playlistsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("playlists")
      .get();

    const playlistsWithStatus = playlistsSnapshot.docs.map(doc => {
      const playlist = { id: doc.id, ...doc.data() } as UserPlaylist;
      const hasVideo = playlist.episodes.includes(videoId);
      
      return {
        id: playlist.id!,
        title: playlist.title,
        description: playlist.description,
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt,
        userId: playlist.userId,
        videoCount: playlist.episodes.length,
        thumbnailUrl: playlist.thumbnailUrl,
        isPublic: playlist.isPublic,
        hasVideo
      };
    });

    res.json(playlistsWithStatus);
  } catch (error) {
    console.error("Error fetching playlists with video status:", error);
    res.status(500).json({ error: "Failed to fetch playlists" });
  }
};

export const addVideoToPlaylist = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { playlistId } = req.params;
    const { videoId } = req.body;

    if (!videoId) {
      return res.status(400).json({ error: "Video ID is required" });
    }

    const playlistRef = db
      .collection("users")
      .doc(userId)
      .collection("playlists")
      .doc(playlistId);

    const playlistDoc = await playlistRef.get();
    
    if (!playlistDoc.exists) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    const playlist = playlistDoc.data() as UserPlaylist;
    
    // Check if video is already in playlist
    if (playlist.episodes.includes(videoId)) {
      return res.status(409).json({ error: "Video already in playlist" });
    }

    // Add video to playlist
    const updatedEpisodes = [...playlist.episodes, videoId];
    
    await playlistRef.update({
      episodes: updatedEpisodes,
      updatedAt: new Date()
    });

    // Return the playlist video entry
    const playlistVideo = {
      id: `${playlistId}_${videoId}`,
      playlistId,
      videoId,
      addedAt: new Date(),
      order: updatedEpisodes.length - 1
    };

    return res.status(201).json(playlistVideo);
  } catch (error) {
    console.error("Error adding video to playlist:", error);
    return res.status(500).json({ error: "Failed to add video to playlist" });
  }
};

export const removeVideoFromPlaylist = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { playlistId, videoId } = req.params;

    const playlistRef = db
      .collection("users")
      .doc(userId)
      .collection("playlists")
      .doc(playlistId);

    const playlistDoc = await playlistRef.get();
    
    if (!playlistDoc.exists) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    const playlist = playlistDoc.data() as UserPlaylist;
    
    // Check if video is in playlist
    if (!playlist.episodes.includes(videoId)) {
      return res.status(404).json({ error: "Video not in playlist" });
    }

    // Remove video from playlist
    const updatedEpisodes = playlist.episodes.filter(episodeId => episodeId !== videoId);
    
    await playlistRef.update({
      episodes: updatedEpisodes,
      updatedAt: new Date()
    });

    return res.status(204).send();
  } catch (error) {
    console.error("Error removing video from playlist:", error);
    return res.status(500).json({ error: "Failed to remove video from playlist" });
  }
};

export const getPlaylistById = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { playlistId } = req.params;

    const playlistDoc = await db
      .collection("users")
      .doc(userId)
      .collection("playlists")
      .doc(playlistId)
      .get();

    if (!playlistDoc.exists) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    const playlist = {
      id: playlistDoc.id,
      ...playlistDoc.data(),
      videoCount: (playlistDoc.data() as UserPlaylist).episodes.length
    };

    return res.json(playlist);
  } catch (error) {
    console.error("Error fetching playlist:", error);
    return res.status(500).json({ error: "Failed to fetch playlist" });
  }
};