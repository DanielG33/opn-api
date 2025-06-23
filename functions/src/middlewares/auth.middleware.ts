import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  let idToken;
  const authHeader: string | undefined = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(403).send("Unauthorized");
    return;
  }

  idToken = authHeader.split("Bearer ")[1];

  // TODO: Remove this before deploying
  if (idToken == 'testing') {
    req.user = {
      uid: 'vUoI2yv5K6cPqBrAOD486OO1ScJ3',
      email: 'danielguzman9633@gmail.com',
      role: 'producer'
    };

    next();
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      role: decoded.role || 'user'
    };
    next();
    return;
  } catch (error) {
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
