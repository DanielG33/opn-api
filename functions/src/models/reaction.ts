// Video rating model for separate collection
export interface VideoRating {
  id?: string;
  userId: string;
  videoId: string;
  rating: number; // 1-5 stars
  createdAt: Date;
  updatedAt: Date;
}

// Video stats model for aggregated data
export interface VideoStats {
  videoId: string;
  totalRatings: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  updatedAt: Date;
}

// API request/response types
export interface RatingRequest {
  rating: number;
}

export interface RatingResponse {
  rating: VideoRating;
  stats: VideoStats;
}

export interface StatsResponse {
  stats: VideoStats;
}

export interface UserRatingResponse {
  rating: VideoRating | null;
}

// Frontend models for rating dialog (these will be used in the frontend)
export interface RatingDialogData {
  isLiked: boolean;
  currentRating?: number;
}

export interface RatingDialogResult {
  action: 'like' | 'unlike' | 'cancel';
  rating?: number;
}