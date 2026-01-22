// import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { FieldValue as FirestoreFieldValue } from "firebase-admin/firestore";

admin.initializeApp();

export const db = admin.firestore();

export const bucket = admin.storage().bucket();

export const FieldValue = FirestoreFieldValue;
