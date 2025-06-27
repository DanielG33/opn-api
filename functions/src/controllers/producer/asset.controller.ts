import {Request, Response} from "express";
import * as Asset from "../../services/assets.service";

export const listAssets = async (req: Request, res: Response) => {
  // TODO: check if requested series belongs to requester token
  const {seriesId} = req.params;
  try {
    const assets = await Asset.getAssetsBySeries(seriesId);
    res.json({success: true, data: assets});
  } catch (err) {
    res.status(500).json({
      success: false,
      error: {
        message: "Failed to fetch assets",
      },
    });
  }
};

export const createAsset = async (req: Request, res: Response) => {
  const {seriesId} = req.params;
  const {path, name, base64EncodedFile, size} = req.body;

  try {
    const asset = await Asset.createAsset({
      path,
      name,
      base64EncodedFile,
      size,
      seriesId,
    });

    res.status(200).json({success: true, data: asset});
  } catch (error: any) {
    console.error(error);
    res.status(400).json({success: false, error: error.message});
  }
};
