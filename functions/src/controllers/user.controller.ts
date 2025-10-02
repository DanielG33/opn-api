import { Request, Response } from "express";
import { db } from "../firebase";

// Types
interface UserPlaylist {
  id?: string;
  name: string;
  description?: string;
  episodes: string[]; // Array of episode IDs
  createdAt: Date;
  updatedAt: Date;
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

    const playlists = playlistsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(playlists);
  } catch (error) {
    console.error("Error fetching user playlists:", error);
    res.status(500).json({ error: "Failed to fetch playlists" });
  }
};

export const createPlaylist = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Playlist name is required" });
    }

    const playlist: UserPlaylist = {
      name,
      description: description || "",
      episodes: [],
      createdAt: new Date(),
      updatedAt: new Date()
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
    res.status(500).json({ error: "Failed to delete playlist" });
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