import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { VideoRating, VideoStats } from '../models/reaction';

export const onVideoRatingWrite = onDocumentWritten(
  'video_ratings/{ratingId}',
  async (event) => {
    const firestore = getFirestore();
    
    // Get the rating data before and after the change
    const beforeData = event.data?.before?.data() as VideoRating | undefined;
    const afterData = event.data?.after?.data() as VideoRating | undefined;
    
    // Determine the video ID from the rating data
    const videoId = afterData?.videoId || beforeData?.videoId;
    if (!videoId) {
      console.error('No video ID found in rating data');
      return;
    }
    
    try {
      // Recalculate stats for the video
      await recalculateVideoStats(firestore, videoId);
    } catch (error) {
      console.error('Error updating video stats:', error);
    }
  }
);

async function recalculateVideoStats(firestore: FirebaseFirestore.Firestore, videoId: string) {
  // Get all ratings for this video
  const ratingsQuery = firestore
    .collection('video_ratings')
    .where('videoId', '==', videoId);
  
  const ratingsSnapshot = await ratingsQuery.get();
  const ratings = ratingsSnapshot.docs.map(doc => doc.data() as VideoRating);
  
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
  await firestore
    .collection('video_stats')
    .doc(videoId)
    .set(stats);
}