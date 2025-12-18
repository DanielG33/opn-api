import { Router } from "express";
import { fetchCategories } from "../controllers/category.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
  listProducerSeries,
  getProducerSeries,
  createProducerSeries,
  updateProducerSeries,
  deleteProducerSeries,
  // submitProducerSeries,
} from "../controllers/producer/series.controller";
import {
  createProducerEpisode,
  deleteProducerEpisode,
  getProducerEpisode,
  listProducerEpisodes,
  updateProducerEpisode,
} from "../controllers/producer/episode.controller";
import {
  listSeasons,
  getSeason,
  createSeasonController,
  updateSeasonController,
  deleteSeasonController
} from "../controllers/producer/season.controllers";
import {
  getProfileMe,
  getProfileProducer,
  updateProfileMe
} from "../controllers/producer/account.controller";
import {
  listSponsors,
  getSponsor,
  createSponsorController,
  updateSponsorController,
  deleteSponsorController
} from "../controllers/producer/sponsor.controller";
import {
  createAsset,
  listAssets,
  updateAsset,
  updateAssetReferences
} from "../controllers/producer/asset.controller";
import {
  createFolder,
  deleteFolder,
  getFolder,
  listFolders,
  moveFolder,
  updateFolder
} from "../controllers/producer/folder.controller";
import {
  getBlocks,
  updateAds,
  updateBanners,
  updateBlocksOrder,
  updateCta,
  updateDetails,
  updateEpisodeSliders,
  updateGalleries,
  updateHeroBanner,
  updateNetworks,
  updatePoster,
  updateSponsorSliders
} from "../controllers/producer/series-page.controller";
import {
  createSubcontentVideoController,
  updateSubcontentVideoController,
  deleteSubcontentVideoController,
  getSubcontentVideosController,
  getSubcontentVideoController,
  createSubcontentSliderController,
  updateSubcontentSliderController,
  deleteSubcontentSliderController,
  getSubcontentSlidersController,
  addVideoToSliderController,
  removeVideoFromSliderController
} from "../controllers/producer/subcontent.controller";

export const producerRouter = Router();

producerRouter.use(authMiddleware);

producerRouter.get("/", (req, res) => {
  res.json({ message: "Hello there!" });
});

// CMS pages routes


// Series routes
producerRouter.get("/categories", fetchCategories);
producerRouter.get("/series", listProducerSeries);
producerRouter.post("/series", createProducerSeries);
producerRouter.get("/series/:id", getProducerSeries);
producerRouter.patch("/series/:id", updateProducerSeries);
producerRouter.delete('/series/:id', deleteProducerSeries);
// producerRouter.post('/series/:id/submit', submitProducerSeries);

// Seasons routes
producerRouter.get("/series/:seriesId/seasons", listSeasons);
producerRouter.get("/series/:seriesId/seasons/:seasonId", getSeason);
producerRouter.post("/series/:seriesId/seasons", createSeasonController);
producerRouter.patch("/series/:seriesId/seasons/:seasonId", updateSeasonController);
producerRouter.delete("/series/:seriesId/seasons/:seasonId", deleteSeasonController);

// Assets routes
producerRouter.get("/series/:seriesId/assets", listAssets);
producerRouter.post("/series/:seriesId/assets", createAsset);
producerRouter.put("/series/:seriesId/assets/:assetId", updateAsset);
producerRouter.put("/series/:seriesId/assets/:assetId/update-references", updateAssetReferences);

// Folders routes
producerRouter.get("/series/:seriesId/folders", listFolders);
producerRouter.get("/series/:seriesId/folders/:folderId", getFolder);
producerRouter.post("/series/:seriesId/folders", createFolder);
producerRouter.put("/series/:seriesId/folders/:folderId", updateFolder);
producerRouter.put("/series/:seriesId/folders/:folderId/move", moveFolder);
producerRouter.delete("/series/:seriesId/folders/:folderId", deleteFolder);

// Sponsors routes
producerRouter.get("/series/:seriesId/sponsors", listSponsors);
producerRouter.get("/series/:seriesId/sponsors/:sponsorId", getSponsor);
producerRouter.post("/series/:seriesId/sponsors", createSponsorController);
producerRouter.put("/series/:seriesId/sponsors/:sponsorId", updateSponsorController);
producerRouter.delete("/series/:seriesId/sponsors/:sponsorId", deleteSponsorController);

// Episode routes
producerRouter.get("/episodes", listProducerEpisodes);
producerRouter.post("/episodes", createProducerEpisode);
producerRouter.get("/episodes/:id", getProducerEpisode);
producerRouter.patch("/episodes/:id", updateProducerEpisode);
producerRouter.put("/episodes/:id", updateProducerEpisode);
producerRouter.delete("/episodes/:id", deleteProducerEpisode);

// Account routes
producerRouter.get("/account/producer", getProfileProducer);
producerRouter.get("/account/me", getProfileMe);
producerRouter.put("/account/me", updateProfileMe);

// Series page
producerRouter.get("/series-page/blocks", getBlocks);
producerRouter.put("/series-page/blocks", updateBlocksOrder);
producerRouter.put("/series-page/hero-banner", updateHeroBanner);
producerRouter.put("/series-page/poster", updatePoster);
producerRouter.put("/series-page/cta", updateCta);
producerRouter.put("/series-page/details", updateDetails);
producerRouter.put("/series-page/social-networks", updateNetworks);
producerRouter.put("/series-page/episodes-sliders", updateEpisodeSliders);
producerRouter.put("/series-page/galleries", updateGalleries);
producerRouter.put("/series-page/banners", updateBanners);
producerRouter.put("/series-page/ads", updateAds);
producerRouter.put("/series-page/sponsors-slider", updateSponsorSliders);

// Subcontent Videos routes
producerRouter.get("/episodes/:episodeId/subcontent-videos", getSubcontentVideosController);
producerRouter.post("/episodes/:episodeId/subcontent-videos", createSubcontentVideoController);
producerRouter.get("/episodes/:episodeId/subcontent-videos/:videoId", getSubcontentVideoController);
producerRouter.put("/episodes/:episodeId/subcontent-videos/:videoId", updateSubcontentVideoController);
producerRouter.delete("/episodes/:episodeId/subcontent-videos/:videoId", deleteSubcontentVideoController);

// Subcontent Sliders routes
producerRouter.get("/episodes/:episodeId/subcontent-sliders", getSubcontentSlidersController);
producerRouter.post("/episodes/:episodeId/subcontent-sliders", createSubcontentSliderController);
producerRouter.put("/episodes/:episodeId/subcontent-sliders/:sliderId", updateSubcontentSliderController);
producerRouter.delete("/episodes/:episodeId/subcontent-sliders/:sliderId", deleteSubcontentSliderController);

// Slider-Video relationship routes
producerRouter.post("/episodes/:episodeId/subcontent-sliders/:sliderId/videos/:videoId", addVideoToSliderController);
producerRouter.delete("/episodes/:episodeId/subcontent-sliders/:sliderId/videos/:videoId", removeVideoFromSliderController);
