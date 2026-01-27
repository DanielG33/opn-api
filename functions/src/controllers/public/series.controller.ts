import { Request, Response } from 'express';
import { getAllPublicSeries, getPublicSeriesById, getDraftSeriesById } from '../../services/series.service';
import { isDraftMode, assertDraftAccess } from '../../utils/preview.utils';
import { previewTokenRepository } from '../../repositories/preview-token.repository';

/**
 * PUBLIC ENDPOINT: List all published series
 * Filters by series publicationStatus == PUBLISHED (not content draft flags)
 */
export const listPublicSeries = async (req: Request, res: Response) => {
  try {
    const seriesList = await getAllPublicSeries();
    res.status(200).json({ success: true, data: seriesList });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch series' });
  }
};

/**
 * PUBLIC ENDPOINT: Get series by ID
 * Supports three access modes:
 * 
 * 1. Default (no params): Returns PUBLISHED series only
 * 2. Preview token (?previewToken=pt_...): Returns DRAFT series if token valid
 *    - No authentication required
 *    - Token validated server-side via previewTokenRepository.validateAndTouch()
 *    - Auto-extends expiry by 12 hours on valid use
 *    - Returns 403 with PREVIEW_TOKEN_INVALID if invalid/expired/revoked
 * 3. Draft mode (legacy, to be deprecated): Requires Firebase Auth + producer ownership
 * 
 * Security:
 * - Public cannot create/list/revoke tokens (those are producer-only endpoints)
 * - Public can only submit tokens for validation via this endpoint
 * - Validation happens server-side, no direct Firestore access from clients
 */
export const getSeriesById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const previewToken = req.query.previewToken as string | undefined;
  
  try {
    // Priority 1: Preview token (stateless, no auth required)
    if (previewToken) {
      const validToken = await previewTokenRepository.validateAndTouch(id, previewToken);
      
      if (!validToken) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'PREVIEW_TOKEN_INVALID',
            message: 'Preview token is invalid, expired, or revoked'
          }
        });
      }
      
      // Token valid - return draft series
      const series = await getDraftSeriesById(id);
      if (!series) {
        return res.status(404).json({ success: false, message: 'Series not found' });
      }
      return res.status(200).json({ success: true, data: series });
    }
    
    // Priority 2: Draft mode with auth (legacy)
    if (isDraftMode(req)) {
      // Verify user has access to draft
      try {
        await assertDraftAccess(req, res, id);
      } catch (error) {
        // Error response already sent by assertDraftAccess
        return;
      }
      
      // Fetch draft series
      const series = await getDraftSeriesById(id);
      if (!series) {
        return res.status(404).json({ success: false, message: 'Series not found' });
      }
      return res.status(200).json({ success: true, data: series });
    }
    
    // Priority 3: Default - published series only
    const series = await getPublicSeriesById(id);
    if (!series) {
      return res.status(404).json({ success: false, message: 'Series not found' });
    }
    return res.status(200).json({ success: true, data: series });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to fetch series' });
  }
};
