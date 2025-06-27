import "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
        role: "user" | "producer" | "admin";
      };
    }
  }
}
