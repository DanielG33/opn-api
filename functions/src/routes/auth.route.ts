import {Router} from "express";
import {signIn} from "../controllers/auth.controller";

export const authRouter = Router();

authRouter.post("/signin", signIn);
