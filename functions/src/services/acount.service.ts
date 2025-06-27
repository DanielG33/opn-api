import {db} from "../firebase";
import {Series} from "../models/series";

export const getUserProfile = async (id: string) => {
  const doc = await db.collection("users").doc(id).get();
  return doc.exists ? {id: doc.id, ...doc.data()} as Series : null;
};

export const getProducer = async (id: string) => {
  const doc = await db.collection("producers").doc(id).get();
  return doc.exists ? {id: doc.id, ...doc.data()} as Series : null;
};
