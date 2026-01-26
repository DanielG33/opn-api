import {db} from "../firebase";
import {Series} from "../models/series";
import {slugify, isValidSlug, generateSlugWithSuffix} from "../utils/slug.utils";
import {SeriesPublicationStatus} from "../types/series-status";

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
  // Only fetch series where publication workflow status is PUBLISHED
  // This is the series-level publication gate, separate from any content draft flags
  const snapshot = await db.collection('series')
    .where('publicationStatus', '==', SeriesPublicationStatus.PUBLISHED)
    .get();

  return await Promise.all(snapshot.docs.map(async doc => {
    const seriesId = doc.id;

    const lastEpisodeSnap = await db
      .collection('episodes')
      .where('seriesId', '==', seriesId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    const lastEpisode = lastEpisodeSnap.docs[0]?.data();
    const seasonsSnap = await db.collection(`series/${seriesId}/seasons`)
      .orderBy('index', 'asc')
      .get();

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

  // Only return if series publication workflow status is PUBLISHED
  // This is independent of any content-level draft flags
  if (data.publicationStatus !== SeriesPublicationStatus.PUBLISHED) {
    return null;
  }

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

  const seasonsSnap = await db.collection(`series/${seriesId}/seasons`)
    .orderBy('index', 'asc')
    .get();
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

/**
 * Get draft series by ID (for authorized preview)
 * Reads from series-draft collection
 * Used when mode=draft query parameter is set and user is authorized
 * 
 * IMPORTANT: This function ignores publicationStatus and works for ALL statuses:
 * - DRAFT: Series being worked on
 * - IN_REVIEW: Series submitted for review
 * - PUBLISHED: Live series (allows previewing draft changes before publishing)
 * - HIDDEN: Hidden series (allows producer to preview)
 * - REJECTED: Rejected series (allows producer to see and fix issues)
 * 
 * Access control is handled by assertDraftAccess() which verifies:
 * - User is authenticated
 * - User is producer/admin
 * - Producer owns the series (or is admin)
 */
export const getDraftSeriesById = async (seriesId: string) => {
  const doc = await db.collection('series-draft').doc(seriesId).get();
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

  const seasonsSnap = await db.collection(`series/${seriesId}/seasons`)
    .orderBy('index', 'asc')
    .get();
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


/* Private/producers methods - Admin reads from series-draft collection */

/**
 * Get all series for a producer (ADMIN VIEW)
 * Reads from series-draft (admin working copy), enriches with publicationStatus from series
 * publicationStatus controls series visibility on public site (separate from content drafts)
 */
export const getSeriesByProducerId = async (producerId: string) => {
  // Admin reads from draft collection
  const snapshot = await db.collection('series-draft')
    .where("producerId", "==", producerId)
    .get();

  // Enrich with series publication workflow status from public collection
  const seriesPromises = snapshot.docs.map(async (doc) => {
    const draftData = { id: doc.id, ...doc.data() };
    
    // Fetch publicationStatus from public collection
    const publicDoc = await db.collection('series').doc(doc.id).get();
    if (publicDoc.exists) {
      const publicData = publicDoc.data();
      return {
        ...draftData,
        publicationStatus: publicData?.publicationStatus,
        publishedAt: publicData?.publishedAt,
        submittedAt: publicData?.submittedAt,
        reviewNotes: publicData?.reviewNotes,
      };
    }
    
    return draftData;
  });

  return await Promise.all(seriesPromises);
};

/**
 * Get series by publication workflow status (from public collection)
 * Used for admin review screens to filter by publicationStatus
 * This is the series-level publication gate, NOT content draft filtering
 */
export const getSeriesByStatus = async (status: SeriesPublicationStatus) => {
  const snapshot = await db.collection('series')
    .where('publicationStatus', '==', status)
    .get();

  // Enrich with draft data for preview
  const seriesPromises = snapshot.docs.map(async (doc) => {
    const publicData = { id: doc.id, ...doc.data() };
    
    // Optionally fetch draft for description/banner preview
    const draftDoc = await db.collection('series-draft').doc(doc.id).get();
    if (draftDoc.exists) {
      const draftData = draftDoc.data();
      return {
        ...publicData,
        // Include useful draft fields for preview
        description: draftData?.description,
        cover: draftData?.cover,
        logo: draftData?.logo,
      };
    }
    
    return publicData;
  });

  return await Promise.all(seriesPromises);
};

/**
 * Get a single series by ID (ADMIN VIEW)
 * Reads from series-draft (admin working copy), enriches with publicationStatus from series
 * publicationStatus controls series visibility on public site (separate from content drafts)
 */
export const getSeriesById = async (id: string): Promise<Series | null> => {
  // Admin reads from draft collection
  const draftDoc = await db.collection('series-draft').doc(id).get();
  if (!draftDoc.exists) return null;
  
  const draftData = { id: draftDoc.id, ...draftDoc.data() };
  
  // Enrich with series publication workflow status from public collection
  const publicDoc = await db.collection('series').doc(id).get();
  if (publicDoc.exists) {
    const publicData = publicDoc.data();
    return {
      ...draftData,
      publicationStatus: publicData?.publicationStatus,
      publishedAt: publicData?.publishedAt,
      submittedAt: publicData?.submittedAt,
      reviewNotes: publicData?.reviewNotes,
    } as Series;
  }
  
  return draftData as Series;
};

export const createSeries = async (raw: any, producerId: string, producer: any) => {
  // Use Firestore transaction to reserve slug and create both draft and public series atomically
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

    // Create series with auto-generated ID (same ID for both collections)
    const seriesId = db.collection("series").doc().id;
    const publicSeriesRef = db.collection("series").doc(seriesId);
    const draftSeriesRef = db.collection("series-draft").doc(seriesId);
    
    const timestamp = Date.now();
    
    // Full draft data with all editable fields
    const draftData = {
      ...raw,
      slug: finalSlug,
      producerId,
      producerName: producer.name,
      type: raw.type || 'season-based',
      episodes: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    
    // Public shell with minimal data (series publicationStatus is the source of truth)
    // This publicationStatus field controls series visibility on public site
    const publicData = {
      producerId,
      producerName: producer.name,
      slug: finalSlug,
      title: raw.title || '', // Minimal field for admin linking
      publicationStatus: SeriesPublicationStatus.DRAFT,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Create both documents atomically
    transaction.set(publicSeriesRef, publicData);
    transaction.set(draftSeriesRef, draftData);
    transaction.set(slugDocRef, {
      seriesId,
      createdAt: timestamp,
    });

    // Return draft data for admin UI (includes all fields)
    return {id: seriesId, ...draftData};
  });

  return result;
};

export const updateSeriesById = async (id: string, updates: any, producerId: string) => {
  // Admin updates draft collection
  const draftRef = db.collection("series-draft").doc(id);
  const draftDoc = await draftRef.get();
  if (!draftDoc.exists || draftDoc.data()?.producerId !== producerId) return false;

  const currentData = draftDoc.data();
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

      // Update draft with new slug
      transaction.update(draftRef, {
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
    await draftRef.update({
      ...updates,
      updatedAt: Date.now(),
    });
  }

  return true;
};

export const deleteSeriesById = async (id: string, producerId: string) => {
  // Check draft for ownership
  const draftRef = db.collection("series-draft").doc(id);
  const draftDoc = await draftRef.get();
  if (!draftDoc.exists || draftDoc.data()?.producerId !== producerId) return false;

  const slug = draftDoc.data()?.slug;
  const publicRef = db.collection("series").doc(id);

  // Delete from both draft and public collections atomically
  await db.runTransaction(async (transaction) => {
    transaction.delete(draftRef);
    transaction.delete(publicRef);
    
    // Delete slug index if it exists
    if (slug) {
      const slugDocRef = db.collection("seriesSlugs").doc(slug);
      transaction.delete(slugDocRef);
    }
  });

  return true;
};

/* Series Publication Workflow Methods */

/**
 * Submit series for review (first-time or resubmit)
 * Copies draft → public and sets status to IN_REVIEW
 * Status: DRAFT/REJECTED/HIDDEN -> IN_REVIEW
 */
export const submitForReview = async (seriesId: string, producerId: string): Promise<any> => {
  const draftRef = db.collection('series-draft').doc(seriesId);
  const publicRef = db.collection('series').doc(seriesId);
  
  return await db.runTransaction(async (transaction) => {
    const draftDoc = await transaction.get(draftRef);
    const publicDoc = await transaction.get(publicRef);
    
    if (!draftDoc.exists) {
      const error: any = new Error('Draft not found');
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const draftData: any = { id: draftDoc.id, ...draftDoc.data() };
    
    // Verify ownership
    if (draftData.producerId !== producerId) {
      const error: any = new Error('You can only submit your own series');
      error.code = 'FORBIDDEN';
      throw error;
    }
    
    // Fetch seasons from subcollection for validation (only for season-based series)
    if (draftData.type === 'season-based') {
      const seasonsSnap = await db.collection(`series/${seriesId}/seasons`)
        .orderBy('index', 'asc')
        .get();
      draftData.seasons = seasonsSnap.docs.map(s => ({ id: s.id, ...s.data() }));
    }
    
    // Validate draft content meets submission requirements
    const {canSubmitForReview} = require('../utils/series-publication.utils');
    const validation = canSubmitForReview(draftData);
    
    if (!validation.valid) {
      const error: any = new Error(validation.errors?.join(', ') || 'Validation failed');
      error.code = 'VALIDATION_FAILED';
      error.details = validation.errors;
      throw error;
    }
    
    // Check current public status if exists
    let currentStatus = SeriesPublicationStatus.DRAFT;
    if (publicDoc.exists) {
      const publicData = publicDoc.data();
      currentStatus = publicData?.publicationStatus || SeriesPublicationStatus.DRAFT;
      
      // Validate transition is allowed
      const allowedFromStatuses = [
        SeriesPublicationStatus.DRAFT,
        SeriesPublicationStatus.REJECTED,
        SeriesPublicationStatus.HIDDEN
      ];
      
      if (!allowedFromStatuses.includes(currentStatus)) {
        const error: any = new Error(`Cannot submit from status ${currentStatus}`);
        error.code = 'STATUS_CONFLICT';
        throw error;
      }
    }
    
    // Prepare public data by copying from draft
    const publicUpdates: any = {
      ...draftData,
      publicationStatus: SeriesPublicationStatus.IN_REVIEW,
      submittedAt: Date.now(),
      reviewNotes: null,
      updatedAt: Date.now()
    };
    
    // Preserve existing review metadata if resubmitting
    if (publicDoc.exists) {
      const existingData = publicDoc.data();
      if (existingData?.publishedAt) {
        publicUpdates.publishedAt = existingData.publishedAt;
      }
    }
    
    // Copy draft → public with IN_REVIEW status
    transaction.set(publicRef, publicUpdates, { merge: true });
    
    return { id: seriesId, ...publicUpdates };
  });
};

/**
 * Approve series (super admin only)
 * Status: IN_REVIEW -> PUBLISHED
 * Only changes status, does not recopy draft content
 * Syncs publicationStatus to draft for consistency
 */
export const approveSeries = async (seriesId: string, userRole: string): Promise<any> => {
  const {canApprove} = require('../utils/series-publication.utils');
  const publicRef = db.collection('series').doc(seriesId);
  const draftRef = db.collection('series-draft').doc(seriesId);
  
  return await db.runTransaction(async (transaction) => {
    const publicDoc = await transaction.get(publicRef);
    
    if (!publicDoc.exists) {
      const error: any = new Error('Series not found');
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const seriesData: any = { id: publicDoc.id, ...publicDoc.data() };
    
    // Validate role and transition
    const validation = canApprove(seriesData, userRole);
    
    if (!validation.valid) {
      const error: any = new Error(validation.errors?.join(', ') || 'Cannot approve series');
      error.code = validation.errors?.[0]?.includes('super admin') ? 'FORBIDDEN' : 'STATUS_CONFLICT';
      error.details = validation.errors;
      throw error;
    }
    
    const timestamp = Date.now();
    
    // Update public status
    const updates = {
      publicationStatus: SeriesPublicationStatus.PUBLISHED,
      publishedAt: timestamp,
      updatedAt: timestamp
    };
    
    transaction.update(publicRef, updates);
    
    // Sync to draft: copy full public data → draft to keep them in sync
    const draftDoc = await transaction.get(draftRef);
    if (draftDoc.exists) {
      const syncedDraft = {
        ...publicDoc.data(),
        ...updates,
      };
      transaction.set(draftRef, syncedDraft, { merge: true });
    }
    
    return { id: seriesId, ...seriesData, ...updates };
  });
};

/**
 * Reject series (super admin only)
 * Status: IN_REVIEW -> REJECTED
 * Only updates status and stores review notes, does not touch draft
 */
export const rejectSeries = async (
  seriesId: string, 
  userRole: string, 
  reviewNotes?: string
): Promise<any> => {
  const {canReject} = require('../utils/series-publication.utils');
  const seriesRef = db.collection('series').doc(seriesId);
  
  return await db.runTransaction(async (transaction) => {
    const seriesDoc = await transaction.get(seriesRef);
    
    if (!seriesDoc.exists) {
      const error: any = new Error('Series not found');
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const seriesData: any = { id: seriesDoc.id, ...seriesDoc.data() };
    
    // Validate role and transition
    const validation = canReject(seriesData, userRole);
    
    if (!validation.valid) {
      const error: any = new Error(validation.errors?.join(', ') || 'Cannot reject series');
      error.code = validation.errors?.[0]?.includes('super admin') ? 'FORBIDDEN' : 'STATUS_CONFLICT';
      error.details = validation.errors;
      throw error;
    }
    
    // Update status and notes only
    const updates: any = {
      publicationStatus: SeriesPublicationStatus.REJECTED,
      updatedAt: Date.now()
    };
    
    if (reviewNotes) {
      updates.reviewNotes = reviewNotes;
    }
    
    transaction.update(seriesRef, updates);
    
    return { id: seriesId, ...seriesData, ...updates };
  });
};

/**
 * Hide published series
 * Status: PUBLISHED -> HIDDEN
 * Only updates status, does not touch draft content
 */
export const hideSeries = async (seriesId: string, producerId: string, userRole: string): Promise<any> => {
  const {canHide} = require('../utils/series-publication.utils');
  const seriesRef = db.collection('series').doc(seriesId);
  
  return await db.runTransaction(async (transaction) => {
    const seriesDoc = await transaction.get(seriesRef);
    
    if (!seriesDoc.exists) {
      const error: any = new Error('Series not found');
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const seriesData: any = { id: seriesDoc.id, ...seriesDoc.data() };
    
    // Validate role and transition - pass producerId as userId for ownership check
    const validation = canHide(seriesData, userRole, producerId);
    
    if (!validation.valid) {
      const error: any = new Error(validation.errors?.join(', ') || 'Cannot hide series');
      error.code = validation.errors?.[0]?.includes('only hide') ? 'FORBIDDEN' : 'STATUS_CONFLICT';
      error.details = validation.errors;
      throw error;
    }
    
    // Update status only
    const updates = {
      publicationStatus: SeriesPublicationStatus.HIDDEN,
      updatedAt: Date.now()
    };
    
    transaction.update(seriesRef, updates);
    
    return { id: seriesId, ...seriesData, ...updates };
  });
};

/**
 * Publish updates to an already PUBLISHED series
 * Copies draft → public while maintaining PUBLISHED status
 * No approval needed for subsequent updates
 * Status: PUBLISHED -> PUBLISHED (stays published)
 * Draft already has the changes, just copies to public
 */
export const publishUpdates = async (seriesId: string, producerId: string): Promise<any> => {
  const draftRef = db.collection('series-draft').doc(seriesId);
  const publicRef = db.collection('series').doc(seriesId);
  
  return await db.runTransaction(async (transaction) => {
    const draftDoc = await transaction.get(draftRef);
    const publicDoc = await transaction.get(publicRef);
    
    if (!draftDoc.exists) {
      const error: any = new Error('Draft not found');
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    if (!publicDoc.exists) {
      const error: any = new Error('Public series not found - use submit-review for first publication');
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    const draftData: any = { id: draftDoc.id, ...draftDoc.data() };
    const publicData: any = publicDoc.data();
    
    // Verify ownership
    if (draftData.producerId !== producerId) {
      const error: any = new Error('You can only update your own series');
      error.code = 'FORBIDDEN';
      throw error;
    }
    
    // Must be currently PUBLISHED to use this endpoint
    const currentStatus = publicData?.publicationStatus;
    if (currentStatus !== SeriesPublicationStatus.PUBLISHED) {
      const error: any = new Error(`Cannot publish updates - series is ${currentStatus}. Use submit-review instead.`);
      error.code = 'STATUS_CONFLICT';
      throw error;
    }
    
    // Fetch seasons from subcollection for validation (only for season-based series)
    if (draftData.type === 'season-based') {
      const seasonsSnap = await db.collection(`series/${seriesId}/seasons`)
        .orderBy('index', 'asc')
        .get();
      draftData.seasons = seasonsSnap.docs.map(s => ({ id: s.id, ...s.data() }));
    }
    
    // Validate draft content
    const {canSubmitForReview} = require('../utils/series-publication.utils');
    const validation = canSubmitForReview(draftData);
    
    if (!validation.valid) {
      const error: any = new Error(validation.errors?.join(', ') || 'Validation failed');
      error.code = 'VALIDATION_FAILED';
      error.details = validation.errors;
      throw error;
    }
    
    // Copy draft → public, preserving PUBLISHED status and publishedAt
    const publicUpdates: any = {
      ...draftData,
      publicationStatus: SeriesPublicationStatus.PUBLISHED,
      publishedAt: publicData.publishedAt || Date.now(),
      updatedAt: Date.now(),
      reviewNotes: null
    };
    
    transaction.set(publicRef, publicUpdates, { merge: true });
    // Draft already has latest changes from admin edits, no need to sync back
    
    return { id: seriesId, ...publicUpdates };
  });
};

/**
 * Resubmit series for review
 * Status: REJECTED/HIDDEN -> IN_REVIEW
 * TODO: Implement full logic with validation
 */
export const resubmitForReview = async (seriesId: string, producerId: string): Promise<boolean> => {
  // Placeholder implementation
  // TODO:
  // 1. Validate using canResubmit()
  // 2. Update status to IN_REVIEW
  // 3. Set submittedAt timestamp
  // 4. Clear previous reviewNotes
  return false;
};
