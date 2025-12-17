export interface Folder {
  id?: string;
  name: string;
  parentId?: string | null; // ID of parent folder (null for root level)
  path?: string; // Path built with folder IDs (e.g., "folder1/folder2")
  createdAt: number;
  updatedAt?: number;
}