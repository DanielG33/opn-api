import {Router} from "express";
import {fetchCategories} from "../controllers/category.controller";
import { getSeriesById } from "../controllers/public/series.controller";
import { getEpisodesById } from "../controllers/public/episodes.controller";

export const publicRouter = Router();

publicRouter.get("/", (req, res) => {
  res.json({message: "Hello there!"});
});

publicRouter.get("/categories", fetchCategories);

publicRouter.get("/series/:id", getSeriesById);
publicRouter.get("/episodes", getEpisodesById);
