import {Router} from "express";
import {fetchCategories} from "../controllers/category.controller";
import { getSeriesById } from "../controllers/public/series.controller";
import { getEpisode, getEpisodesById, getEpisodesBySeries, getEpisodesBySeason } from "../controllers/public/episodes.controller";

export const publicRouter = Router();

publicRouter.get("/", (req, res) => {
  res.json({message: "Hello there!"});
});

publicRouter.get("/categories", fetchCategories);

publicRouter.get("/series/:id", getSeriesById);
publicRouter.get("/series/:seriesId/episodes", getEpisodesBySeries);
publicRouter.get("/series/:seriesId/seasons/:seasonId/episodes", getEpisodesBySeason);
publicRouter.get("/episodes", getEpisodesById);
publicRouter.get("/episodes/:id", getEpisode);
