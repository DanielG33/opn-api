import { Request, Response } from "express";
import {
  getSeriesSliders,
  getSeriesSliderById,
  createSeriesSlider,
  updateSeriesSlider,
  deleteSeriesSlider,
  addItemToSeriesSlider,
  removeItemFromSeriesSlider
} from "../../services/series-sliders.service";

// Get all sliders for a series
export const getSeriesSlidersController = async (req: Request, res: Response) => {
  try {
    const { seriesId } = req.params;
    
    const sliders = await getSeriesSliders(seriesId);
    res.json(sliders);
  } catch (error) {
    console.error("Error fetching series sliders:", error);
    res.status(500).json({ error: "Failed to fetch series sliders" });
  }
};

// Get a specific slider by ID
export const getSeriesSliderByIdController = async (req: Request, res: Response) => {
  try {
    const { seriesId, sliderId } = req.params;

    const slider = await getSeriesSliderById(seriesId, sliderId);
    if (!slider) {
      return res.status(404).json({ error: "Slider not found" });
    }
    
    return res.json(slider);
  } catch (error) {
    console.error("Error fetching slider:", error);
    return res.status(500).json({ error: "Failed to fetch slider" });
  }
};

// Create a new series slider
export const createSeriesSliderController = async (req: Request, res: Response) => {
  try {
    const { seriesId } = req.params;
    const sliderData = req.body;

    const slider = await createSeriesSlider(seriesId, sliderData);
    res.status(201).json(slider);
  } catch (error) {
    console.error("Error creating series slider:", error);
    res.status(500).json({ error: "Failed to create series slider" });
  }
};

// Update an existing series slider
export const updateSeriesSliderController = async (req: Request, res: Response) => {
  try {
    const { seriesId, sliderId } = req.params;
    const sliderData = req.body;

    const slider = await updateSeriesSlider(seriesId, sliderId, sliderData);
    res.json(slider);
  } catch (error) {
    console.error("Error updating series slider:", error);
    res.status(500).json({ error: "Failed to update series slider" });
  }
};

// Delete a series slider
export const deleteSeriesSliderController = async (req: Request, res: Response) => {
  try {
    const { seriesId, sliderId } = req.params;

    const result = await deleteSeriesSlider(seriesId, sliderId);
    res.json(result);
  } catch (error) {
    console.error("Error deleting series slider:", error);
    res.status(500).json({ error: "Failed to delete series slider" });
  }
};

// Add a sub-content item to a slider
export const addItemToSeriesSliderController = async (req: Request, res: Response) => {
  try {
    const { seriesId, sliderId, itemId } = req.params;

    const slider = await addItemToSeriesSlider(seriesId, sliderId, itemId);
    res.json(slider);
  } catch (error) {
    console.error("Error adding item to slider:", error);
    res.status(500).json({ error: "Failed to add item to slider" });
  }
};

// Remove a sub-content item from a slider
export const removeItemFromSeriesSliderController = async (req: Request, res: Response) => {
  try {
    const { seriesId, sliderId, itemId } = req.params;

    const slider = await removeItemFromSeriesSlider(seriesId, sliderId, itemId);
    res.json(slider);
  } catch (error) {
    console.error("Error removing item from slider:", error);
    res.status(500).json({ error: "Failed to remove item from slider" });
  }
};
