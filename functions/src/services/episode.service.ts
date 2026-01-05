// src/services/episode.service.ts
import { db } from "../firebase";
// import { format } from 'date-fns';

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
  const slidersRef = db.collection(`episodes/${episodeId}/subcontentSliders`);
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
  const slidersRef = db.collection(`episodes/${episodeId}/subcontentSliders`);
  
  // Get the highest order value to append new slider at the end
  let order = sliderData.order;
  if (order === undefined || order === null) {
    const snapshot = await slidersRef.orderBy('order', 'desc').limit(1).get();
    order = snapshot.empty ? 0 : (snapshot.docs[0].data().order || 0) + 1;
  }
  
  const slider = {
    title: sliderData.title,
    description: sliderData.description || '',
    sponsor: sliderData.sponsor || null,
    items: sliderData.items || [], // Store denormalized item objects
    videoIds: (sliderData.items || []).map((item: any) => item.id), // Keep IDs for backwards compatibility
    order: order,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const docRef = await slidersRef.add(slider);
  return { id: docRef.id, ...slider };
};

export const updateSubcontentSlider = async (episodeId: string, sliderId: string, sliderData: any) => {
  const sliderRef = db.collection(`episodes/${episodeId}/subcontentSliders`).doc(sliderId);
  
  const updateData: any = {
    ...sliderData,
    updatedAt: Date.now(),
  };

  // If items are provided, also update videoIds for backwards compatibility
  if (sliderData.items) {
    updateData.videoIds = sliderData.items.map((item: any) => item.id);
  }

  await sliderRef.update(updateData);
  const updated = await sliderRef.get();
  return { id: updated.id, ...updated.data() };
};

export const deleteSubcontentSlider = async (episodeId: string, sliderId: string) => {
  const sliderRef = db.collection(`episodes/${episodeId}/subcontentSliders`).doc(sliderId);
  await sliderRef.delete();
  return { id: sliderId };
};

export const reorderSubcontentSliders = async (episodeId: string, sliders: { id: string; order: number }[], displayOrder?: any[]) => {
  const batch = db.batch();
  const slidersRef = db.collection(`episodes/${episodeId}/subcontentSliders`);
  
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
    .collection(`episodes/${episodeId}/subcontentSliders`)
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
  const sliderRef = db.collection(`episodes/${episodeId}/subcontentSliders`).doc(sliderId);
  const sliderDoc = await sliderRef.get();
  
  if (!sliderDoc.exists) {
    throw new Error('Slider not found');
  }
  
  const sliderData = sliderDoc.data();
  const currentVideoIds = sliderData?.videoIds || [];
  
  if (!currentVideoIds.includes(videoId)) {
    const updatedVideoIds = [...currentVideoIds, videoId];
    await sliderRef.update({ 
      videoIds: updatedVideoIds,
      updatedAt: Date.now()
    });
  }
  
  return await getSubcontentSliders(episodeId);
};

export const removeVideoFromSlider = async (episodeId: string, sliderId: string, videoId: string) => {
  const sliderRef = db.collection(`episodes/${episodeId}/subcontentSliders`).doc(sliderId);
  const sliderDoc = await sliderRef.get();
  
  if (!sliderDoc.exists) {
    throw new Error('Slider not found');
  }
  
  const sliderData = sliderDoc.data();
  const currentVideoIds = sliderData?.videoIds || [];
  const updatedVideoIds = currentVideoIds.filter((id: string) => id !== videoId);
  
  await sliderRef.update({ 
    videoIds: updatedVideoIds,
    updatedAt: Date.now()
  });
  
  return await getSubcontentSliders(episodeId);
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

export const getEpisodeById = async (id: string) => {
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
        episodeData.seriesName = seriesData?.title || 'Unknown Series';
      }
    } catch (error) {
      console.error('Error fetching series data for episode:', error);
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

export const getEpisodeListByIds = async (ids: string[]) => {
  if (ids.length === 0) return [];

  const results = await Promise.all(
    ids.map(async id => {
      return getEpisodeById(id);
    })
  );

  return results.filter((episode) => Boolean(episode));
};

export const getEpisodesBySeriesId = async (seriesId: string, excludeEpisodeId?: string) => {
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

export const getEpisodesBySeasonId = async (seriesId: string, seasonId: string, excludeEpisodeId?: string) => {
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
  //   await db.collection('episodes-draft').doc(id).delete();
  await db.collection("episodes").doc(id).delete();
  return { id };
};

// Get random episodes for trending carousel
export const getRandomEpisodes = async (limit: number = 10) => {
  const snapshot = await db.collection("episodes")
    // .where("status", "==", "published")
    .limit(limit * 3) // Get more to randomize from
    .get();
  
  const episodes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Shuffle and return limited number
  const shuffled = episodes.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
};

// Get latest episodes
export const getLatestEpisodes = async (limit: number = 10) => {
  const snapshot = await db.collection("episodes")
    // .where("status", "==", "published")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Get episodes by category
export const getEpisodesByCategory = async (category: string, limit: number = 10) => {
  const snapshot = await db.collection("episodes")
    // .where("status", "==", "published")
    .where("category", "==", category)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
      .limit(limit)
      .get();
    
    return {
      subcategoryId,
      episodes: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
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
