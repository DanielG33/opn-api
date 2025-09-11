import {db} from "../firebase";
import {Series} from "../models/series";

export const getUserProfile = async (id: string) => {
  const doc = await db.collection("users").doc(id).get();
  return doc.exists ? {id: doc.id, ...doc.data()} as Series : null;
};

export const updateUserProfile = async (id: string, data: any) => {
  try {
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    
    await db.collection("users").doc(id).update(updateData);
    
    // Return the updated user
    const updatedDoc = await db.collection("users").doc(id).get();
    return updatedDoc.exists ? { id: updatedDoc.id, ...updatedDoc.data() } : null;
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw error;
  }
};

export const getProducer = async (id: string) => {
  const doc = await db.collection("producers").doc(id).get();
  return doc.exists ? {id: doc.id, ...doc.data()} as Series : null;
};
