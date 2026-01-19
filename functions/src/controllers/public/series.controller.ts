import { Request, Response } from 'express';
import { getAllPublicSeries, getPublicSeriesById } from '../../services/series.service';

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
 * Returns 404 if series publicationStatus != PUBLISHED (not content draft flags)
 */
export const getSeriesById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const series = await getPublicSeriesById(id);
    if (!series) return res.status(404).json({ success: false, message: 'Series not found' });
    return res.status(200).json({ success: true, data: series });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to fetch series' });
  }
};
