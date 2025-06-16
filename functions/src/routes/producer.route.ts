import { Router } from 'express';

export const producerRouter = Router();

producerRouter.get('/', (req, res) => {
  res.json({ message: `Hello there!` });
});
