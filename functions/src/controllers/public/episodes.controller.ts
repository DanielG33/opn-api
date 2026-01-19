import { Request, Response } from 'express';
import { getEpisodeListByIds, getEpisodeById, getEpisodesBySeriesId, getEpisodesBySeasonId } from '../../services/episode.service';

export const getEpisodesById = async (req: Request, res: Response) => {
    const ids = String(req.query.ids || req.query.ids).split(',');

    try {
        const episodesList = await getEpisodeListByIds(ids, true); // Check series publication status
        res.status(200).json({ success: true, data: episodesList });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to fetch episodes' });
    }
}

export const getEpisode = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const episode = await getEpisodeById(id, true); // Check series publication status
        if (!episode) {
            return res.status(404).json({ success: false, message: 'Episode not found' });
        }
        return res.status(200).json({ success: true, data: episode });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Failed to fetch episode' });
    }
}

export const getEpisodesBySeries = async (req: Request, res: Response) => {
    const { seriesId } = req.params;
    const excludeEpisodeId = req.query.exclude as string;

    try {
        const episodes = await getEpisodesBySeriesId(seriesId, excludeEpisodeId, true); // Check series publication status
        res.status(200).json({ success: true, data: episodes });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to fetch episodes by series' });
    }
}

export const getEpisodesBySeason = async (req: Request, res: Response) => {
    const { seriesId, seasonId } = req.params;
    const excludeEpisodeId = req.query.exclude as string;

    try {
        const episodes = await getEpisodesBySeasonId(seriesId, seasonId, excludeEpisodeId, true); // Check series publication status
        res.status(200).json({ success: true, data: episodes });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to fetch episodes by season' });
    }
}