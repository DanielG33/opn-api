// import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { FieldValue as FirestoreFieldValue } from "firebase-admin/firestore";

// Initialize Firebase Admin
// In production, credentials are automatically provided
// In emulator/local dev, we use the FIREBASE_AUTH_EMULATOR_HOST for auth operations
admin.initializeApp();

export const db = admin.firestore();

export const bucket = admin.storage().bucket();

export const FieldValue = FirestoreFieldValue;

// Helper to check if running in emulator
export const isEmulator = () => {
  return process.env.FUNCTIONS_EMULATOR === 'true' || 
         process.env.FIREBASE_AUTH_EMULATOR_HOST !== undefined;
};
