import { Request, Response } from "express";
import {
  getSeriesSubContent,
  getSubContentById,
  createSeriesSubContent,
  updateSeriesSubContent,
  deleteSeriesSubContent,
  getPublishedSeriesSubContent
} from "../../services/series-subcontent.service";

// Get all sub-content for a series (admin)
export const getSeriesSubContentController = async (req: Request, res: Response) => {
  try {
    const { seriesId } = req.params;
    const { status } = req.query;
    
    const filters = status ? { status: status as string } : undefined;
    const subContent = await getSeriesSubContent(seriesId, filters);
    
    res.json(subContent);
  } catch (error) {
    console.error("Error fetching series sub-content:", error);
    res.status(500).json({ error: "Failed to fetch series sub-content" });
  }
};

// Get published sub-content for a series (public)
export const getPublishedSeriesSubContentController = async (req: Request, res: Response) => {
  try {
    const { seriesId } = req.params;
    
    // This is called from public route, so check series publication status
    const subContent = await getPublishedSeriesSubContent(seriesId, true);
    res.json(subContent);
  } catch (error) {
    console.error("Error fetching published series sub-content:", error);
    res.status(500).json({ error: "Failed to fetch published series sub-content" });
  }
};

// Get specific sub-content item
export const getSubContentByIdController = async (req: Request, res: Response) => {
  try {
    const { seriesId, subContentId } = req.params;

    const subContent = await getSubContentById(seriesId, subContentId);
    if (!subContent) {
      return res.status(404).json({ error: "Sub-content not found" });
    }
    
    return res.json(subContent);
  } catch (error) {
    console.error("Error fetching sub-content:", error);
    return res.status(500).json({ error: "Failed to fetch sub-content" });
  }
};

// Create new sub-content
export const createSeriesSubContentController = async (req: Request, res: Response) => {
  try {
    const { seriesId } = req.params;
    const subContentData = req.body;

    const subContent = await createSeriesSubContent(seriesId, subContentData);
    res.status(201).json(subContent);
  } catch (error) {
    console.error("Error creating series sub-content:", error);
    res.status(500).json({ error: "Failed to create series sub-content" });
  }
};

// Update existing sub-content
export const updateSeriesSubContentController = async (req: Request, res: Response) => {
  try {
    const { seriesId, subContentId } = req.params;
    const updateData = req.body;

    const subContent = await updateSeriesSubContent(seriesId, subContentId, updateData);
    res.json(subContent);
  } catch (error) {
    console.error("Error updating series sub-content:", error);
    res.status(500).json({ error: "Failed to update series sub-content" });
  }
};

// Delete sub-content
export const deleteSeriesSubContentController = async (req: Request, res: Response) => {
  try {
    const { seriesId, subContentId } = req.params;

    const result = await deleteSeriesSubContent(seriesId, subContentId);
    res.json(result);
  } catch (error) {
    console.error("Error deleting series sub-content:", error);
    res.status(500).json({ error: "Failed to delete series sub-content" });
  }
};