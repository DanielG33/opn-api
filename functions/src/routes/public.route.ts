import {Router} from "express";
import {fetchCategories} from "../controllers/category.controller";
import { getSeriesById } from "../controllers/public/series.controller";
import { getEpisode, getEpisodesById, getEpisodesBySeries, getEpisodesBySeason } from "../controllers/public/episodes.controller";
import { signIn, signUp } from "../controllers/auth.controller";
import { getHomeContent } from "../controllers/public/home.controller";
import { getCategoryContent } from "../controllers/public/category.controller";

export const publicRouter = Router();

publicRouter.get("/", (req, res) => {
  res.json({message: "Hello there!"});
});

publicRouter.get("/home", getHomeContent);
publicRouter.get("/categories", fetchCategories);
publicRouter.get("/categories/:categoryId", getCategoryContent);

publicRouter.get("/series/:id", getSeriesById);
publicRouter.get("/series/:seriesId/episodes", getEpisodesBySeries);
publicRouter.get("/series/:seriesId/seasons/:seasonId/episodes", getEpisodesBySeason);
publicRouter.get("/episodes", getEpisodesById);
publicRouter.get("/episodes/:id", getEpisode);

// Auth endpoints (public access)
publicRouter.post("/auth/signin", signIn);
publicRouter.post("/auth/signup", signUp);
publicRouter.post("/auth/sign-up", signUp);
