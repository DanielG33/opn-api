import {Request, Response} from "express";
import {
  getEpisodesByFilters,
  getEpisodeById,
  createEpisode,
  updateEpisode,
  deleteEpisode,
} from "../../services/episode.service";
import {db} from "../../firebase";
import { getSeasonById } from "../../services/season.service";

export const listProducerEpisodes = async (req: Request, res: Response) => {
  const uid = req.user?.uid as string;
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    return res.status(404).json({message: "User not found"});
  }

  const producerId = String(userDoc.data()?.producerId);

  try {
    const filters = {
      seriesId: req.query.seriesId as string,
      seasonId: req.query.seasonId as string,
      producerId,
    };
    const episodes = await getEpisodesByFilters(filters);
    return res.json({success: true, data: episodes});
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: {
        message: "Failed to load episodes",
      },
    });
  }
};

export const getProducerEpisode = async (req: Request, res: Response) => {
  const {id} = req.params;
  const episode = await getEpisodeById(id);
  if (!episode) return res.status(404).json({message: "Episode not found"});
  return res.json({success: true, data: episode});
};

export const createProducerEpisode = async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const { seriesId, seasonId } = body;

    const season = await getSeasonById(seriesId, seasonId);
    
    const data = {
      ...body,
      seasonTitle: season?.title
    }
    const episode = await createEpisode(data);
    res.status(201).json({success: true, data: episode});
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: {
        message: err.message,
      },
    });
  }
};

export const updateProducerEpisode = async (req: Request, res: Response) => {
  const {id} = req.params;
  try {
    const updated = await updateEpisode(id, req.body);
    res.json({success: true, data: updated});
  } catch (err) {
    res.status(422).json({
      success: false,
      error: {
        message: "Failed to update episode",
      },
    });
  }
};

export const deleteProducerEpisode = async (req: Request, res: Response) => {
  const {id} = req.params;
  try {
    await deleteEpisode(id);
    res.json({success: true, message: "Episode deleted"});
  } catch (err) {
    res.status(500).json({
      success: false,
      error: {
        message: "Failed to delete episode",
      },
    });
  }
};
