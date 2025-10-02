import express from "express";
import cors from "cors";
// import { authMiddleware } from './middleware/auth.middleware';
import {publicRouter} from "./routes/public.route";
import { userRouter } from './routes/user.route';
import {producerRouter} from "./routes/producer.route";
// import { adminRouter } from './routes/admin.route';

const app = express();
app.use(cors());
app.use(express.json());


app.use("/v1/public", publicRouter);
app.use('/v1/user', userRouter);
app.use("/v1/producer", producerRouter);
// app.use('/admin', adminRouter);

export default app;
