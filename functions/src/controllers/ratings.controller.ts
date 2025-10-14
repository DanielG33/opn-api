import { Request, Response } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../firebase';
import { VideoRating, VideoStats, RatingRequest, RatingResponse, StatsResponse, UserRatingResponse } from '../models/reaction';

// Helper function to generate rating document ID
function generateRatingId(userId: string, videoId: string): string {
  return `${userId}_${videoId}`;
}

// Get user's rating for a video
export const getUserRating = async (req: Request, res: Response): Promise<void> => {
  try {
    const { videoId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const ratingId = generateRatingId(userId, videoId);
    const ratingDoc = await db.collection('video_ratings').doc(ratingId).get();

    const response: UserRatingResponse = {
      rating: ratingDoc.exists ? { id: ratingDoc.id, ...ratingDoc.data() } as VideoRating : null
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting user rating:', error);
    res.status(500).json({ error: 'Failed to get user rating' });
  }
};

// Create or update user's rating for a video
export const createOrUpdateRating = async (req: Request, res: Response): Promise<void> => {
  try {
    const { videoId } = req.params;
    const { rating }: RatingRequest = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Rating must be between 1 and 5' });
      return;
    }

    const now = new Date();
    const ratingId = generateRatingId(userId, videoId);
    
    // Check if rating already exists
    const existingRatingDoc = await db.collection('video_ratings').doc(ratingId).get();
    const isUpdate = existingRatingDoc.exists;
    
    const ratingData: VideoRating = {
      id: ratingId,
      userId,
      videoId,
      rating,
      createdAt: isUpdate ? existingRatingDoc.data()?.createdAt?.toDate() || now : now,
      updatedAt: now
    };

    // Save the rating
    await db.collection('video_ratings').doc(ratingId).set({
      ...ratingData,
      createdAt: Timestamp.fromDate(ratingData.createdAt),
      updatedAt: Timestamp.fromDate(ratingData.updatedAt)
    });

    // Manually recalculate and get updated stats
    const stats = await recalculateVideoStatsHelper(videoId);

    const response: RatingResponse = {
      rating: ratingData,
      stats
    };

    res.json(response);
  } catch (error) {
    console.error('Error creating/updating rating:', error);
    res.status(500).json({ error: 'Failed to save rating' });
  }
};

// Delete user's rating for a video
export const deleteRating = async (req: Request, res: Response): Promise<void> => {
  try {
    const { videoId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const ratingId = generateRatingId(userId, videoId);
    
    // Check if rating exists
    const ratingDoc = await db.collection('video_ratings').doc(ratingId).get();
    if (!ratingDoc.exists) {
      res.status(404).json({ error: 'Rating not found' });
      return;
    }

    // Delete the rating
    await db.collection('video_ratings').doc(ratingId).delete();

    // Manually recalculate and get updated stats
    const stats = await recalculateVideoStatsHelper(videoId);

    const response: StatsResponse = {
      stats
    };

    res.json(response);
  } catch (error) {
    console.error('Error deleting rating:', error);
    res.status(500).json({ error: 'Failed to delete rating' });
  }
};

// Get aggregated stats for a video
export const getVideoStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { videoId } = req.params;

    const statsDoc = await db.collection('video_stats').doc(videoId).get();
    
    let stats: VideoStats;
    
    if (statsDoc.exists) {
      stats = statsDoc.data() as VideoStats;
    } else {
      // If no stats document exists, calculate them on the fly
      console.log('No stats document found, calculating stats for video:', videoId);
      await recalculateVideoStatsHelper(videoId);
      
      // Try to get the stats again after calculation
      const updatedStatsDoc = await db.collection('video_stats').doc(videoId).get();
      
      if (updatedStatsDoc.exists) {
        stats = updatedStatsDoc.data() as VideoStats;
      } else {
        // Still no stats, return default
        stats = {
          videoId,
          totalRatings: 0,
          averageRating: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          updatedAt: new Date()
        };
      }
    }

    const response: StatsResponse = {
      stats
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting video stats:', error);
    res.status(500).json({ error: 'Failed to get video stats' });
  }
};

// Helper function to recalculate stats (extracted for reuse)
async function recalculateVideoStatsHelper(videoId: string): Promise<VideoStats> {
  // Get all ratings for this video
  const ratingsQuery = db
    .collection('video_ratings')
    .where('videoId', '==', videoId);
  
  const ratingsSnapshot = await ratingsQuery.get();
  const ratings = ratingsSnapshot.docs.map(doc => doc.data() as VideoRating);
  
  console.log(`Found ${ratings.length} ratings for video ${videoId}`);
  
  // Calculate aggregated stats
  const totalRatings = ratings.length;
  let averageRating = 0;
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
  if (totalRatings > 0) {
    const totalScore = ratings.reduce((sum, rating) => sum + rating.rating, 0);
    averageRating = totalScore / totalRatings;
    
    // Count distribution
    ratings.forEach(rating => {
      ratingDistribution[rating.rating as keyof typeof ratingDistribution]++;
    });
  }
  
  // Create stats object
  const stats: VideoStats = {
    videoId,
    totalRatings,
    averageRating: Math.round(averageRating * 100) / 100, // Round to 2 decimal places
    ratingDistribution,
    updatedAt: new Date()
  };
  
  // Save stats to video_stats collection
  await db.collection('video_stats').doc(videoId).set(stats);
  
  console.log('Updated stats for video:', videoId, stats);
  return stats;
}

// Manual stats recalculation endpoint (for debugging)
export const recalculateVideoStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { videoId } = req.params;
    
    console.log('Manual stats recalculation requested for video:', videoId);
    const stats = await recalculateVideoStatsHelper(videoId);
    
    const response: StatsResponse = {
      stats
    };

    res.json(response);
  } catch (error) {
    console.error('Error recalculating video stats:', error);
    res.status(500).json({ error: 'Failed to recalculate video stats' });
  }
};