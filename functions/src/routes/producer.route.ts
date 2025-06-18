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

export const producerRouter = Router();

producerRouter.use(authMiddleware);

producerRouter.get('/', (req, res) => {
  res.json({ message: `Hello there!` });
});

producerRouter.get('/categories', fetchCategories);
producerRouter.get('/series', listProducerSeries);
producerRouter.post('/series', createProducerSeries);
producerRouter.get('/series/:id', getProducerSeries);
producerRouter.patch('/series/:id', updateProducerSeries);
// producerRouter.delete('/series/:id', deleteProducerSeries);
// producerRouter.post('/series/:id/submit', submitProducerSeries);
