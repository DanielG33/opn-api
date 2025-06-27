import {db, bucket} from "../firebase";
import {Asset, UploadAssetInput} from "../models/asset";
import {getBase64Data, getBase64MimeType} from "../utils/base64";


export const getAssetsBySeries = async (seriesId: string): Promise<Asset[]> => {
  const snapshot = await db.collection(`series/${seriesId}/assets`).get();
  return snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()} as Asset));
};

export const getAssetById = async (seriesId: string, assetId: string): Promise<Asset | null> => {
  const doc = await db.collection(`series/${seriesId}/assets`).doc(assetId).get();
  return doc.exists ? ({id: doc.id, ...doc.data()} as Asset) : null;
};

export const createAsset = async (input: UploadAssetInput): Promise<Asset> => {
  const {path, name, base64EncodedFile, size, seriesId} = input;

  const filePath = `${path}/${name}`;
  const fileRef = bucket.file(filePath);
  const fileData = getBase64Data(base64EncodedFile);
  const mimeType = getBase64MimeType(base64EncodedFile) as string;
  const fileBuffer = Buffer.from(fileData, "base64");

  await fileRef.save(fileBuffer, {contentType: mimeType});
  await fileRef.makePublic();
  const downloadUrl = fileRef.publicUrl();

  const assetData: Partial<Asset> = {
    path: filePath,
    name,
    url: downloadUrl,
    size,
    type: mimeType,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const docRef = await db.collection(`series/${seriesId}/assets`).add(assetData);

  return {id: docRef.id, ...assetData} as Asset;
};
