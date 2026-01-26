/**
 * Session-based preview utilities for series draft access
 */

import { Request, Response } from "express";
import { db } from "../firebase";

/**
 * Check if the request is in draft mode
 * @param req Express request object
 * @returns true if mode=draft or mode=preview query parameter is set
 */
export function isDraftMode(req: Request): boolean {
  const mode = req.query.mode as string;
  return mode === 'draft' || mode === 'preview';
}

/**
 * Assert that the authenticated user has access to view the series draft
 * Requirements:
 * - User must be authenticated (Firebase Auth)
 * - User must be a producer or super admin
 * - If producer: must own the series (series.producerId matches user's producerId)
 * - If super admin: always has access
 * 
 * @param req Express request object (must have req.user from auth middleware)
 * @param seriesId The series ID to check access for
 * @throws Error with appropriate status code and message if access is denied
 */
export async function assertDraftAccess(req: Request, res: Response, seriesId: string): Promise<void> {
  // Check if user is authenticated
  if (!req.user) {
    res.status(404).json({ success: false, message: 'Series not found' });
    throw new Error('NOT_AUTHENTICATED');
  }

  const uid = req.user.uid;
  const role = req.user.role;

  // Super admin always has access (check from token claims)
  if (role === 'admin') {
    return;
  }

  // Get user's data from database to check if they're a producer
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    res.status(404).json({ success: false, message: 'Series not found' });
    throw new Error('USER_NOT_FOUND');
  }

  const userData = userDoc.data();
  const userProducerId = userData?.producerId;

  // Check if user has a producerId (meaning they're a producer)
  if (!userProducerId) {
    res.status(404).json({ success: false, message: 'Series not found' });
    throw new Error('INSUFFICIENT_ROLE');
  }

  // Get series to check ownership
  const seriesDoc = await db.collection('series-draft').doc(seriesId).get();
  if (!seriesDoc.exists) {
    // Also check public collection in case draft doesn't exist yet
    const publicSeriesDoc = await db.collection('series').doc(seriesId).get();
    if (!publicSeriesDoc.exists) {
      res.status(404).json({ success: false, message: 'Series not found' });
      throw new Error('SERIES_NOT_FOUND');
    }
    
    const publicSeriesData = publicSeriesDoc.data();
    if (publicSeriesData?.producerId !== userProducerId) {
      res.status(404).json({ success: false, message: 'Series not found' });
      throw new Error('NOT_OWNER');
    }
    return;
  }

  const seriesData = seriesDoc.data();
  
  // Check if user owns the series
  if (seriesData?.producerId !== userProducerId) {
    res.status(404).json({ success: false, message: 'Series not found' });
    throw new Error('NOT_OWNER');
  }
}

/**
 * Optional middleware variant for routes that need to check draft access
 * This can be used as middleware if preferred over inline checks
 */
export function draftAccessMiddleware(req: Request, res: Response, next: Function) {
  if (!isDraftMode(req)) {
    // Not in draft mode, continue with normal flow
    return next();
  }

  // In draft mode, check access
  const seriesId = req.params.id || req.params.seriesId;
  if (!seriesId) {
    return res.status(400).json({ success: false, message: 'Series ID required' });
  }

  assertDraftAccess(req, res, seriesId)
    .then(() => next())
    .catch((error) => {
      // Error response already sent by assertDraftAccess
      // Don't send another response
    });
}
