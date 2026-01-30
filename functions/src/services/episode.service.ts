// src/services/episode.service.ts
import { db, FieldValue } from "../firebase";
import type { SliderItem, SubContentSnapshot, UsagePointer } from "../contracts";
import { TargetKind } from "../contracts";
import { buildContentKeyForSubContent, buildPointerId } from "../utils/content-usage-helpers";
import { SeriesPublicationStatus } from "../types/series-status";
// import { format } from 'date-fns';

/**
 * Helper function to filter episodes by series publication workflow status
 * Only returns episodes from series where publicationStatus == PUBLISHED
 * This is separate from any episode-level or content-level draft flags
 */
const filterEpisodesBySeriesStatus = async (episodes: any[]): Promise<any[]> => {
  const episodesWithSeriesId = episodes.filter(ep => ep.seriesId);
  
  if (episodesWithSeriesId.length === 0) {
    return episodes; // No series IDs to check
  }
  
  // Get unique series IDs
  const uniqueSeriesIds = [...new Set(episodesWithSeriesId.map(ep => ep.seriesId))];
  
  // Fetch all series in parallel
  const seriesPromises = uniqueSeriesIds.map(async (seriesId) => {
    try {
      const seriesDoc = await db.collection('series').doc(seriesId).get();
      if (seriesDoc.exists) {
        const seriesData = seriesDoc.data();
        return {
          id: seriesId,
          publicationStatus: seriesData?.publicationStatus
        };
      }
    } catch (error) {
      console.error(`Error fetching series ${seriesId}:`, error);
    }
    return { id: seriesId, publicationStatus: null };
  });
  
  const seriesResults = await Promise.all(seriesPromises);
  const seriesStatusMap = new Map(
    seriesResults.map(s => [s.id, s.publicationStatus])
  );
  
  // Filter episodes to only include those from series with publicationStatus == PUBLISHED
  return episodes.filter(episode => {
    if (!episode.seriesId) return true; // Keep episodes without series ID
    const status = seriesStatusMap.get(episode.seriesId);
    return status === SeriesPublicationStatus.PUBLISHED;
  });
};

