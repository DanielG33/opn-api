import {Router} from "express";
import {fetchCategories} from "../controllers/category.controller";
import { getSeriesById } from "../controllers/public/series.controller";
import { getEpisode, getEpisodesById, getEpisodesBySeries, getEpisodesBySeason } from "../controllers/public/episodes.controller";
import { signIn, signUp } from "../controllers/auth.controller";
import { getHomeContent } from "../controllers/public/home.controller";
import { getCategoryContent } from "../controllers/public/category.controller";
import { getPublishedSeriesSubContentController } from "../controllers/producer/series-subcontent.controller";
import { optionalAuthMiddleware } from "../middlewares/auth.middleware";

export const publicRouter = Router();

publicRouter.get("/", (req, res) => {
  res.json({message: "Hello there!"});
});

publicRouter.get("/home", getHomeContent);
publicRouter.get("/categories", fetchCategories);
publicRouter.get("/categories/:categoryId", getCategoryContent);

// Series endpoint with optional auth for draft mode support
publicRouter.get("/series/:id", optionalAuthMiddleware, getSeriesById);
publicRouter.get("/series/:seriesId/episodes", optionalAuthMiddleware, getEpisodesBySeries);
publicRouter.get("/series/:seriesId/seasons/:seasonId/episodes", optionalAuthMiddleware, getEpisodesBySeason);
publicRouter.get("/series/:seriesId/sub-content", optionalAuthMiddleware, getPublishedSeriesSubContentController);
publicRouter.get("/episodes", getEpisodesById);
publicRouter.get("/episodes/:id", getEpisode);

// Auth endpoints (public access)
publicRouter.post("/auth/signin", signIn);
publicRouter.post("/auth/signup", signUp);
publicRouter.post("/auth/sign-up", signUp);
