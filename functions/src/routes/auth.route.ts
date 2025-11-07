import {Router} from "express";
import {signIn, signUp} from "../controllers/auth.controller";

export const authRouter = Router();

authRouter.post("/signin", signIn);
authRouter.post("/signup", signUp);
authRouter.post("/sign-up", signUp); // Alternative endpoint to match client calls
