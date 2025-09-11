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
  
  const slider = {
    title: sliderData.title,
    description: sliderData.description || '',
    sponsor: sliderData.sponsor || null,
    videoIds: sliderData.videoIds || [], // Array of video IDs
    order: sliderData.order || 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const docRef = await slidersRef.add(slider);
  return { id: docRef.id, ...slider };
};

export const updateSubcontentSlider = async (episodeId: string, sliderId: string, sliderData: any) => {
  const sliderRef = db.collection(`episodes/${episodeId}/subcontentSliders`).doc(sliderId);
  
  const updateData = {
    ...sliderData,
    updatedAt: Date.now(),
  };

  await sliderRef.update(updateData);
  const updated = await sliderRef.get();
  return { id: updated.id, ...updated.data() };
};

export const deleteSubcontentSlider = async (episodeId: string, sliderId: string) => {
  const sliderRef = db.collection(`episodes/${episodeId}/subcontentSliders`).doc(sliderId);
  await sliderRef.delete();
  return { id: sliderId };
};

export const getSubcontentSliders = async (episodeId: string, seriesId?: string) => {
  const snapshot = await db
    .collection(`episodes/${episodeId}/subcontentSliders`)
    .orderBy('order')
    .get();
  
  const sliders = [];
  
  for (const sliderDoc of snapshot.docs) {
    const sliderData = sliderDoc.data();
    const slider: any = { id: sliderDoc.id, ...sliderData };
    
    // Fetch actual video data for each video ID
    if (sliderData.videoIds && sliderData.videoIds.length > 0) {
      const videoPromises = sliderData.videoIds.map((videoId: string) => 
        getSubcontentVideoById(episodeId, videoId)
      );
      
      const videos = await Promise.all(videoPromises);
      slider.items = videos.filter(video => video !== null); // Frontend expects 'items', not 'videos'
    } else {
      slider.items = [];
    }

    // Populate sponsor data if sponsorId exists and seriesId is provided
    if (sliderData.sponsor && seriesId) {
      try {
        const sponsorDoc = await db.collection(`series/${seriesId}/sponsors`).doc(sliderData.sponsor).get();
        if (sponsorDoc.exists) {
          slider.sponsor = { id: sponsorDoc.id, ...sponsorDoc.data() };
        } else {
          // If sponsor ID doesn't exist, remove the reference
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
  
  // Get subcontent sliders with their videos for this episode
  const subcontent = await getSubcontentSliders(id, episodeData.seriesId);
  episodeData.subcontent = subcontent;
  
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

// TODO: implement season data
export const createEpisode = async (raw: any) => {
  const videoUrl = "https://vimeo.com/" + raw.videoUrl.split("/").pop();

  // const seriesData = await db.collection('series').doc(raw.seriesId).get();
  // const seasonData = await db.collection(`series/${raw.seriesId}/seasons`).doc(raw.seasonId).get();

  const { subcontent, ...episodeData } = raw;

  const episode = {
    ...episodeData,
    videoUrl,
    // series: seriesData.data(),
    // season: seasonData.data(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  //   const docRef = await db.collection('episodes-draft').add(episode);
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
  //   const ref = db.collection('episodes-draft').doc(id);
  const ref = db.collection("episodes").doc(id);
  
  // Get the current episode
  const currentEpisode = await ref.get();
  if (!currentEpisode.exists) {
    throw new Error("Episode not found");
  }
  
  const { subcontent, ...updateData } = data;
  
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
