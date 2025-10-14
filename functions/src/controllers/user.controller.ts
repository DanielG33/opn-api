import { Request, Response } from "express";
import { db, bucket } from "../firebase";
import { UserPlaylist } from "../models/playlist";
import { Episode } from "../models/episode";

// Types
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
export const healthCheck = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    
    // Test database connection
    const testSnapshot = await db.collection("episodes").limit(1).get();
    const episodeCount = testSnapshot.size;
    
    return res.json({
      status: "healthy",
      userId: userId,
      timestamp: new Date().toISOString(),
      episodesCollection: {
        accessible: true,
        sampleCount: episodeCount
      }
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return res.status(500).json({ 
      status: "unhealthy", 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
};

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
      const playlist = {
        id: doc.id,
        ...data,
        videoCount: data.episodes?.length || 0 // Ensure videoCount matches episodes length
      };
      return playlist;
    });

    res.json(playlists);
  } catch (error) {
    console.error("Error fetching user playlists:", error);
    res.status(500).json({ error: "Failed to fetch playlists" });
  }
};export const createPlaylist = async (req: Request, res: Response) => {
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

export const updatePlaylist = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { playlistId } = req.params;
    const updates = req.body;

    const playlistRef = db
      .collection("users")
      .doc(userId)
      .collection("playlists")
      .doc(playlistId);

    const playlistDoc = await playlistRef.get();
    
    if (!playlistDoc.exists) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    // Update with timestamp
    const updateData = {
      ...updates,
      updatedAt: new Date()
    };

    await playlistRef.update(updateData);

    // Get updated playlist
    const updatedDoc = await playlistRef.get();
    const updatedPlaylist = {
      id: updatedDoc.id,
      ...updatedDoc.data()
    };

    return res.json(updatedPlaylist);
  } catch (error) {
    console.error("Error updating playlist:", error);
    return res.status(500).json({ error: "Failed to update playlist" });
  }
};

export const uploadPlaylistThumbnail = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { playlistId } = req.params;
    const { base64EncodedFile, fileName } = req.body;

    if (!base64EncodedFile) {
      return res.status(400).json({ error: "No file data provided" });
    }

    if (!fileName) {
      return res.status(400).json({ error: "File name is required" });
    }

    // Check if playlist exists
    const playlistRef = db
      .collection("users")
      .doc(userId)
      .collection("playlists")
      .doc(playlistId);

    const playlistDoc = await playlistRef.get();
    if (!playlistDoc.exists) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    // Use the same asset service approach as admin
    const { getBase64Data, getBase64MimeType } = require('../utils/base64');
    
    // Get file data and mime type
    const fileData = getBase64Data(base64EncodedFile);
    const mimeType = getBase64MimeType(base64EncodedFile);

    if (!mimeType || !mimeType.startsWith('image/')) {
      return res.status(400).json({ 
        error: "Invalid file type. Please upload an image file." 
      });
    }

    // Build file path for user playlists
    const filePath = `users/${userId}/playlists/${playlistId}/${fileName}`;
    
    const fileRef = bucket.file(filePath);
    const fileBuffer = Buffer.from(fileData, "base64");

    // Upload to Firebase Storage
    await fileRef.save(fileBuffer, { contentType: mimeType });
    await fileRef.makePublic();
    const thumbnailUrl = fileRef.publicUrl();

    // Update playlist with new thumbnail URL
    await playlistRef.update({
      thumbnailUrl,
      updatedAt: new Date()
    });

    // Get updated playlist
    const updatedDoc = await playlistRef.get();
    const updatedPlaylist = {
      id: updatedDoc.id,
      ...updatedDoc.data()
    };

    return res.json(updatedPlaylist);

  } catch (error) {
    console.error("Error uploading playlist thumbnail:", error);
    return res.status(500).json({ error: "Failed to upload thumbnail" });
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

    // First, verify the episode exists
    const episodeDoc = await db.collection("episodes").doc(videoId).get();
    if (!episodeDoc.exists) {
      return res.status(404).json({ error: "Episode not found" });
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

export const getPlaylistVideos = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { playlistId } = req.params;

    // First get the playlist to get the episode IDs
    const playlistDoc = await db
      .collection("users")
      .doc(userId)
      .collection("playlists")
      .doc(playlistId)
      .get();

    if (!playlistDoc.exists) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    const playlistData = playlistDoc.data() as UserPlaylist;
    
    if (!playlistData.episodes || playlistData.episodes.length === 0) {
      return res.json([]);
    }

    // Fetch episode details for each episode ID
    const videoPromises = playlistData.episodes.map(async (episodeId: string) => {
      try {
        const episodeDoc = await db.collection("episodes").doc(episodeId).get();
        if (episodeDoc.exists) {
          const episodeData = episodeDoc.data() as Episode;
          
          // Map Episode to ContentCard interface
          return {
            id: episodeDoc.id,
            title: episodeData.title || 'Untitled Episode',
            subtitle: episodeData.description || 'No description available',
            imageUrl: episodeData.thumbnail?.url || '',
            thumbnail: episodeData.thumbnail || null,
            metaData: episodeData.tags || [],
            videoUrl: episodeData.videoUrl || '',
            type: 'episode' as const,
            episodeId: episodeDoc.id
          };
        } else {
          // Episode not found, return null
        }
        return null;
      } catch (error) {
        console.error(`Error fetching episode ${episodeId}:`, error);
        return null;
      }
    });

    const videos = await Promise.all(videoPromises);
    // Filter out null values (failed fetches)
    const validVideos = videos.filter(video => video !== null);

    return res.json(validVideos);
  } catch (error) {
    console.error("Error fetching playlist videos:", error);
    return res.status(500).json({ error: "Failed to fetch playlist videos" });
  }
};