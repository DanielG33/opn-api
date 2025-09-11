import { db } from "../firebase";
import { Producer } from "../models/producer";

export const getProducerById = async (id: string): Promise<Producer | null> => {
  try {
    const doc = await db.collection("producers").doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as Producer : null;
  } catch (error) {
    console.error("Error fetching producer:", error);
    return null;
  }
};

export const updateProducerById = async (id: string, data: Partial<Producer>): Promise<Producer | null> => {
  try {
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    
    await db.collection("producers").doc(id).update(updateData);
    
    // Return the updated producer
    const updatedDoc = await db.collection("producers").doc(id).get();
    return updatedDoc.exists ? { id: updatedDoc.id, ...updatedDoc.data() } as Producer : null;
  } catch (error) {
    console.error("Error updating producer:", error);
    throw error;
  }
};

export const createProducer = async (data: Omit<Producer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Producer> => {
  try {
    const now = new Date().toISOString();
    const producerData = {
      ...data,
      createdAt: now,
      updatedAt: now
    };
    
    const docRef = await db.collection("producers").add(producerData);
    
    return { id: docRef.id, ...producerData } as Producer;
  } catch (error) {
    console.error("Error creating producer:", error);
    throw error;
  }
};
