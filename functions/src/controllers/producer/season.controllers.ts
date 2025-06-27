import {Request, Response} from "express";
import {
  getSeasonsBySeries,
  getSeasonById,
  createSeason,
  updateSeason,
  deleteSeason,
} from "../../services/season.service";

export const listSeasons = async (req: Request, res: Response) => {
  const {seriesId} = req.params;
  try {
    const seasons = await getSeasonsBySeries(seriesId);
    res.json({success: true, data: seasons});
  } catch (err) {
    res.status(500).json({
      success: false,
      error: {
        message: "Failed to fetch seasons",
      },
    });
  }
};

export const getSeason = async (req: Request, res: Response) => {
  const {seriesId, seasonId} = req.params;
  const season = await getSeasonById(seriesId, seasonId);
  if (!season) return res.status(404).json({message: "Season not found"});
  return res.json({success: true, data: season});
};

export const createSeasonController = async (req: Request, res: Response) => {
  const {seriesId} = req.params;
  try {
    const season = await createSeason(seriesId, req.body);
    res.status(201).json({success: true, data: season});
  } catch (err: any) {
    res.status(422).json({success: false, error: {message: err.message}});
  }
};

export const updateSeasonController = async (req: Request, res: Response) => {
  const {seriesId, seasonId} = req.params;
  try {
    const updated = await updateSeason(seriesId, seasonId, req.body);
    res.json({success: true, data: updated});
  } catch (err) {
    res.status(422).json({
      success: false,
      error: {
        message: "Failed to update season",
      },
    });
  }
};

export const deleteSeasonController = async (req: Request, res: Response) => {
  const {seriesId, seasonId} = req.params;
  try {
    await deleteSeason(seriesId, seasonId);
    res.json({success: true, message: "Season deleted"});
  } catch (err) {
    res.status(500).json({
      success: false,
      error: {
        message: "Failed to delete season",
      },
    });
  }
};
