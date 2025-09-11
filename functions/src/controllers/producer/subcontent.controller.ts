import { Request, Response } from "express";
import {
  createSubcontentVideo,
  updateSubcontentVideo,
  deleteSubcontentVideo,
  getSubcontentVideos,
  getSubcontentVideoById,
  createSubcontentSlider,
  updateSubcontentSlider,
  deleteSubcontentSlider,
  getSubcontentSliders,
  addVideoToSlider,
  removeVideoFromSlider,
  getEpisodeById
} from "../../services/episode.service";

// Subcontent Videos Controllers
export const createSubcontentVideoController = async (req: Request, res: Response) => {
  try {
    const { episodeId } = req.params;
    const videoData = req.body;

    const video = await createSubcontentVideo(episodeId, videoData);
    res.status(201).json(video);
  } catch (error) {
    console.error("Error creating subcontent video:", error);
    res.status(500).json({ error: "Failed to create subcontent video" });
  }
};

export const updateSubcontentVideoController = async (req: Request, res: Response) => {
  try {
    const { episodeId, videoId } = req.params;
    const videoData = req.body;

    const video = await updateSubcontentVideo(episodeId, videoId, videoData);
    res.json(video);
  } catch (error) {
    console.error("Error updating subcontent video:", error);
    res.status(500).json({ error: "Failed to update subcontent video" });
  }
};

export const deleteSubcontentVideoController = async (req: Request, res: Response) => {
  try {
    const { episodeId, videoId } = req.params;

    const result = await deleteSubcontentVideo(episodeId, videoId);
    res.json(result);
  } catch (error) {
    console.error("Error deleting subcontent video:", error);
    res.status(500).json({ error: "Failed to delete subcontent video" });
  }
};

export const getSubcontentVideosController = async (req: Request, res: Response) => {
  try {
    const { episodeId } = req.params;
    const { status } = req.query;

    const filters = status ? { status: status as string } : undefined;
    const videos = await getSubcontentVideos(episodeId, filters);
    res.json(videos);
  } catch (error) {
    console.error("Error fetching subcontent videos:", error);
    res.status(500).json({ error: "Failed to fetch subcontent videos" });
  }
};

export const getSubcontentVideoController = async (req: Request, res: Response) => {
  try {
    const { episodeId, videoId } = req.params;

    const video = await getSubcontentVideoById(episodeId, videoId);
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }
    return res.json(video);
  } catch (error) {
    console.error("Error fetching subcontent video:", error);
    return res.status(500).json({ error: "Failed to fetch subcontent video" });
  }
};

// Subcontent Sliders Controllers
export const createSubcontentSliderController = async (req: Request, res: Response) => {
  try {
    const { episodeId } = req.params;
    const sliderData = req.body;

    const slider = await createSubcontentSlider(episodeId, sliderData);
    res.status(201).json(slider);
  } catch (error) {
    console.error("Error creating subcontent slider:", error);
    res.status(500).json({ error: "Failed to create subcontent slider" });
  }
};

export const updateSubcontentSliderController = async (req: Request, res: Response) => {
  try {
    const { episodeId, sliderId } = req.params;
    const sliderData = req.body;

    const slider = await updateSubcontentSlider(episodeId, sliderId, sliderData);
    res.json(slider);
  } catch (error) {
    console.error("Error updating subcontent slider:", error);
    res.status(500).json({ error: "Failed to update subcontent slider" });
  }
};

export const deleteSubcontentSliderController = async (req: Request, res: Response) => {
  try {
    const { episodeId, sliderId } = req.params;

    const result = await deleteSubcontentSlider(episodeId, sliderId);
    res.json(result);
  } catch (error) {
    console.error("Error deleting subcontent slider:", error);
    res.status(500).json({ error: "Failed to delete subcontent slider" });
  }
};

export const getSubcontentSlidersController = async (req: Request, res: Response) => {
  try {
    const { episodeId } = req.params;

    // Get episode to extract seriesId for sponsor population
    const episode = await getEpisodeById(episodeId);
    const seriesId = episode?.seriesId;

    const sliders = await getSubcontentSliders(episodeId, seriesId);
    res.json(sliders);
  } catch (error) {
    console.error("Error fetching subcontent sliders:", error);
    res.status(500).json({ error: "Failed to fetch subcontent sliders" });
  }
};

// Slider-Video Relationship Controllers
export const addVideoToSliderController = async (req: Request, res: Response) => {
  try {
    const { episodeId, sliderId, videoId } = req.params;

    const sliders = await addVideoToSlider(episodeId, sliderId, videoId);
    res.json(sliders);
  } catch (error) {
    console.error("Error adding video to slider:", error);
    res.status(500).json({ error: "Failed to add video to slider" });
  }
};

export const removeVideoFromSliderController = async (req: Request, res: Response) => {
  try {
    const { episodeId, sliderId, videoId } = req.params;

    const sliders = await removeVideoFromSlider(episodeId, sliderId, videoId);
    res.json(sliders);
  } catch (error) {
    console.error("Error removing video from slider:", error);
    res.status(500).json({ error: "Failed to remove video from slider" });
  }
};
