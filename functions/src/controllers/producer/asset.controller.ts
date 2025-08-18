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

export const updateAsset = async (req: Request, res: Response) => {
  const {seriesId, assetId} = req.params;
  const updates = req.body;

  try {
    // Get current asset data to compare names
    const currentAsset = await Asset.getAssetById(seriesId, assetId);
    if (!currentAsset) {
      return res.status(404).json({success: false, error: "Asset not found"});
    }

    // Only update if name has actually changed
    if (updates.name && updates.name !== currentAsset.name) {
      const updatedAsset = await Asset.updateAsset(seriesId, assetId, updates);
      
      // Update all references to this asset
      await Asset.updateAssetReferences(seriesId, assetId, updates.name);
      
      return res.status(200).json({success: true, data: updatedAsset});
    } else {
      // No actual changes, return current asset
      return res.status(200).json({success: true, data: currentAsset});
    }
  } catch (error: any) {
    console.error(error);
    return res.status(400).json({success: false, error: error.message});
  }
};

export const updateAssetReferences = async (req: Request, res: Response) => {
  const {seriesId, assetId} = req.params;
  const {name} = req.body;

  try {
    await Asset.updateAssetReferences(seriesId, assetId, name);
    res.status(200).json({success: true, message: "Asset references updated successfully"});
  } catch (error: any) {
    console.error(error);
    res.status(400).json({success: false, error: error.message});
  }
};
