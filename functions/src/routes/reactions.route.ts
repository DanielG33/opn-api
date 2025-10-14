import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { 
  getUserRating, 
  createOrUpdateRating, 
  deleteRating, 
  getVideoStats,
  recalculateVideoStats
} from '../controllers/ratings.controller';
import {
  getVideoComments,
  createComment,
  deleteComment
} from '../controllers/comments.controller';

const router = Router();

// Public routes (no auth required)
router.get('/videos/:videoId/ratings/stats', getVideoStats);
router.get('/videos/:videoId/comments', getVideoComments);

// Manual stats recalculation (for debugging)
router.post('/videos/:videoId/ratings/recalculate', recalculateVideoStats);

// Protected routes (auth required)
router.get('/videos/:videoId/ratings/me', authMiddleware, getUserRating);
router.put('/videos/:videoId/ratings/me', authMiddleware, createOrUpdateRating);
router.delete('/videos/:videoId/ratings/me', authMiddleware, deleteRating);

// Comment routes (auth required for creation/deletion)
router.post('/videos/:videoId/comments', authMiddleware, createComment);
router.delete('/videos/:videoId/comments/:commentId', authMiddleware, deleteComment);

export { router as reactionsRouter };