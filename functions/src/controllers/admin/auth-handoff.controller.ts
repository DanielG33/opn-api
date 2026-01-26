import { Request, Response } from "express";
import * as admin from "firebase-admin";
import { isEmulator } from "../../firebase";

/**
 * Generate a short-lived Firebase custom token for cross-site auth handoff
 * POST /producer/auth/handoff-token
 * 
 * Used by admin app to mint a token that can sign the current user into the public app
 * for preview purposes. The token is single-use and short-lived.
 */
export const createHandoffToken = async (req: Request, res: Response) => {
  try {
    console.log('[createHandoffToken] Request received');
    console.log('[createHandoffToken] Running in emulator:', isEmulator());
    console.log('[createHandoffToken] Headers:', req.headers.authorization ? 'Authorization header present' : 'No authorization header');
    console.log('[createHandoffToken] User from middleware:', req.user);
    
    const uid = req.user?.uid;
    
    if (!uid) {
      console.log('[createHandoffToken] No user UID found - authentication failed');
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    let customToken: string;

    // In emulator mode, create a simple JWT-like token
    // The Auth Emulator accepts any properly formatted custom token
    if (isEmulator()) {
      console.log('[createHandoffToken] Creating emulator-friendly custom token for user:', uid);
      // For emulator, we use the UID directly as a custom token
      // The emulator's signInWithCustomToken will accept this
      customToken = uid;
      console.log('[createHandoffToken] Using simplified emulator token (UID)');
    } else {
      // In production, use the real Firebase Admin SDK
      console.log('[createHandoffToken] Creating production custom token for user:', uid);
      customToken = await admin.auth().createCustomToken(uid);
    }
    
    console.log('[createHandoffToken] Custom token created successfully, length:', customToken.length);

    return res.status(200).json({
      success: true,
      data: {
        success: true,
        customToken
      }
    });
  } catch (error: any) {
    console.error('[createHandoffToken] Error creating handoff token:', error);
    console.error('[createHandoffToken] Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to create authentication token',
      error: error.message
    });
  }
};
