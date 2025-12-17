import { Request, Response } from "express";
import * as FolderService from "../../services/folders.service";

export const listFolders = async (req: Request, res: Response) => {
  // TODO: check if requested series belongs to requester token
  const { seriesId } = req.params;
  
  try {
    const folders = await FolderService.getFoldersBySeries(seriesId);
    res.json({ success: true, data: folders });
  } catch (err) {
    console.error("Error fetching folders:", err);
    res.status(500).json({
      success: false,
      error: {
        message: "Failed to fetch folders",
      },
    });
  }
};

export const getFolder = async (req: Request, res: Response) => {
  const { seriesId, folderId } = req.params;
  
  try {
    const folder = await FolderService.getFolderById(seriesId, folderId);
    if (!folder) {
      return res.status(404).json({ success: false, error: "Folder not found" });
    }
    return res.json({ success: true, data: folder });
  } catch (err) {
    console.error("Error fetching folder:", err);
    return res.status(500).json({
      success: false,
      error: {
        message: "Failed to fetch folder",
      },
    });
  }
};

export const createFolder = async (req: Request, res: Response) => {
  const { seriesId } = req.params;
  const { name, parentId, path } = req.body;

  try {
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Folder name is required"
      });
    }

    const folderData = {
      name: name.trim(),
      parentId: parentId || null,
      path: path || '/',
      createdAt: Date.now()
    };

    const folder = await FolderService.createFolder(seriesId, folderData);
    return res.status(201).json({ success: true, data: folder });
  } catch (error: any) {
    console.error("Error creating folder:", error);
    return res.status(400).json({ success: false, error: error.message });
  }
};

export const updateFolder = async (req: Request, res: Response) => {
  const { seriesId, folderId } = req.params;
  const updates = req.body;

  try {
    // Remove id from updates if present
    delete updates.id;
    
    const updatedFolder = await FolderService.updateFolder(seriesId, folderId, updates);
    res.status(200).json({ success: true, data: updatedFolder });
  } catch (error: any) {
    console.error("Error updating folder:", error);
    res.status(400).json({ success: false, error: error.message });
  }
};

export const deleteFolder = async (req: Request, res: Response) => {
  const { seriesId, folderId } = req.params;

  try {
    await FolderService.deleteFolder(seriesId, folderId);
    res.status(200).json({ success: true, message: "Folder deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting folder:", error);
    res.status(400).json({ success: false, error: error.message });
  }
};