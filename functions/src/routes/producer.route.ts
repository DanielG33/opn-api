import { Router } from 'express';
import { fetchCategories } from '../controllers/category.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  listProducerSeries,
  getProducerSeries,
  createProducerSeries,
  updateProducerSeries,
  // deleteProducerSeries,
  // submitProducerSeries,
} from '../controllers/producer/series.controller';
import {
  createProducerEpisode,
  deleteProducerEpisode,
  getProducerEpisode,
  listProducerEpisodes,
  updateProducerEpisode
} from '../controllers/producer/episode.controller';
import { listSeasons, getSeason, createSeasonController, updateSeasonController, deleteSeasonController } from '../controllers/producer/season.controllers';
import { getProfileMe, getProfileProducer } from '../controllers/producer/account.controller';

export const producerRouter = Router();

producerRouter.use(authMiddleware);

producerRouter.get('/', (req, res) => {
  res.json({ message: `Hello there!` });
});

// Series routes
producerRouter.get('/categories', fetchCategories);
producerRouter.get('/series', listProducerSeries);
producerRouter.post('/series', createProducerSeries);
producerRouter.get('/series/:id', getProducerSeries);
producerRouter.patch('/series/:id', updateProducerSeries);
// producerRouter.delete('/series/:id', deleteProducerSeries);
// producerRouter.post('/series/:id/submit', submitProducerSeries);

// Seasons routes
producerRouter.get('/series/:seriesId/seasons', listSeasons);
producerRouter.get('/series/:seriesId/seasons/:seasonId', getSeason);
producerRouter.post('/series/:seriesId/seasons', createSeasonController);
producerRouter.patch('/series/:seriesId/seasons/:seasonId', updateSeasonController);
producerRouter.delete('/series/:seriesId/seasons/:seasonId', deleteSeasonController);

// Episode routes
producerRouter.get('/episodes', listProducerEpisodes);
producerRouter.post('/episodes', createProducerEpisode);
producerRouter.get('/episodes/:id', getProducerEpisode);
producerRouter.patch('/episodes/:id', updateProducerEpisode);
producerRouter.delete('/episodes/:id', deleteProducerEpisode);

// Account routes
producerRouter.get('/account/producer', getProfileProducer);
producerRouter.get('/account/me', getProfileMe);
