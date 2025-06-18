import express from 'express';
import cors from 'cors';
// import { authMiddleware } from './middleware/auth.middleware';
import { publicRouter } from './routes/public.route';
// import { userRouter } from './routes/user.route';
import { producerRouter } from './routes/producer.route';
// import { adminRouter } from './routes/admin.route';

const app = express();
app.use(cors());
app.use(express.json());


app.use('/public', publicRouter);
// app.use('/user', userRouter);
app.use('/producer', producerRouter);
// app.use('/admin', adminRouter);

export default app;
