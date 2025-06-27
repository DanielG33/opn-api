import { Request, Response } from "express";
import { updateSeriesPageBlock } from "../../services/series-page.service";

export const updateHeroBanner = async (req: Request, res: Response) => {
    const { data }: { data: any, type: string } = req.body;
    const seriesId: string = String(req.query['seriesId']);
    const targetValue = {
        heroBanner: data,
        updatedAt: Date.now()
    }

    await updateSeriesPageBlock(seriesId, targetValue)
    return res.json({success: true, data: targetValue});
}