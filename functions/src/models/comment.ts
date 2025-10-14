// Video comment model for separate collection
export interface VideoComment {
  id?: string;
  userId: string;
  videoId: string;
  content: string;
  userDisplayName: string; // Store display name for performance
  userEmail: string; // Store email for identification
  createdAt: Date;
  updatedAt: Date;
}

// API request/response types
export interface CommentRequest {
  content: string;
}

export interface CommentResponse {
  comment: VideoComment;
}

export interface CommentsListResponse {
  comments: VideoComment[];
  total: number;
}

// Frontend models for comment dialog
export interface CommentDialogData {
  videoId: string;
  videoTitle?: string;
}

export interface CommentDialogResult {
  action: 'submit' | 'cancel';
  content?: string;
}