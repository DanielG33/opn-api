import { Request, Response } from "express";
import { previewTokenRepository } from "../../repositories/preview-token.repository";
import { db } from "../../firebase";

/**
 * Preview Tokens Controller - Producer/Admin Only
 * 
 * Authorization Model:
 * - All endpoints require Firebase Auth via authMiddleware (applied to producerRouter)
 * - Producer ownership verified for each series before any token operation
 * - Public API has NO access to these endpoints
 * - Public API can only validate tokens via previewTokenRepository.validateAndTouch()
 *   which is called server-side in public/series.controller.ts
 * 
 * Security:
 * - Firestore rules deny all direct client access to previewTokens collection
 * - Token hashes stored in DB, plaintext tokenString only returned on creation
 * - Client-side caching (localStorage) used to avoid redundant token creation
 */

/**
 * List all preview tokens for a series
 */
export const listPreviewTokens = async (req: Request, res: Response) => {
  try {
    const { seriesId } = req.params;
    const activeOnly = req.query.activeOnly === 'true';

    // Verify series belongs to producer
    const uid = req.user?.uid as string;
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userData: any = userDoc.data();
    const producerId = String(userData.producerId);

    const seriesDoc = await db.collection("series-draft").doc(seriesId).get();
    if (!seriesDoc.exists) {
      return res.status(404).json({ success: false, message: "Series not found" });
    }

    const seriesData: any = seriesDoc.data();
    if (seriesData.producerId !== producerId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const tokens = await previewTokenRepository.listBySeries(seriesId, activeOnly);
    return res.json({ success: true, data: tokens });
  } catch (error) {
    console.error("Error listing preview tokens:", error);
    return res.status(500).json({ success: false, message: "Failed to list preview tokens" });
  }
};

/**
 * Generate a new preview token for a series
 */
export const generatePreviewToken = async (req: Request, res: Response) => {
  try {
    const { seriesId } = req.params;
    const uid = req.user?.uid as string;

    // Verify series belongs to producer
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userData: any = userDoc.data();
    const producerId = String(userData.producerId);

    const seriesDoc = await db.collection("series-draft").doc(seriesId).get();
    if (!seriesDoc.exists) {
      return res.status(404).json({ success: false, message: "Series not found" });
    }

    const seriesData: any = seriesDoc.data();
    if (seriesData.producerId !== producerId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const result = await previewTokenRepository.createForSeries(seriesId, uid);
    
    // Return the token document (without the plaintext tokenString for security)
    return res.status(201).json({ 
      success: true, 
      data: {
        token: result.tokenDoc,
        // Include tokenString only on creation so producer can share the link
        tokenString: result.tokenString
      }
    });
  } catch (error) {
    console.error("Error generating preview token:", error);
    return res.status(500).json({ success: false, message: "Failed to generate preview token" });
  }
};

/**
 * Revoke a preview token
 */
export const revokePreviewToken = async (req: Request, res: Response) => {
  try {
    const { seriesId, tokenId } = req.params;
    const uid = req.user?.uid as string;

    // Verify series belongs to producer
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userData: any = userDoc.data();
    const producerId = String(userData.producerId);

    const seriesDoc = await db.collection("series-draft").doc(seriesId).get();
    if (!seriesDoc.exists) {
      return res.status(404).json({ success: false, message: "Series not found" });
    }

    const seriesData: any = seriesDoc.data();
    if (seriesData.producerId !== producerId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // Verify token belongs to this series
    const tokenDoc = await db.collection("previewTokens").doc(tokenId).get();
    if (!tokenDoc.exists) {
      return res.status(404).json({ success: false, message: "Token not found" });
    }

    const tokenData: any = tokenDoc.data();
    if (tokenData.seriesId !== seriesId) {
      return res.status(403).json({ success: false, message: "Token does not belong to this series" });
    }

    await previewTokenRepository.revoke(tokenId, uid);
    return res.json({ success: true, message: "Token revoked successfully" });
  } catch (error) {
    console.error("Error revoking preview token:", error);
    return res.status(500).json({ success: false, message: "Failed to revoke preview token" });
  }
};

/**
 * Manually refresh a preview token's expiration (extends by 12 hours)
 */
export const refreshPreviewToken = async (req: Request, res: Response) => {
  try {
    const { seriesId, tokenId } = req.params;
    const uid = req.user?.uid as string;

    // Verify series belongs to producer
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userData: any = userDoc.data();
    const producerId = String(userData.producerId);

    const seriesDoc = await db.collection("series-draft").doc(seriesId).get();
    if (!seriesDoc.exists) {
      return res.status(404).json({ success: false, message: "Series not found" });
    }

    const seriesData: any = seriesDoc.data();
    if (seriesData.producerId !== producerId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // Verify token belongs to this series
    const tokenDoc = await db.collection("previewTokens").doc(tokenId).get();
    if (!tokenDoc.exists) {
      return res.status(404).json({ success: false, message: "Token not found" });
    }

    const tokenData: any = tokenDoc.data();
    if (tokenData.seriesId !== seriesId) {
      return res.status(403).json({ success: false, message: "Token does not belong to this series" });
    }

      if (tokenData.revokedAt) {
        return res.status(409).json({ success: false, message: "Token has been revoked" });
      }

      const expiresAt = await previewTokenRepository.refresh(tokenId);
      return res.json({
        success: true,
        message: "Token refreshed successfully",
        data: {
          expiresAt,
          expiresAtMs: expiresAt.toMillis()
        }
      });
  } catch (error) {
    console.error("Error refreshing preview token:", error);
    return res.status(500).json({ success: false, message: "Failed to refresh preview token" });
  }
};

/**
 * Ensures a valid preview token exists for the series.
 * Always creates a new token since we cannot retrieve tokenString for existing tokens (only hashes are stored).
 * This endpoint is designed for admin/iframe usage where a tokenString is required.
 */
export const ensurePreviewToken = async (req: Request, res: Response) => {
  try {
    const { seriesId } = req.params;
    const uid = req.user?.uid as string;

    // Verify series belongs to producer
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userData: any = userDoc.data();
    const producerId = String(userData.producerId);

    const seriesDoc = await db.collection("series-draft").doc(seriesId).get();
    if (!seriesDoc.exists) {
      return res.status(404).json({ success: false, message: "Series not found" });
    }

    const seriesData: any = seriesDoc.data();
    if (seriesData.producerId !== producerId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // Always create a new token since we cannot retrieve tokenString for existing tokens
    // (we only store hashes for security)
    const result = await previewTokenRepository.createForSeries(seriesId, uid);
    
    return res.status(200).json({
      success: true,
      data: {
        tokenId: result.tokenDoc.id,
        tokenString: result.tokenString,
        expiresAt: result.tokenDoc.expiresAt,
        expiresAtMs: result.tokenDoc.expiresAt.toMillis()
      }
    });
  } catch (error) {
    console.error("Error ensuring preview token:", error);
    return res.status(500).json({ success: false, message: "Failed to ensure preview token" });
  }
};
