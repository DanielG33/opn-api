import {db} from "../firebase";
import {Series} from "../models/series";
import {formatSeriesId} from "../utils/format";
import {slugify, isValidSlug, generateSlugWithSuffix, parseSlugSuffix} from "../utils/slug.utils";

/* Helper functions for slug management */

/**
 * Finds the first available slug by checking seriesSlugs collection
 * If baseSlug is taken, tries baseSlug-2, baseSlug-3, etc.
 */
const findAvailableSlug = async (baseSlug: string, transaction?: FirebaseFirestore.Transaction): Promise<string> => {
  // Try base slug first
  const checkSlug = async (slug: string): Promise<boolean> => {
    const slugDocRef = db.collection("seriesSlugs").doc(slug);
    if (transaction) {
      const doc = await transaction.get(slugDocRef);
      return !doc.exists;
    } else {
      const doc = await slugDocRef.get();
      return !doc.exists;
    }
  };

  if (await checkSlug(baseSlug)) {
    return baseSlug;
  }

  // Try with numeric suffixes
  for (let i = 2; i <= 100; i++) {
    const candidateSlug = generateSlugWithSuffix(baseSlug, i);
    if (await checkSlug(candidateSlug)) {
      return candidateSlug;
    }
  }

  // Fallback: append timestamp
  return `${baseSlug}-${Date.now()}`;
};

/**
 * Checks if a slug is available
 */
export const isSlugAvailable = async (slug: string): Promise<boolean> => {
  const slugDoc = await db.collection("seriesSlugs").doc(slug).get();
  return !slugDoc.exists;
};

/**
 * Gets slug availability and suggests alternatives if taken
 */
export const checkSlugAvailability = async (slug: string): Promise<{available: boolean; suggested?: string}> => {
  const normalizedSlug = slugify(slug);
  
  if (!isValidSlug(normalizedSlug)) {
    return {available: false, suggested: normalizedSlug};
  }

  const available = await isSlugAvailable(normalizedSlug);
  
  if (available) {
    return {available: true};
  }

  // Suggest first available alternative
  const suggested = await findAvailableSlug(normalizedSlug);
  return {available: false, suggested};
};


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
  // Use Firestore transaction to reserve slug and create series atomically
  const result = await db.runTransaction(async (transaction) => {
    // Determine the slug (custom or generated)
    let finalSlug: string;
    
    if (raw.slug) {
      // User provided custom slug - normalize it
      finalSlug = slugify(raw.slug);
      if (!isValidSlug(finalSlug)) {
        throw {code: "SLUG_INVALID", message: "Invalid slug format"};
      }
    } else {
      // Generate slug from title
      const baseSlug = slugify(raw.title);
      if (!baseSlug) {
        throw {code: "SLUG_INVALID", message: "Cannot generate slug from title"};
      }
      // Find first available slug (baseSlug or baseSlug-2, baseSlug-3, etc.)
      finalSlug = await findAvailableSlug(baseSlug, transaction);
    }

    // Check if slug is available
    const slugDocRef = db.collection("seriesSlugs").doc(finalSlug);
    const slugDoc = await transaction.get(slugDocRef);
    
    if (slugDoc.exists) {
      throw {code: "SLUG_TAKEN", message: "Slug is already taken", suggestedSlug: await findAvailableSlug(finalSlug, transaction)};
    }

    // Create series document with auto-generated ID
    const seriesRef = db.collection("series").doc();
    const seriesId = seriesRef.id;
    
    const series = {
      ...raw,
      slug: finalSlug,
      producerId,
      producerName: producer.name,
      type: raw.type || 'season-based',
      episodes: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Create series document and slug index atomically
    transaction.set(seriesRef, series);
    transaction.set(slugDocRef, {
      seriesId,
      createdAt: Date.now(),
    });

    return {id: seriesId, ...series};
  });

  return result;
};

export const updateSeriesById = async (id: string, updates: any, producerId: string) => {
  const docRef = db.collection("series").doc(id);
  const doc = await docRef.get();
  if (!doc.exists || doc.data()?.producerId !== producerId) return false;

  const currentData = doc.data();
  const currentSlug = currentData?.slug;

  // If slug is being updated
  if (updates.slug && updates.slug !== currentSlug) {
    const newSlug = slugify(updates.slug);
    
    if (!isValidSlug(newSlug)) {
      throw {code: "SLUG_INVALID", message: "Invalid slug format"};
    }

    // Use transaction to update slug atomically
    await db.runTransaction(async (transaction) => {
      const newSlugDocRef = db.collection("seriesSlugs").doc(newSlug);
      const newSlugDoc = await transaction.get(newSlugDocRef);
      
      if (newSlugDoc.exists) {
        const suggested = await findAvailableSlug(newSlug, transaction);
        throw {code: "SLUG_TAKEN", message: "Slug is already taken", suggestedSlug: suggested};
      }

      // Update series with new slug
      transaction.update(docRef, {
        ...updates,
        slug: newSlug,
        updatedAt: Date.now(),
      });

      // Create new slug index
      transaction.set(newSlugDocRef, {
        seriesId: id,
        createdAt: Date.now(),
      });

      // Delete old slug index if it exists
      if (currentSlug) {
        const oldSlugDocRef = db.collection("seriesSlugs").doc(currentSlug);
        transaction.delete(oldSlugDocRef);
      }
    });
  } else {
    // Regular update without slug change
    await docRef.update({
      ...updates,
      updatedAt: Date.now(),
    });
  }

  return true;
};

export const deleteSeriesById = async (id: string, producerId: string) => {
  const docRef = db.collection("series").doc(id);
  const doc = await docRef.get();
  if (!doc.exists || doc.data()?.producerId !== producerId) return false;

  const slug = doc.data()?.slug;

  // Delete series and slug index atomically
  await db.runTransaction(async (transaction) => {
    transaction.delete(docRef);
    
    // Delete slug index if it exists
    if (slug) {
      const slugDocRef = db.collection("seriesSlugs").doc(slug);
      transaction.delete(slugDocRef);
    }
  });

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
