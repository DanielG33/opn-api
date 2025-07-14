import { Request, Response } from 'express';
import { getAllPublicSeries, getPublicSeriesById } from '../../services/series.service';

export const listPublicSeries = async (req: Request, res: Response) => {
  try {
    const seriesList = await getAllPublicSeries();
    res.status(200).json({ success: true, data: seriesList });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch series' });
  }
};

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
