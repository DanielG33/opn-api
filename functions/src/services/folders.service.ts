import { db } from "../firebase";
import { Folder } from "../models/folder";

export const getFoldersBySeries = async (seriesId: string): Promise<Folder[]> => {
  const snapshot = await db.collection(`series/${seriesId}/folders`).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Folder));
};

export const getFolderById = async (seriesId: string, folderId: string): Promise<Folder | null> => {
  const doc = await db.collection(`series/${seriesId}/folders`).doc(folderId).get();
  return doc.exists ? ({ id: doc.id, ...doc.data() } as Folder) : null;
};

export const createFolder = async (seriesId: string, folderData: Omit<Folder, 'id'>): Promise<Folder> => {
  const folderWithTimestamp: Partial<Folder> = {
    ...folderData,
    createdAt: folderData.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  const docRef = await db.collection(`series/${seriesId}/folders`).add(folderWithTimestamp);
  
  return { id: docRef.id, ...folderWithTimestamp } as Folder;
};

export const updateFolder = async (
  seriesId: string, 
  folderId: string, 
  updates: Partial<Folder>
): Promise<Folder> => {
  const folderRef = db.collection(`series/${seriesId}/folders`).doc(folderId);
  
  const updatesWithTimestamp = {
    ...updates,
    updatedAt: Date.now(),
  };

  await folderRef.update(updatesWithTimestamp);
  
  const updatedDoc = await folderRef.get();
  return { id: updatedDoc.id, ...updatedDoc.data() } as Folder;
};

export const deleteFolder = async (seriesId: string, folderId: string): Promise<void> => {
  // Get all child folders and assets first
  const folderRef = db.collection(`series/${seriesId}/folders`).doc(folderId);
  const folder = await folderRef.get();
  
  if (!folder.exists) {
    throw new Error("Folder not found");
  }

  const folderData = folder.data() as Folder;
  
  // Check for child folders
  const childFoldersSnapshot = await db.collection(`series/${seriesId}/folders`)
    .where('parentId', '==', folderId)
    .get();
    
  if (!childFoldersSnapshot.empty) {
    throw new Error("Cannot delete folder with subfolders. Please delete or move subfolders first.");
  }

  // Check for assets in this folder
  const assetsSnapshot = await db.collection(`series/${seriesId}/assets`)
    .where('folderId', '==', folderId)
    .get();
    
  if (!assetsSnapshot.empty) {
    throw new Error("Cannot delete folder containing assets. Please delete or move assets first.");
  }

  // Delete the folder
  await folderRef.delete();
};