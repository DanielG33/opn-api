// import { initializeApp } from "firebase-admin/app";
import {onRequest} from "firebase-functions/v2/https";
import app from "./app";

// Import Cloud Functions
export { onVideoRatingWrite } from "./functions/reactionTrigger";
export { onSeriesSubContentUpdate, onSeriesSubContentDelete } from "./functions/subcontentSnapshotSync";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// initializeApp();
export const api = onRequest({
  cors: ['https://opn-workspace.web.app', 'https://opn-public.web.app'],
  maxInstances: 10
}, app);
