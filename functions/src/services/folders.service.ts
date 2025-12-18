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

export const moveFolder = async (
  seriesId: string, 
  folderId: string, 
  newParentId: string | null
): Promise<Folder> => {
  const batch = db.batch();
  
  // Get the folder to move
  const folderRef = db.collection(`series/${seriesId}/folders`).doc(folderId);
  const folderDoc = await folderRef.get();
  
  if (!folderDoc.exists) {
    throw new Error("Folder not found");
  }

  // Build the new path
  let newPath = '';
  if (newParentId) {
    const parentDoc = await db.collection(`series/${seriesId}/folders`).doc(newParentId).get();
    if (!parentDoc.exists) {
      throw new Error("Parent folder not found");
    }
    const parent = parentDoc.data() as Folder;
    newPath = parent.path ? `${parent.path}/${newParentId}` : newParentId;
  }

  // Update the folder itself
  const folderUpdate = {
    parentId: newParentId || null,
    path: newPath || undefined,
    updatedAt: Date.now()
  };
  batch.update(folderRef, folderUpdate);

  // Get all descendant folders and assets to update them recursively
  await updateDescendantFoldersAndAssets(batch, seriesId, folderId, newPath || '', folderId);

  // Commit the batch
  await batch.commit();

  // Return updated folder
  const updatedDoc = await folderRef.get();
  return { id: updatedDoc.id, ...updatedDoc.data() } as Folder;
};

export const isDescendantFolder = async (
  seriesId: string, 
  potentialDescendantId: string, 
  ancestorId: string
): Promise<boolean> => {
  const descendantDoc = await db.collection(`series/${seriesId}/folders`).doc(potentialDescendantId).get();
  
  if (!descendantDoc.exists) {
    return false;
  }

  const descendant = descendantDoc.data() as Folder;
  
  // If the descendant's path contains the ancestor ID, then it's a descendant
  if (descendant.path && descendant.path.includes(ancestorId)) {
    return true;
  }

  return false;
};

async function updateDescendantFoldersAndAssets(
  batch: FirebaseFirestore.WriteBatch, 
  seriesId: string, 
  currentFolderId: string, 
  newBasePath: string,
  originalMovedFolderId: string
): Promise<void> {
  // Get all child folders
  const childFoldersSnapshot = await db.collection(`series/${seriesId}/folders`)
    .where('parentId', '==', currentFolderId)
    .get();

  // Update child folders
  for (const childDoc of childFoldersSnapshot.docs) {
    const childFolder = { id: childDoc.id, ...childDoc.data() } as Folder;
    const newChildPath = newBasePath ? `${newBasePath}/${currentFolderId}` : currentFolderId;
    
    batch.update(childDoc.ref, {
      path: newChildPath,
      updatedAt: Date.now()
    });

    // Recursively update grandchildren
    await updateDescendantFoldersAndAssets(batch, seriesId, childFolder.id!, newChildPath, originalMovedFolderId);
  }

  // Get and update all assets in this folder
  const assetsSnapshot = await db.collection(`series/${seriesId}/assets`)
    .where('folderId', '==', currentFolderId)
    .get();

  for (const assetDoc of assetsSnapshot.docs) {
    const newFolderPath = newBasePath ? `${newBasePath}/${currentFolderId}` : currentFolderId;
    
    batch.update(assetDoc.ref, {
      folderPath: newFolderPath,
      updatedAt: Date.now()
    });
  }
}