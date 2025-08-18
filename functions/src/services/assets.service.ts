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

export const updateAsset = async (seriesId: string, assetId: string, updates: Partial<Asset>): Promise<Asset> => {
  const assetRef = db.collection(`series/${seriesId}/assets`).doc(assetId);
  
  const updateData = {
    ...updates,
    updatedAt: Date.now(),
  };

  await assetRef.update(updateData);
  
  const updatedDoc = await assetRef.get();
  return {id: updatedDoc.id, ...updatedDoc.data()} as Asset;
};

export const updateAssetReferences = async (seriesId: string, assetId: string, newName: string): Promise<void> => {
  const batch = db.batch();

  // Update references in series core data
  const seriesRef = db.collection('series').doc(seriesId);
  const seriesDoc = await seriesRef.get();
  const seriesData = seriesDoc.data();
  
  if (seriesData) {
    let updated = false;
    
    // Update logo reference
    if (seriesData.logo?.id === assetId) {
      seriesData.logo.name = newName;
      updated = true;
    }
    
    // Update cover reference
    if (seriesData.cover?.id === assetId) {
      seriesData.cover.name = newName;
      updated = true;
    }
    
    // Update portraitCover reference
    if (seriesData.portraitCover?.id === assetId) {
      seriesData.portraitCover.name = newName;
      updated = true;
    }

    // Update hero banner slides references
    if (Array.isArray(seriesData.heroBanner)) {
      seriesData.heroBanner.forEach((slide: any) => {
        if (slide.image?.id === assetId) {
          slide.image.name = newName;
          updated = true;
        }
      });
    }

    // Update poster references
    if (seriesData.leftPoster?.image?.id === assetId) {
      seriesData.leftPoster.image.name = newName;
      updated = true;
    }
    
    // Update CTA references
    if (seriesData.cta?.image?.id === assetId) {
      seriesData.cta.image.name = newName;
      updated = true;
    }
    
    // Update banner references
    if (seriesData.banners) {
      Object.values(seriesData.banners).forEach((banner: any) => {
        if (banner.image?.id === assetId) {
          banner.image.name = newName;
          updated = true;
        }
      });
    }
    
    if (updated) {
      batch.update(seriesRef, seriesData);
    }
  }

  // Update references in series page data (legacy structure - keeping for backward compatibility)
  const seriesPageRef = db.collection(`series/${seriesId}/pages`).doc('seriesPage');
  const seriesPageDoc = await seriesPageRef.get();
  const pageData = seriesPageDoc.data();
  
  if (pageData) {
    let pageUpdated = false;
    
    // Update hero banner references
    if (Array.isArray(pageData.heroBanner)) {
      pageData.heroBanner.forEach((slide: any) => {
        if (slide.image?.id === assetId) {
          slide.image.name = newName;
          pageUpdated = true;
        }
      });
    }
    
    // Update poster references
    if (pageData.leftPoster?.image?.id === assetId) {
      pageData.leftPoster.image.name = newName;
      pageUpdated = true;
    }
    
    // Update CTA references
    if (pageData.cta?.image?.id === assetId) {
      pageData.cta.image.name = newName;
      pageUpdated = true;
    }
    
    // Update banner references
    if (pageData.banners) {
      Object.values(pageData.banners).forEach((banner: any) => {
        if (banner.image?.id === assetId) {
          banner.image.name = newName;
          pageUpdated = true;
        }
      });
    }
    
    if (pageUpdated) {
      batch.update(seriesPageRef, pageData);
    }
  }

  // Update references in episodes
  const episodesSnapshot = await db.collection(`series/${seriesId}/episodes`).get();
  episodesSnapshot.docs.forEach((doc) => {
    const episodeData = doc.data();
    if (episodeData.thumbnail?.id === assetId) {
      batch.update(doc.ref, {
        'thumbnail.name': newName,
        updatedAt: Date.now(),
      });
    }
  });

  // Update references in sponsors
  const sponsorsSnapshot = await db.collection(`series/${seriesId}/sponsors`).get();
  sponsorsSnapshot.docs.forEach((doc) => {
    const sponsorData = doc.data();
    if (sponsorData.logo?.id === assetId) {
      batch.update(doc.ref, {
        'logo.name': newName,
        updatedAt: Date.now(),
      });
    }
  });

  await batch.commit();
};
