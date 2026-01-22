import {Request, Response} from "express";
import {
  getSeasonsBySeries,
  getSeasonById,
  createSeason,
  updateSeason,
  deleteSeason,
  batchUpdateSeasons,
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

/**
 * @deprecated Use batchUpdateSeasonsController instead for consistency
 * Creates a single season without validating index uniqueness
 */
export const createSeasonController = async (req: Request, res: Response) => {
  const {seriesId} = req.params;
  try {
    const season = await createSeason(seriesId, req.body);
    res.status(201).json({success: true, data: season});
  } catch (err: any) {
    res.status(422).json({success: false, error: {message: err.message}});
  }
};

/**
 * @deprecated Use batchUpdateSeasonsController instead for consistency
 * Updates a single season without validating index uniqueness
 */
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

/**
 * Batch update all seasons at once (reorder, create, update, delete)
 * Validates sequential indexes 1..N and performs atomic batch write
 */
export const batchUpdateSeasonsController = async (req: Request, res: Response) => {
  const {seriesId} = req.params;
  const {seasons} = req.body;
  
  // Validate input
  if (!Array.isArray(seasons)) {
    return res.status(400).json({
      success: false,
      error: {
        message: "seasons must be an array",
      },
    });
  }
  
  if (seasons.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: "seasons array cannot be empty",
      },
    });
  }
  
  // Validate each season has required fields
  for (const season of seasons) {
    if (!season.title || typeof season.title !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          message: "Each season must have a title",
        },
      });
    }
    
    if (season.index === undefined || season.index === null) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Each season must have an index",
        },
      });
    }
  }
  
  try {
    const updated = await batchUpdateSeasons(seriesId, seasons);
    res.json({
      success: true, 
      data: updated,
      message: `Successfully updated ${updated.length} season(s)`
    });
  } catch (err: any) {
    // Check if it's a validation error (400) or server error (500)
    const statusCode = err.message?.includes('Indexes must be sequential') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      error: {
        message: err.message || "Failed to batch update seasons",
      },
    });
  }
};
