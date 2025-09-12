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
import { getSeriesById } from "../../services/series.service";

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

    // Get series to check if it's season-based or limited
    const series = await getSeriesById(seriesId);
    if (!series) {
      return res.status(404).json({
        success: false,
        error: { message: "Series not found" }
      });
    }

    let data = { ...body };

    // Only fetch season data for season-based series
    if (series.type === 'season-based' && seasonId) {
      const season = await getSeasonById(seriesId, seasonId);
      if (!season) {
        return res.status(404).json({
          success: false,
          error: { message: "Season not found" }
        });
      }
      data = {
        ...data,
        seasonTitle: season.title,
        seasonIndex: season.index,
      };
    } else if (series.type === 'limited') {
      // For limited series, remove any season-related fields
      delete data.seasonId;
      delete data.seasonTitle;
      delete data.seasonIndex;
    }

    const episode = await createEpisode(data);
    return res.status(201).json({success: true, data: episode});
  } catch (err: any) {
    return res.status(422).json({
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
    const body = req.body;
    const { seriesId, seasonId } = body;

    let data = { ...body };

    // If episode has seriesId, check series type to handle season data
    if (seriesId) {
      const series = await getSeriesById(seriesId);
      if (!series) {
        return res.status(404).json({
          success: false,
          error: { message: "Series not found" }
        });
      }

      // Only fetch season data for season-based series
      if (series.type === 'season-based' && seasonId) {
        const season = await getSeasonById(seriesId, seasonId);
        if (!season) {
          return res.status(404).json({
            success: false,
            error: { message: "Season not found" }
          });
        }
        data = {
          ...data,
          seasonTitle: season.title,
          seasonIndex: season.index,
        };
      } else if (series.type === 'limited') {
        // For limited series, remove any season-related fields
        delete data.seasonId;
        delete data.seasonTitle;
        delete data.seasonIndex;
      }
    }

    const updated = await updateEpisode(id, data);
    return res.json({success: true, data: updated});
  } catch (err) {
    return res.status(422).json({
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
    return res.json({success: true, message: "Episode deleted"});
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: {
        message: "Failed to delete episode",
      },
    });
  }
};
