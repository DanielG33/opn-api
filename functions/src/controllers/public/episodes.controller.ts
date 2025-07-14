import { Request, Response } from 'express';
import { getEpisodeListByIds } from '../../services/episode.service';

export const getEpisodesById = async (req: Request, res: Response) => {
    const ids = String(req.query.ids || req.query.ids).split(',');

    try {
        const episodesList = await getEpisodeListByIds(ids);
        res.status(200).json({ success: true, data: episodesList });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to fetch episodes' });
    }
}