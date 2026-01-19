import { Request, Response } from "express";
import {
  submitForReview,
  approveSeries,
  rejectSeries,
  hideSeries,
  publishUpdates,
} from "../../services/series.service";
import { db } from "../../firebase";
import { getUserRole } from "../../utils/series-publication.utils";

/**
 * Submit series for review
 * POST /admin/series/:seriesId/submit-review
 * Allowed for: producer (owner) or super admin
 */
export const submitSeriesForReview = async (req: Request, res: Response) => {
  try {
    const { seriesId } = req.params;
    const uid = req.user?.uid as string;

    // Get user data to find producerId
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userData = userDoc.data();
    const producerId = String(userData?.producerId);

    // Submit for review
    const updatedSeries = await submitForReview(seriesId, producerId);

    return res.status(200).json({
      success: true,
      message: "Series submitted for review",
      data: updatedSeries,
    });
  } catch (err: any) {
    console.error("Error submitting series for review:", err);

    if (err.code === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    if (err.code === "FORBIDDEN") {
      return res.status(403).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    if (err.code === "VALIDATION_FAILED") {
      return res.status(400).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to submit series for review",
      },
    });
  }
};

/**
 * Approve series
 * POST /admin/series/:seriesId/approve
 * Allowed for: super admin only
 */
export const approveSeriesController = async (req: Request, res: Response) => {
  try {
    const { seriesId } = req.params;
    const uid = req.user?.uid as string;

    // Get user data and check role
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userData = userDoc.data();
    const userRole = getUserRole(userData);

    // Approve series
    const updatedSeries = await approveSeries(seriesId, userRole);

    return res.status(200).json({
      success: true,
      message: "Series approved and published",
      data: updatedSeries,
    });
  } catch (err: any) {
    console.error("Error approving series:", err);

    if (err.code === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    if (err.code === "FORBIDDEN") {
      return res.status(403).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    if (err.code === "STATUS_CONFLICT") {
      return res.status(409).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to approve series",
      },
    });
  }
};

/**
 * Reject series
 * POST /admin/series/:seriesId/reject
 * Allowed for: super admin only
 * Body: { reviewNotes?: string }
 */
export const rejectSeriesController = async (req: Request, res: Response) => {
  try {
    const { seriesId } = req.params;
    const { reviewNotes } = req.body;
    const uid = req.user?.uid as string;

    // Get user data and check role
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userData = userDoc.data();
    const userRole = getUserRole(userData);

    // Reject series
    const updatedSeries = await rejectSeries(seriesId, userRole, reviewNotes);

    return res.status(200).json({
      success: true,
      message: "Series rejected",
      data: updatedSeries,
    });
  } catch (err: any) {
    console.error("Error rejecting series:", err);

    if (err.code === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    if (err.code === "FORBIDDEN") {
      return res.status(403).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    if (err.code === "STATUS_CONFLICT") {
      return res.status(409).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to reject series",
      },
    });
  }
};

/**
 * Hide series
 * POST /admin/series/:seriesId/hide
 * Allowed for: producer (owner) or super admin
 */
export const hideSeriesController = async (req: Request, res: Response) => {
  try {
    const { seriesId } = req.params;
    const uid = req.user?.uid as string;

    // Get user data
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userData = userDoc.data();
    const producerId = String(userData?.producerId);
    const userRole = getUserRole(userData);

    // Hide series
    const updatedSeries = await hideSeries(seriesId, producerId, userRole);

    return res.status(200).json({
      success: true,
      message: "Series hidden",
      data: updatedSeries,
    });
  } catch (err: any) {
    console.error("Error hiding series:", err);

    if (err.code === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    if (err.code === "FORBIDDEN") {
      return res.status(403).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    if (err.code === "STATUS_CONFLICT") {
      return res.status(409).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to hide series",
      },
    });
  }
};

/**
 * Publish updates to already PUBLISHED series
 * POST /admin/series/:seriesId/publish-updates
 * Allowed for: producer (owner) or super admin
 */
export const publishUpdatesController = async (req: Request, res: Response) => {
  try {
    const { seriesId } = req.params;
    const uid = req.user?.uid as string;

    // Get user data to find producerId
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userData = userDoc.data();
    const producerId = String(userData?.producerId);

    // Publish updates
    const updatedSeries = await publishUpdates(seriesId, producerId);

    return res.status(200).json({
      success: true,
      message: "Series updates published",
      data: updatedSeries,
    });
  } catch (err: any) {
    console.error("Error publishing series updates:", err);

    if (err.code === "NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    if (err.code === "FORBIDDEN") {
      return res.status(403).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    if (err.code === "VALIDATION_FAILED") {
      return res.status(400).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      });
    }

    if (err.code === "STATUS_CONFLICT") {
      return res.status(409).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to publish series updates",
      },
    });
  }
};
