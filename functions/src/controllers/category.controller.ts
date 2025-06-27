import {Request, Response} from "express";
import {categories} from "../services/category.service";

export const fetchCategories = (req: Request, res: Response) => {
  res.json({
    data: [...categories],
  });
};
