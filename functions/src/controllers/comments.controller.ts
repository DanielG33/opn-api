import { Request, Response } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../firebase';
import { VideoComment, CommentRequest, CommentResponse, CommentsListResponse } from '../models/comment';

// Get comments for a video
export const getVideoComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { videoId } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    // Validate parameters
    const limitNum = Math.min(parseInt(limit as string) || 50, 100); // Max 100 comments per request
    const offsetNum = parseInt(offset as string) || 0;

    console.log(`Fetching comments for video ${videoId}, limit: ${limitNum}, offset: ${offsetNum}`);

    // For simplicity, let's get all comments and handle pagination in memory for now
    // This works better with Firebase emulator
    const commentsQuery = db
      .collection('video_comments')
      .where('videoId', '==', videoId)
      .orderBy('createdAt', 'desc');

    const commentsSnapshot = await commentsQuery.get();
    const allComments = commentsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to Date objects
        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
      } as VideoComment;
    });

    // Apply pagination in memory
    const comments = allComments.slice(offsetNum, offsetNum + limitNum);
    const total = allComments.length;

    const response: CommentsListResponse = {
      comments,
      total
    };

    console.log(`Found ${comments.length} comments out of ${total} total for video ${videoId}`);
    res.json(response);
  } catch (error) {
    console.error('Error getting video comments:', error);
    res.status(500).json({ error: 'Failed to get video comments' });
  }
};

// Create a new comment
export const createComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { videoId } = req.params;
    const { content }: CommentRequest = req.body;
    const userId = req.user?.uid;
    const userEmail = req.user?.email;
    const userDisplayName = req.user?.email?.split('@')[0] || 'Anonymous User'; // Use email prefix as display name

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Validate content
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ error: 'Comment content is required' });
      return;
    }

    if (content.trim().length > 2000) {
      res.status(400).json({ error: 'Comment content must be less than 2000 characters' });
      return;
    }

    const now = new Date();
    const commentId = db.collection('video_comments').doc().id;
    
    const commentData: VideoComment = {
      id: commentId,
      userId,
      videoId,
      content: content.trim(),
      userDisplayName,
      userEmail: userEmail || '',
      createdAt: now,
      updatedAt: now
    };

    // Save the comment
    await db.collection('video_comments').doc(commentId).set({
      ...commentData,
      createdAt: Timestamp.fromDate(commentData.createdAt),
      updatedAt: Timestamp.fromDate(commentData.updatedAt)
    });

    const response: CommentResponse = {
      comment: commentData
    };

    console.log(`Created comment ${commentId} for video ${videoId} by user ${userId}`);
    res.json(response);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
};

// Delete a comment (only by the comment author)
export const deleteComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { videoId, commentId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Check if comment exists and belongs to the user
    const commentDoc = await db.collection('video_comments').doc(commentId).get();
    
    if (!commentDoc.exists) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    const commentData = commentDoc.data() as VideoComment;
    
    if (commentData.userId !== userId) {
      res.status(403).json({ error: 'You can only delete your own comments' });
      return;
    }

    if (commentData.videoId !== videoId) {
      res.status(400).json({ error: 'Comment does not belong to this video' });
      return;
    }

    // Delete the comment
    await db.collection('video_comments').doc(commentId).delete();

    console.log(`Deleted comment ${commentId} for video ${videoId} by user ${userId}`);
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
};