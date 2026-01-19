import express from "express";
import cors from "cors";
// import { authMiddleware } from './middleware/auth.middleware';
import {publicRouter} from "./routes/public.route";
import { userRouter } from './routes/user.route';
import {producerRouter} from "./routes/producer.route";
import { reactionsRouter } from './routes/reactions.route';
import { authRouter } from './routes/auth.route';

const app = express();
app.use(cors({
  origin: ['https://opn-workspace.web.app', 'https://opn-public.web.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());


app.use("/v1/public", publicRouter);
app.use('/v1/user', userRouter);
app.use("/v1/producer", producerRouter);
app.use('/v1', reactionsRouter);
app.use('/auth', authRouter); // Mount auth routes directly under /auth

export default app;
