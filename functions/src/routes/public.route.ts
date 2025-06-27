import {Router} from "express";
import {fetchCategories} from "../controllers/category.controller";

export const publicRouter = Router();

publicRouter.get("/", (req, res) => {
  res.json({message: "Hello there!"});
});

publicRouter.get("/categories", fetchCategories);
