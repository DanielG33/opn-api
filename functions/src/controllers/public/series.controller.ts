import { Request, Response } from 'express';
import { getAllPublicSeries, getPublicSeriesById, getDraftSeriesById } from '../../services/series.service';
import { isDraftMode, assertDraftAccess } from '../../utils/preview.utils';

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
 * Supports draft mode via query parameter: ?mode=draft or ?mode=preview
 * 
 * Default behavior (no mode): 
 *   - Returns 404 if series publicationStatus != PUBLISHED
 * 
 * Draft mode (?mode=draft or ?mode=preview):
 *   - Requires Firebase Auth (user must be authenticated)
 *   - Requires permissions: user must be producer (or super admin) AND must own the series
 *   - Reads from series-draft collection instead of series collection
 *   - Returns 404 for unauthorized/forbidden draft access (avoid leaking existence)
 *   - Works for ALL publication statuses (DRAFT, IN_REVIEW, PUBLISHED, HIDDEN, REJECTED)
 *     This allows producers to preview their series at any stage of the workflow
 */
export const getSeriesById = async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    // Check if draft mode is requested
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
    
    // Default: fetch published series only
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
