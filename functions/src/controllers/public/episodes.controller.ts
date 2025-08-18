import { Request, Response } from 'express';
import { getEpisodeListByIds, getEpisodeById } from '../../services/episode.service';

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

export const getEpisode = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const episode = await getEpisodeById(id);
        if (!episode) {
            return res.status(404).json({ success: false, message: 'Episode not found' });
        }
        return res.status(200).json({ success: true, data: episode });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Failed to fetch episode' });
    }
}