// TODO: enable draft system
export const getEpisodesByFilters = async (filters: { [key: string]: string }) => {
  //   let query: FirebaseFirestore.Query = db.collection('episodes-draft');
  let query: FirebaseFirestore.Query = db.collection("episodes");
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query = query.where(key, "==", value);
  });

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// SUBCONTENT VIDEOS - Independent video management (stored per episode)
export const createSubcontentVideo = async (episodeId: string, videoData: any) => {
  const subcontentVideosRef = db.collection(`episodes/${episodeId}/subcontentVideos`);
  
  const video = {
    ...videoData,
    // Content-level draft flag for individual videos (not series publicationStatus)
    status: videoData.status || 'draft', // draft, published
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const docRef = await subcontentVideosRef.add(video);
  return { id: docRef.id, ...video };
};

export const updateSubcontentVideo = async (episodeId: string, videoId: string, videoData: any) => {
  const videoRef = db.collection(`episodes/${episodeId}/subcontentVideos`).doc(videoId);
  
  const updateData = {
    ...videoData,
    updatedAt: Date.now(),
  };

  await videoRef.update(updateData);
  const updated = await videoRef.get();
  return { id: updated.id, ...updated.data() };
};

export const deleteSubcontentVideo = async (episodeId: string, videoId: string) => {
  const videoRef = db.collection(`episodes/${episodeId}/subcontentVideos`).doc(videoId);
  await videoRef.delete();
  
  // Also remove this video from any sliders that reference it
  const slidersRef = db.collection(`episodes/${episodeId}/subContentSliders`);
  const slidersSnapshot = await slidersRef.get();
  
  const batch = db.batch();
  slidersSnapshot.docs.forEach(sliderDoc => {
    const sliderData = sliderDoc.data();
    if (sliderData.videoIds && sliderData.videoIds.includes(videoId)) {
      const updatedVideoIds = sliderData.videoIds.filter((id: string) => id !== videoId);
      batch.update(sliderDoc.ref, { 
        videoIds: updatedVideoIds,
        updatedAt: Date.now()
      });
    }
  });
  
  await batch.commit();
  return { id: videoId };
};

export const getSubcontentVideos = async (episodeId: string, filters?: { status?: string }) => {
  let query: FirebaseFirestore.Query = db.collection(`episodes/${episodeId}/subcontentVideos`);
  
  if (filters?.status) {
    query = query.where('status', '==', filters.status);
  }
  
  const snapshot = await query.orderBy('createdAt', 'desc').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getSubcontentVideoById = async (episodeId: string, videoId: string) => {
  const doc = await db.collection(`episodes/${episodeId}/subcontentVideos`).doc(videoId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
};

// SUBCONTENT SLIDERS - Manage video collections/playlists (stored per episode)
export const createSubcontentSlider = async (episodeId: string, sliderData: any) => {
  const slidersRef = db.collection(`episodes/${episodeId}/subContentSliders`);
  const episodeDoc = await db.collection("episodes").doc(episodeId).get();
  const episodeSeriesId = episodeDoc.data()?.seriesId as string | undefined;

  if (!episodeSeriesId) {
    throw new Error("Episode missing seriesId");
  }
  const itemsInput = Array.isArray(sliderData.items) ? sliderData.items : [];
  
  // Get the highest order value to append new slider at the end
  let order = sliderData.order;
  if (order === undefined || order === null) {
    const snapshot = await slidersRef.orderBy('order', 'desc').limit(1).get();
    order = snapshot.empty ? 0 : (snapshot.docs[0].data().order || 0) + 1;
  }
  
  const now = Date.now();
  const sliderRef = slidersRef.doc();
  const batch = db.batch();

  const normalizedItems: SliderItem[] = [];
  const itemKeys = new Set<string>();

  for (const item of itemsInput) {
    const subContentId = item?.subContentId;
    if (!subContentId) {
      throw new Error("Slider item missing required subContentId");
    }

    const itemKey = typeof item?.itemKey === "string" ? item.itemKey : crypto.randomUUID();
    if (itemKeys.has(itemKey)) {
      throw new Error("Duplicate itemKey in slider items");
    }
    itemKeys.add(itemKey);

    const subContentRef = db.doc(`series/${episodeSeriesId}/subContent/${subContentId}`);
    const subContentSnap = await subContentRef.get();
    if (!subContentSnap.exists) {
      throw new Error("Sub-content not found");
    }

    const snapshot = buildEpisodeSubContentSnapshot(episodeSeriesId, subContentId, subContentSnap.data());
    const contentKey = buildContentKeyForSubContent(subContentId);

    const normalizedItem: SliderItem = {
      itemKey,
      contentKey,
      subContentId,
      snapshot,
      isActive: true,
      isHidden: item?.isHidden,
      createdAt: now,
      updatedAt: now
    };

    normalizedItems.push(normalizedItem);

    const pointer = buildEpisodeUsagePointer(episodeSeriesId, episodeId, sliderRef.id, itemKey);
    const pointerId = buildPointerId(pointer);
    batch.set(
      db.doc(`series/${episodeSeriesId}/contentUsage/${contentKey}/pointers/${pointerId}`),
      pointer,
      { merge: true }
    );
  }

  validateEpisodeSliderItems(normalizedItems, episodeSeriesId);

  const slider = {
    title: sliderData.title,
    description: sliderData.description || '',
    sponsor: sliderData.sponsor || null,
    items: normalizedItems, // Store denormalized item objects (strict)
    order: order,
    createdAt: now,
    updatedAt: now,
  };

  batch.set(sliderRef, slider);
  await batch.commit();
  return { id: sliderRef.id, ...slider };
};

export const updateSubcontentSlider = async (episodeId: string, sliderId: string, sliderData: any) => {
  const sliderRef = db.collection(`episodes/${episodeId}/subContentSliders`).doc(sliderId);
  const episodeDoc = await db.collection("episodes").doc(episodeId).get();
  const episodeSeriesId = episodeDoc.data()?.seriesId as string | undefined;
  if (!episodeSeriesId) {
    throw new Error("Episode missing seriesId");
  }
  
  const updateData: any = {
    ...sliderData,
    updatedAt: Date.now(),
  };

  if (sliderData.items) {
    await db.runTransaction(async tx => {
      const sliderSnap = await tx.get(sliderRef);
      if (!sliderSnap.exists) {
        throw new Error("Slider not found");
      }

      const existingItems = (sliderSnap.data()?.items || []) as SliderItem[];
      const existingByKey = new Map(existingItems.map(item => [item.itemKey, item] as const));

      const nextItems: SliderItem[] = [];
      const nextKeys = new Set<string>();
      const now = Date.now();

      for (const item of sliderData.items || []) {
        const providedKey = typeof item?.itemKey === "string" ? item.itemKey : undefined;
        const itemKey = providedKey || crypto.randomUUID();

        if (nextKeys.has(itemKey)) {
          throw new Error("Duplicate itemKey in slider items");
        }
        nextKeys.add(itemKey);

        const existingItem = existingByKey.get(itemKey);

        if (existingItem) {
          if (item?.subContentId && item.subContentId !== existingItem.subContentId) {
            throw new Error("Cannot change subContentId for existing slider item");
          }

          nextItems.push({
            ...existingItem,
            isActive: typeof item?.isActive === "boolean" ? item.isActive : existingItem.isActive,
            isHidden: item?.isHidden !== undefined ? item.isHidden : existingItem.isHidden,
            updatedAt: now
          });
          continue;
        }

        const subContentId = item?.subContentId;
        if (!subContentId) {
          throw new Error("Slider item missing required subContentId");
        }

        const subContentRef = db.doc(`series/${episodeSeriesId}/subContent/${subContentId}`);
        const subContentSnap = await tx.get(subContentRef);
        if (!subContentSnap.exists) {
          throw new Error("Sub-content not found");
        }

        const snapshot = buildEpisodeSubContentSnapshot(episodeSeriesId, subContentId, subContentSnap.data());
        const contentKey = buildContentKeyForSubContent(subContentId);

        nextItems.push({
          itemKey,
          contentKey,
          subContentId,
          snapshot,
          isActive: true,
          isHidden: item?.isHidden,
          createdAt: now,
          updatedAt: now
        });
      }

      validateEpisodeSliderItems(nextItems, episodeSeriesId);

      const removedItems = existingItems.filter(item => !nextKeys.has(item.itemKey));
      const addedItems = nextItems.filter(item => !existingByKey.has(item.itemKey));

      tx.update(sliderRef, {
        ...updateData,
        items: nextItems,
        updatedAt: now
      });

      for (const item of removedItems) {
        const pointer = buildEpisodeUsagePointer(episodeSeriesId, episodeId, sliderId, item.itemKey);
        const pointerId = buildPointerId(pointer);
        const contentKey = item.contentKey || buildContentKeyForSubContent(item.subContentId);
        tx.delete(db.doc(`series/${episodeSeriesId}/contentUsage/${contentKey}/pointers/${pointerId}`));
      }

      for (const item of addedItems) {
        const pointer = buildEpisodeUsagePointer(episodeSeriesId, episodeId, sliderId, item.itemKey);
        const pointerId = buildPointerId(pointer);
        const contentKey = item.contentKey || buildContentKeyForSubContent(item.subContentId);
        tx.set(
          db.doc(`series/${episodeSeriesId}/contentUsage/${contentKey}/pointers/${pointerId}`),
          pointer,
          { merge: true }
        );
      }
    });
    const updated = await sliderRef.get();
    return { id: updated.id, ...updated.data() };
  }

  await sliderRef.update(updateData);
  const updated = await sliderRef.get();
  return { id: updated.id, ...updated.data() };
};

export const deleteSubcontentSlider = async (episodeId: string, sliderId: string) => {
  const sliderRef = db.collection(`episodes/${episodeId}/subContentSliders`).doc(sliderId);
  const episodeDoc = await db.collection("episodes").doc(episodeId).get();
  const episodeSeriesId = episodeDoc.data()?.seriesId as string | undefined;
  if (!episodeSeriesId) {
    throw new Error("Episode missing seriesId");
  }

  await db.runTransaction(async tx => {
    const sliderSnap = await tx.get(sliderRef);
    if (!sliderSnap.exists) {
      return;
    }

    const items = (sliderSnap.data()?.items || []) as SliderItem[];
    for (const item of items) {
      const pointer = buildEpisodeUsagePointer(episodeSeriesId, episodeId, sliderId, item.itemKey);
      const pointerId = buildPointerId(pointer);
      const contentKey = item.contentKey || buildContentKeyForSubContent(item.subContentId);
      tx.delete(db.doc(`series/${episodeSeriesId}/contentUsage/${contentKey}/pointers/${pointerId}`));
    }

    tx.delete(sliderRef);
  });

  return { id: sliderId };
};

export const reorderSubcontentSliders = async (episodeId: string, sliders: { id: string; order: number }[], displayOrder?: any[]) => {
  const batch = db.batch();
  const slidersRef = db.collection(`episodes/${episodeId}/subContentSliders`);
  
  sliders.forEach(slider => {
    const sliderRef = slidersRef.doc(slider.id);
    batch.update(sliderRef, { 
      order: slider.order,
      updatedAt: Date.now()
    });
  });
  
  // Store the display order (which includes series sliders) in the episode document
  if (displayOrder) {
    const episodeRef = db.collection('episodes').doc(episodeId);
    batch.update(episodeRef, {
      slidersDisplayOrder: displayOrder,
      updatedAt: Date.now()
    });
  }
  
  await batch.commit();
  return { success: true, message: 'Sliders reordered successfully' };
};

export const getSubcontentSliders = async (episodeId: string, seriesId?: string) => {
  const snapshot = await db
    .collection(`episodes/${episodeId}/subContentSliders`)
    .orderBy('order')
    .get();
  
  const sliders = [];
  
  for (const sliderDoc of snapshot.docs) {
    const sliderData = sliderDoc.data();
    const slider: any = { 
      id: sliderDoc.id, 
      title: sliderData.title,
      description: sliderData.description,
      sponsor: sliderData.sponsor,
      order: sliderData.order,
      items: sliderData.items || [],
      createdAt: sliderData.createdAt,
      updatedAt: sliderData.updatedAt
    };

    // Populate sponsor data if sponsor ID exists and seriesId is provided
    if (sliderData.sponsor && seriesId) {
      try {
        const sponsorDoc = await db.collection(`series/${seriesId}/sponsors`).doc(sliderData.sponsor).get();
        if (sponsorDoc.exists) {
          slider.sponsor = { id: sponsorDoc.id, ...sponsorDoc.data() };
        } else {
          slider.sponsor = null;
        }
      } catch (error) {
        console.error(`Error fetching sponsor ${sliderData.sponsor}:`, error);
        slider.sponsor = null;
      }
    }
    
    sliders.push(slider);
  }
  
  return sliders;
};

export const addVideoToSlider = async (episodeId: string, sliderId: string, videoId: string) => {
  const sliderRef = db.collection(`episodes/${episodeId}/subContentSliders`).doc(sliderId);
  const episodeDoc = await db.collection("episodes").doc(episodeId).get();
  const episodeSeriesId = episodeDoc.data()?.seriesId as string | undefined;
  if (!episodeSeriesId) {
    throw new Error("Episode missing seriesId");
  }

  const subContentRef = db.doc(`series/${episodeSeriesId}/subContent/${videoId}`);
  const now = Date.now();

  await db.runTransaction(async tx => {
    const [sliderSnap, subContentSnap] = await Promise.all([
      tx.get(sliderRef),
      tx.get(subContentRef)
    ]);

    if (!sliderSnap.exists) {
      throw new Error('Slider not found');
    }

    if (!subContentSnap.exists) {
      throw new Error('Sub-content not found');
    }

    const currentItems = (sliderSnap.data()?.items || []) as SliderItem[];
    const itemKey = crypto.randomUUID();
    const snapshot = buildEpisodeSubContentSnapshot(episodeSeriesId, videoId, subContentSnap.data());
    const contentKey = buildContentKeyForSubContent(videoId);

    const nextItems = [
      ...currentItems,
      {
        itemKey,
        contentKey,
        subContentId: videoId,
        snapshot,
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    ];

    validateEpisodeSliderItems(nextItems, episodeSeriesId);

    tx.update(sliderRef, {
      items: nextItems,
      updatedAt: now
    });

    const pointer = buildEpisodeUsagePointer(episodeSeriesId, episodeId, sliderId, itemKey);
    const pointerId = buildPointerId(pointer);
    tx.set(
      db.doc(`series/${episodeSeriesId}/contentUsage/${contentKey}/pointers/${pointerId}`),
      pointer,
      { merge: true }
    );
  });

  return await getSubcontentSliders(episodeId, episodeSeriesId);
};

export const removeVideoFromSlider = async (episodeId: string, sliderId: string, videoId: string) => {
  const sliderRef = db.collection(`episodes/${episodeId}/subContentSliders`).doc(sliderId);
  const episodeDoc = await db.collection("episodes").doc(episodeId).get();
  const episodeSeriesId = episodeDoc.data()?.seriesId as string | undefined;
  if (!episodeSeriesId) {
    throw new Error("Episode missing seriesId");
  }

  await db.runTransaction(async tx => {
    const sliderSnap = await tx.get(sliderRef);
    if (!sliderSnap.exists) {
      throw new Error('Slider not found');
    }

    const currentItems = (sliderSnap.data()?.items || []) as SliderItem[];
    const updatedItems = currentItems.filter(item => item?.itemKey !== videoId);
    const removedItem = currentItems.find(item => item?.itemKey === videoId);

    tx.update(sliderRef, {
      items: updatedItems,
      updatedAt: Date.now()
    });

    if (removedItem) {
      const pointer = buildEpisodeUsagePointer(episodeSeriesId, episodeId, sliderId, removedItem.itemKey);
      const pointerId = buildPointerId(pointer);
      const contentKey = removedItem.contentKey || buildContentKeyForSubContent(removedItem.subContentId);
      tx.delete(db.doc(`series/${episodeSeriesId}/contentUsage/${contentKey}/pointers/${pointerId}`));
    }
  });
  
  return await getSubcontentSliders(episodeId, episodeSeriesId);
};

const buildEpisodeSubContentSnapshot = (seriesId: string, subContentId: string, data: any): SubContentSnapshot => {
  if (data?.seriesId && data.seriesId !== seriesId) {
    throw new Error("Sub-content seriesId mismatch");
  }

  if (!data?.title || !data?.type || !data?.status) {
    throw new Error("Sub-content snapshot missing required fields");
  }

  return {
    subContentId,
    seriesId,
    title: data.title,
    description: data.description || "",
    videoUrl: data.videoUrl,
    thumbnail: data.thumbnail,
    type: data.type,
    status: data.status,
    updatedAt: data.updatedAt || Date.now()
  };
};

const buildEpisodeUsagePointer = (seriesId: string, episodeId: string, sliderId: string, itemKey: string): UsagePointer => ({
  targetKind: TargetKind.EpisodeSubContentSlider,
  seriesId,
  episodeId,
  sliderId,
  itemKey,
  createdAt: Date.now(),
  updatedAt: Date.now()
});

const validateEpisodeSliderItems = (items: any[], seriesId?: string) => {
  if (!Array.isArray(items)) {
    throw new Error('Slider items must be an array');
  }

  const itemKeys = new Set<string>();

  for (const item of items as SliderItem[]) {
    if (!item?.itemKey || typeof item.itemKey !== 'string') {
      throw new Error('Slider item missing required itemKey');
    }
    if (itemKeys.has(item.itemKey)) {
      throw new Error('Duplicate itemKey in slider items');
    }
    itemKeys.add(item.itemKey);

    if (!item?.contentKey || typeof item.contentKey !== 'string') {
      throw new Error('Slider item missing required contentKey');
    }

    if (!item?.subContentId || typeof item.subContentId !== 'string') {
      throw new Error('Slider item missing required subContentId');
    }

    const expectedContentKey = `subContent_${item.subContentId}`;
    if (item.contentKey !== expectedContentKey) {
      throw new Error('Slider item contentKey does not match subContentId');
    }

    if (!item?.snapshot) {
      throw new Error('Slider item missing required snapshot');
    }

    if (seriesId && item.snapshot?.seriesId && item.snapshot.seriesId !== seriesId) {
      throw new Error('Slider item snapshot seriesId mismatch');
    }

    if (typeof item.isActive !== 'boolean') {
      throw new Error('Slider item missing required isActive flag');
    }
  }
};

// Helper function to update subcontent sliders in Firestore (DEPRECATED - keeping for backward compatibility)
const updateSubcontentSliders = async (episodeId: string, subcontent: any[]) => {
  // This function is now deprecated in favor of the new structure
  // but keeping it for backward compatibility during transition
  console.warn('updateSubcontentSliders is deprecated. Use the new subcontent video/slider structure.');
  
  if (!subcontent || subcontent.length === 0) {
    return [];
  }

  const subcontentRef = db.collection(`episodes/${episodeId}/subcontent`);
  const updatedSliders = [];

  // Get existing subcontent to identify which ones to delete
  const existingSubcontent = await subcontentRef.get();
  const existingIds = existingSubcontent.docs.map(doc => doc.id);
  const providedIds = subcontent.filter(slider => slider.id).map(slider => slider.id);

  // Delete subcontent that is no longer in the provided list
  const idsToDelete = existingIds.filter(id => !providedIds.includes(id));
  if (idsToDelete.length > 0) {
    const batch = db.batch();
    idsToDelete.forEach(id => {
      batch.delete(subcontentRef.doc(id));
    });
    await batch.commit();
  }

  // Process each slider (create new or update existing)
  for (let index = 0; index < subcontent.length; index++) {
    const slider = subcontent[index];
    const { id, ...sliderDataWithoutId } = slider;
    const sliderData = {
      ...sliderDataWithoutId,
      items: slider.items?.map((item: any) => ({
        ...item,
      })) || [],
      order: index,
      updatedAt: Date.now(),
    };
    
    if (id) {
      const docRef = subcontentRef.doc(id);
      await docRef.set(sliderData, { merge: true });
      updatedSliders.push({ id, ...sliderData });
    } else {
      sliderData.createdAt = Date.now();
      const docRef = await subcontentRef.add(sliderData);
      updatedSliders.push({ id: docRef.id, ...sliderData });
    }
  }

  return updatedSliders;
};

export const getEpisodeById = async (id: string, checkSeriesPublicationStatus: boolean = false) => {
  //   const doc = await db.collection('episodes-draft').doc(id).get();
  const doc = await db.collection("episodes").doc(id).get();
  if (!doc.exists) return null;
  
  const episodeData: any = { id: doc.id, ...doc.data() };
  
  // Ensure series name is populated if missing
  if (episodeData.seriesId && !episodeData.seriesName) {
    try {
      const seriesDoc = await db.collection('series').doc(episodeData.seriesId).get();
      if (seriesDoc.exists) {
        const seriesData = seriesDoc.data();
        
        // For public endpoints, check series publication workflow status (not episode draft status)
        if (checkSeriesPublicationStatus && seriesData?.publicationStatus !== 'PUBLISHED') {
          return null; // Episode belongs to non-published series
        }
        
        episodeData.seriesName = seriesData?.title || 'Unknown Series';
      } else if (checkSeriesPublicationStatus) {
        // Series doesn't exist, don't return episode
        return null;
      }
    } catch (error) {
      console.error('Error fetching series data for episode:', error);
      if (checkSeriesPublicationStatus) {
        return null; // On error, don't expose episode on public site
      }
    }
  }
  
  // Populate sponsor data if sponsorId exists
  if (episodeData.sponsorId && episodeData.seriesId) {
    try {
      const sponsorDoc = await db.collection(`series/${episodeData.seriesId}/sponsors`).doc(episodeData.sponsorId).get();
      if (sponsorDoc.exists) {
        episodeData.sponsor = { id: sponsorDoc.id, ...sponsorDoc.data() };
      } else {
        // If sponsor ID doesn't exist, remove the reference
        delete episodeData.sponsorId;
        delete episodeData.sponsor;
      }
    } catch (error) {
      console.error(`Error fetching sponsor ${episodeData.sponsorId}:`, error);
      delete episodeData.sponsorId;
      delete episodeData.sponsor;
    }
  } else {
    // If no sponsorId, ensure sponsor is not included
    delete episodeData.sponsor;
  }
  
  // Get subcontent sliders with their videos for this episode
  // Also include series sliders marked for player page
  const episodeSliders = await getSubcontentSliders(id, episodeData.seriesId);
  
  // Get series sliders marked for player page
  let allSliders = [...episodeSliders];
  
  if (episodeData.seriesId) {
    try {
      const { getSeriesSliders } = require('./series-sliders.service');
      const seriesSliders = await getSeriesSliders(episodeData.seriesId);
      
      // Filter to only include sliders marked for player page
      const playerPageSliders = seriesSliders
        .filter((slider: any) => slider.showOnPlayerPage)
        .map((slider: any) => ({
          ...slider,
          isSeriesSlider: true
        }));
      
      // Merge sliders
      allSliders = [...episodeSliders, ...playerPageSliders];
      
      // Apply custom display order if it exists
      if (episodeData.slidersDisplayOrder && Array.isArray(episodeData.slidersDisplayOrder)) {
        const orderMap = new Map();
        episodeData.slidersDisplayOrder.forEach((item: any, index: number) => {
          orderMap.set(`${item.isSeriesSlider ? 'series' : 'episode'}_${item.id}`, index);
        });
        
        allSliders.sort((a, b) => {
          const keyA = `${a.isSeriesSlider ? 'series' : 'episode'}_${a.id}`;
          const keyB = `${b.isSeriesSlider ? 'series' : 'episode'}_${b.id}`;
          const orderA = orderMap.has(keyA) ? orderMap.get(keyA) : 9999;
          const orderB = orderMap.has(keyB) ? orderMap.get(keyB) : 9999;
          return orderA - orderB;
        });
      }
    } catch (error) {
      console.error('Error loading series sliders for player page:', error);
    }
  }
  
  episodeData.subcontent = allSliders;
  
  return episodeData;
};

export const getEpisodeListByIds = async (ids: string[], checkSeriesPublicationStatus: boolean = false) => {
  if (ids.length === 0) return [];

  const results = await Promise.all(
    ids.map(async id => {
      return getEpisodeById(id, checkSeriesPublicationStatus);
    })
  );

  return results.filter((episode) => Boolean(episode));
};

export const getEpisodesBySeriesId = async (seriesId: string, excludeEpisodeId?: string, checkSeriesPublicationStatus: boolean = false) => {
  // For public endpoints, verify the series publication workflow status is PUBLISHED
  // This filters by series publicationStatus, NOT by any episode-level draft flags
  if (checkSeriesPublicationStatus) {
    try {
      const seriesDoc = await db.collection('series').doc(seriesId).get();
      if (!seriesDoc.exists) return [];
      
      const seriesData = seriesDoc.data();
      if (seriesData?.publicationStatus !== SeriesPublicationStatus.PUBLISHED) {
        return []; // Series not published, return no episodes
      }
    } catch (error) {
      console.error('Error checking series publication status:', error);
      return []; // On error, don't expose episodes
    }
  }
  
  let query: FirebaseFirestore.Query = db.collection("episodes")
    .where("seriesId", "==", seriesId)
    .orderBy("createdAt", "desc");

  const snapshot = await query.get();
  let episodes: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Exclude the specified episode if provided
  if (excludeEpisodeId) {
    episodes = episodes.filter(episode => episode.id !== excludeEpisodeId);
  }

  // Ensure series name is populated if missing
  if (episodes.length > 0 && !episodes[0].seriesName) {
    try {
      const seriesDoc = await db.collection('series').doc(seriesId).get();
      if (seriesDoc.exists) {
        const seriesData = seriesDoc.data();
        episodes = episodes.map(episode => ({
          ...episode,
          seriesName: episode.seriesName || seriesData?.title || 'Unknown Series'
        }));
      }
    } catch (error) {
      console.error('Error fetching series data for episodes:', error);
    }
  }

  return episodes;
};

export const getEpisodesBySeasonId = async (seriesId: string, seasonId: string, excludeEpisodeId?: string, checkSeriesPublicationStatus: boolean = false) => {
  // For public endpoints, verify the series publication workflow status is PUBLISHED
  // This filters by series publicationStatus, NOT by any episode-level draft flags
  if (checkSeriesPublicationStatus) {
    try {
      const seriesDoc = await db.collection('series').doc(seriesId).get();
      if (!seriesDoc.exists) return [];
      
      const seriesData = seriesDoc.data();
      if (seriesData?.publicationStatus !== SeriesPublicationStatus.PUBLISHED) {
        return []; // Series not published, return no episodes
      }
    } catch (error) {
      console.error('Error checking series publication status:', error);
      return []; // On error, don't expose episodes
    }
  }
  
  let query: FirebaseFirestore.Query = db.collection("episodes")
    .where("seriesId", "==", seriesId)
    .where("seasonId", "==", seasonId)
    .orderBy("episodeNumber", "asc");

  const snapshot = await query.get();
  let episodes: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Exclude the specified episode if provided
  if (excludeEpisodeId) {
    episodes = episodes.filter(episode => episode.id !== excludeEpisodeId);
  }

  // Ensure series name is populated if missing
  if (episodes.length > 0 && !episodes[0].seriesName) {
    try {
      const seriesDoc = await db.collection('series').doc(seriesId).get();
      if (seriesDoc.exists) {
        const seriesData = seriesDoc.data();
        episodes = episodes.map(episode => ({
          ...episode,
          seriesName: episode.seriesName || seriesData?.title || 'Unknown Series'
        }));
      }
    } catch (error) {
      console.error('Error fetching series data for episodes:', error);
    }
  }

  return episodes;
};

// TODO: implement season data  
export const createEpisode = async (raw: any) => {
  const videoUrl = "https://vimeo.com/" + raw.videoUrl.split("/").pop();

  // Get series data to check if it's season-based or limited
  const seriesData = await db.collection('series').doc(raw.seriesId).get();
  const series = seriesData.data();
  const isSeasonBased = series?.type === 'season-based';

  const { subcontent, ...episodeData } = raw;

  const episode: any = {
    ...episodeData,
    videoUrl,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Only add season-related data for season-based series
  if (isSeasonBased && raw.seasonId) {
    const seasonData = await db.collection(`series/${raw.seriesId}/seasons`).doc(raw.seasonId).get();
    if (seasonData.exists) {
      episode.season = seasonData.data();
    }
  } else {
    // For limited series, ensure seasonId is not included
    delete episode.seasonId;
  }

  const docRef = await db.collection("episodes").add(episode);
  
  // Increment episodes counter in both series and series-draft collections
  const seriesRef = db.collection('series').doc(raw.seriesId);
  const seriesDraftRef = db.collection('series-draft').doc(raw.seriesId);
  
  // Use FieldValue.increment to atomically increment the counter
  const increment = FieldValue.increment(1);
  
  await Promise.all([
    seriesRef.update({ episodes: increment, updatedAt: Date.now() }).catch(() => {
      // If series document doesn't exist yet, set episodes to 1
      seriesRef.set({ episodes: 1, updatedAt: Date.now() }, { merge: true });
    }),
    seriesDraftRef.update({ episodes: increment, updatedAt: Date.now() }).catch(() => {
      // If series-draft doesn't exist yet, set episodes to 1
      seriesDraftRef.set({ episodes: 1, updatedAt: Date.now() }, { merge: true });
    })
  ]);
  
  // Save subcontent sliders to the episode subcontent subcollection
  let createdSubcontent = [];
  if (subcontent && subcontent.length > 0) {
    createdSubcontent = await updateSubcontentSliders(docRef.id, subcontent);
  }
  
  return { 
    id: docRef.id, 
    ...episode,
    subcontent: createdSubcontent
  };
};

export const updateEpisode = async (id: string, data: any) => {
  const ref = db.collection("episodes").doc(id);
  
  // Get the current episode
  const currentEpisode = await ref.get();
  if (!currentEpisode.exists) {
    throw new Error("Episode not found");
  }
  
  const currentData = currentEpisode.data();
  
  // Get series data to check if it's season-based or limited
  const seriesData = await db.collection('series').doc(currentData?.seriesId || data.seriesId).get();
  const series = seriesData.data();
  const isSeasonBased = series?.type === 'season-based';
  
  const { subcontent, ...updateData } = data;
  
  // Handle season data based on series type
  if (!isSeasonBased) {
    // For limited series, remove season-related fields
    delete updateData.seasonId;
    delete updateData.season;
  } else if (updateData.seasonId) {
    // For season-based series, update season data if seasonId is provided
    const seasonData = await db.collection(`series/${currentData?.seriesId || data.seriesId}/seasons`).doc(updateData.seasonId).get();
    if (seasonData.exists) {
      updateData.season = seasonData.data();
    }
  }
  
  // Update subcontent sliders if provided (store under this episode)
  let updatedSubcontent = [];
  if (subcontent) {
    updatedSubcontent = await updateSubcontentSliders(id, subcontent);
  }
  
  await ref.update({ ...updateData, updatedAt: Date.now() });
  const updated = await ref.get();
  return { 
    id: updated.id, 
    ...updated.data(),
    subcontent: updatedSubcontent
  };
};

export const deleteEpisode = async (id: string) => {
  // Get episode data to retrieve seriesId before deletion
  const episodeRef = db.collection("episodes").doc(id);
  const episodeDoc = await episodeRef.get();
  
  if (!episodeDoc.exists) {
    throw new Error("Episode not found");
  }
  
  const episodeData = episodeDoc.data();
  const seriesId = episodeData?.seriesId;
  
  // Delete the episode
  await episodeRef.delete();
  
  // Decrement episodes counter in both series and series-draft collections
  if (seriesId) {
    const seriesRef = db.collection('series').doc(seriesId);
    const seriesDraftRef = db.collection('series-draft').doc(seriesId);
    
    const decrement = FieldValue.increment(-1);
    
    await Promise.all([
      seriesRef.update({ episodes: decrement, updatedAt: Date.now() }).catch((err) => {
        console.error('Failed to decrement episodes in series collection:', err);
      }),
      seriesDraftRef.update({ episodes: decrement, updatedAt: Date.now() }).catch((err) => {
        console.error('Failed to decrement episodes in series-draft collection:', err);
      })
    ]);
  }
  
  return { id };
};

// Get random episodes for trending carousel
export const getRandomEpisodes = async (limit: number = 10) => {
  const snapshot = await db.collection("episodes")
    // .where("status", "==", "published")
    .limit(limit * 3) // Get more to randomize from
    .get();
  
  const episodes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Filter out episodes from non-published series
  const filteredEpisodes = await filterEpisodesBySeriesStatus(episodes);
  
  // Shuffle and return limited number
  const shuffled = filteredEpisodes.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
};

// Get latest episodes
export const getLatestEpisodes = async (limit: number = 10) => {
  const snapshot = await db.collection("episodes")
    // .where("status", "==", "published")
    .orderBy("createdAt", "desc")
    .limit(limit * 2) // Fetch more to account for filtering
    .get();
  
  const episodes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Filter out episodes from non-published series
  const filteredEpisodes = await filterEpisodesBySeriesStatus(episodes);
  
  return filteredEpisodes.slice(0, limit);
};

// Get episodes by category
export const getEpisodesByCategory = async (category: string, limit: number = 10) => {
  const snapshot = await db.collection("episodes")
    // .where("status", "==", "published")
    .where("category", "==", category)
    .orderBy("createdAt", "desc")
    .limit(limit * 2) // Fetch more to account for filtering
    .get();
  
  const episodes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Filter out episodes from non-published series
  const filteredEpisodes = await filterEpisodesBySeriesStatus(episodes);
  
  return filteredEpisodes.slice(0, limit);
};

// Get episodes by category grouped by subcategories
export const getEpisodesBySubcategories = async (category: string, subcategoryIds: string[], limit: number = 10) => {
  // Fetch latest episodes for each subcategory in parallel
  const promises = subcategoryIds.map(async (subcategoryId) => {
    const snapshot = await db.collection("episodes")
      // .where("status", "==", "published")
      .where("category", "==", category)
      .where("subcategories", "array-contains", subcategoryId)
      .orderBy("createdAt", "desc")
      .limit(limit * 2) // Fetch more to account for filtering
      .get();
    
    const episodes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Filter out episodes from non-published series
    const filteredEpisodes = await filterEpisodesBySeriesStatus(episodes);
    
    return {
      subcategoryId,
      episodes: filteredEpisodes.slice(0, limit)
    };
  });

  const results = await Promise.all(promises);
  
  // Convert to object keyed by subcategory ID
  const episodesBySubcategory: { [key: string]: any[] } = {};
  results.forEach(result => {
    if (result.episodes.length > 0) {
      episodesBySubcategory[result.subcategoryId] = result.episodes;
    }
  });
  
  return episodesBySubcategory;
};
