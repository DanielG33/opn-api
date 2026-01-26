import {Request, Response, NextFunction} from "express";
import * as admin from "firebase-admin";

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader: string | undefined = req.headers.authorization;

  console.log('[authMiddleware] Processing request to:', req.path);
  console.log('[authMiddleware] Authorization header present:', !!authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log('[authMiddleware] No valid auth header, returning 403');
    res.status(403).send("Unauthorized");
    return;
  }

  const idToken = authHeader.split("Bearer ")[1];
  console.log('[authMiddleware] Token extracted, length:', idToken.length);

  // TODO: Remove this before deploying
  if (idToken == "testing") {
    req.user = {
      uid: "vUoI2yv5K6cPqBrAOD486OO1ScJ3",
      email: "danielguzman9633@gmail.com",
      role: "producer",
    };

    next();
    return;
  }

  try {
    console.log('[authMiddleware] Verifying token with Firebase...');
    const decoded = await admin.auth().verifyIdToken(idToken);
    console.log('[authMiddleware] Token verified successfully for user:', decoded.uid);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      role: decoded.role || "user",
    };
    next();
    return;
  } catch (error) {
    console.error('[authMiddleware] Token verification failed:', error);
    res.status(403).send("Unauthorized");
    return;
  }

  // const authHeader = req.headers.authorization;

  // if (authHeader?.startsWith('Bearer ')) {
  //   const token = authHeader.split(' ')[1];
  //   try {
  //     const decoded = await admin.auth().verifyIdToken(token);
  //     req.user = {
  //       uid: decoded.uid,
  //       email: decoded.email,
  //       role: decoded.role || 'user'
  //     };
  //   } catch (err) {
  //     console.warn('Invalid token');
  //   }
  // }

  // next();
};

/**
 * Optional auth middleware - attempts to authenticate but doesn't fail if no auth provided
 * Sets req.user if authentication succeeds, otherwise continues without user
 * Useful for endpoints that support both public and authenticated access
 */
export const optionalAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader: string | undefined = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // No auth provided - continue without user
    next();
    return;
  }

  const idToken = authHeader.split("Bearer ")[1];

  // TODO: Remove this before deploying
  if (idToken == "testing") {
    req.user = {
      uid: "vUoI2yv5K6cPqBrAOD486OO1ScJ3",
      email: "danielguzman9633@gmail.com",
      role: "producer",
    };
    next();
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      role: decoded.role || "user",
    };
    next();
    return;
  } catch (error) {
    // Invalid token - continue without user
    console.warn('Invalid auth token provided');
    next();
    return;
  }
};

