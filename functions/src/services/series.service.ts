import {db} from "../firebase";
import {Series} from "../models/series";
import {formatSeriesId} from "../utils/format";

/* Public methods */
export const getAllPublicSeries = async () => {
  const snapshot = await db.collection('series').get();

  return await Promise.all(snapshot.docs.map(async doc => {
    const seriesId = doc.id;

    const lastEpisodeSnap = await db
      .collection('episodes')
      .where('seriesId', '==', seriesId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    const lastEpisode = lastEpisodeSnap.docs[0]?.data();
    const seasonsSnap = await db.collection(`series/${seriesId}/seasons`).get();

    return {
      id: seriesId,
      ...doc.data(),
      lastEpisode: lastEpisodeSnap.empty ? null : { id: lastEpisodeSnap.docs[0].id, ...lastEpisode },
      seasons: seasonsSnap.docs.map(s => ({ id: s.id, ...s.data() }))
    };
  }));
};

export const getPublicSeriesById = async (seriesId: string) => {

  const doc = await db.collection('series').doc(seriesId).get();
  if (!doc.exists) return null;

  const data: any = { id: doc.id, ...doc.data() };

  const sponsorsSnap = await db.collection(`series/${seriesId}/sponsors`).get();
  const sponsors = sponsorsSnap.docs.reduce((acc: any, doc) => {
    acc[doc.id] = { id: doc.id, ...doc.data() };
    return acc;
  }, {});

  // Fetch series sliders marked for series page
  const seriesSlidersSnap = await db.collection(`series/${seriesId}/sliders`)
    .where('showOnSeriesPage', '==', true)
    .get();
  
  const seriesSliders: any = {};
  for (const sliderDoc of seriesSlidersSnap.docs) {
    const sliderData = sliderDoc.data();
    const items = [];
    
    // Fetch sub-content items for this slider
    if (sliderData.items && Array.isArray(sliderData.items)) {
      for (const itemId of sliderData.items) {
        const itemDoc = await db.collection(`series/${seriesId}/subContent`).doc(itemId).get();
        if (itemDoc.exists) {
          items.push({ id: itemDoc.id, ...itemDoc.data() });
        }
      }
    }
    
    seriesSliders[sliderDoc.id] = {
      id: sliderDoc.id,
      title: sliderData.title,
      description: sliderData.description,
      sponsor: sliderData.sponsor,
      type: 'series_slider',
      items
    };
  }

  const blocks = data.sectionsOrder?.map((key: string) => {
    if (key === 'sponsorsSlider') {
      // Only include sponsorsSlider in blocks if there are visible (checked) sponsors
      const visibleSponsors = (data.sponsorsSlider?.items || [])
        .filter((item: any) => item.checked && sponsors[item.id])
        .map((item: any) => sponsors[item.id]);
      
      if (visibleSponsors.length === 0) {
        return null; // Don't render in public site if all sponsors are hidden
      }
      
      return {
        title: 'Sponsors carousel',
        id: 'sponsorsSlider',
        type: 'sponsorsSlider',
        items: visibleSponsors
      }
    } else if (key.startsWith('banner') && data.banners[key]) {
      return {
        ...data.banners[key],
        type: 'banner'
      }
    } else if (key.startsWith('slider') && data.episodes_sliders[key]) {
      const slider = data.episodes_sliders[key];
      return {
        ...slider,
        type: 'slider',
        sponsor: slider.sponsor ? sponsors[slider.sponsor] : null
      }
    } else if (key.startsWith('gallery') && data.galleries[key]) {
      const gallery = data.galleries[key];
      return {
        ...gallery,
        type: 'gallery',
        sponsor: gallery.sponsor ? sponsors[gallery.sponsor] : null
      }
    } else if (seriesSliders[key]) {
      // Handle series slider blocks
      const slider = seriesSliders[key];
      return {
        ...slider,
        sponsor: slider.sponsor ? sponsors[slider.sponsor] : null
      }
    } else {
      return null
    }
  })

  const seasonsSnap = await db.collection(`series/${seriesId}/seasons`).get();
  data.seasons = seasonsSnap.docs.map(s => ({ id: s.id, ...s.data() }));

  // TODO: return instead an array of all the blocks, based on sectionsOrder, with each block type for dynamic rendering
  if (data.episodes_sliders)
    data.episodes_sliders = Object.values(data.episodes_sliders);
  
  if(data.banners)
    data.banners = Object.values(data.banners);

  if (data.galleries)
    data.galleries = Object.values(data.galleries);

  data.sponsorsSlider = {
    title: 'Sponsors carousel',
    id: 'sponsorsSlider',
    items: (data.sponsorsSlider?.items || [])
      .filter((item: any) => item.checked && sponsors[item.id])
      .map((item: any) => sponsors[item.id])
  };

  data['blocks'] = blocks?.filter((block: any) => Boolean(block)) || [];

  return data;
};


/* Private/producers methods */
// TODO: enable draft system
export const getSeriesByProducerId = async (producerId: string) => {
  // const snapshot = await db.collection('series-draft')
  const snapshot = await db.collection("series")
    .where("producerId", "==", producerId)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

export const getSeriesById = async (id: string): Promise<Series | null> => {
  // const doc = await db.collection('series-draft').doc(id).get();
  const doc = await db.collection("series").doc(id).get();
  return doc.exists ? {id: doc.id, ...doc.data()} as Series : null;
};

export const createSeries = async (raw: any, producerId: string, producer: any) => {
  const seriesId = formatSeriesId(String(raw.title));

  const existing = await db.collection("series").doc(seriesId).get();
  if (existing.exists) {
    throw {code: "series-exists", message: "Series with this ID already exists"};
  }

  const series = {
    ...raw,
    producerId,
    producerName: producer.name,
    type: raw.type || 'season-based', // Default to season-based for backward compatibility
    episodes: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // await db.collection('series-draft').doc(seriesId).set(series);
  await db.collection("series").doc(seriesId).set(series);

  return {id: seriesId, ...series};
};

export const updateSeriesById = async (id: string, updates: any, producerId: string) => {
  // const docRef = db.collection('series-draft').doc(id);
  const docRef = db.collection("series").doc(id);
  const doc = await docRef.get();
  if (!doc.exists || doc.data()?.producerId !== producerId) return false;

  await docRef.update({
    ...updates,
    updatedAt: Date.now(),
  });
  return true;
};

export const deleteSeriesById = async (id: string, producerId: string) => {
  const docRef = db.collection("series").doc(id);
  const doc = await docRef.get();
  if (!doc.exists || doc.data()?.producerId !== producerId) return false;

  await docRef.delete();
  return true;
};

export const submitSeriesForReview = async (id: string, producerId: string) => {
  const docRef = db.collection("series-draft").doc(id);
  const doc = await docRef.get();
  if (!doc.exists || doc.data()?.producerId !== producerId) return false;

  await docRef.update({
    status: "pending_review",
    updatedAt: Date.now(),
  });
  return true;
};
