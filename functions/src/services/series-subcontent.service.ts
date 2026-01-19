import { db } from "../firebase";

// Sub-content interface for series-level sub-content
interface SeriesSubContent {
  id?: string;
  title: string;
  description?: string;
  videoUrl?: string;
  thumbnail?: {
    id: string;
    name: string;
    type?: string;
    url: string;
  };
  type: string; // video, article, gallery, etc.
  // Content-level draft flag (independent of series publicationStatus)
  // This marks individual subcontent items as draft vs published within the series
  status: 'draft' | 'published';
  seriesId: string;
  createdAt: number;
  updatedAt: number;
}

// Get all sub-content for a series
export const getSeriesSubContent = async (seriesId: string, filters?: { status?: string }) => {
  let query: FirebaseFirestore.Query = db.collection(`series/${seriesId}/subContent`);
  
  if (filters?.status && filters.status !== 'all') {
    query = query.where('status', '==', filters.status);
  }
  
  const snapshot = await query.orderBy('createdAt', 'desc').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SeriesSubContent));
};

// Get a specific sub-content item by ID
export const getSubContentById = async (seriesId: string, subContentId: string): Promise<SeriesSubContent | null> => {
  const doc = await db.collection(`series/${seriesId}/subContent`).doc(subContentId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as SeriesSubContent;
};

// Create new sub-content
export const createSeriesSubContent = async (seriesId: string, subContentData: Omit<SeriesSubContent, 'id' | 'seriesId' | 'createdAt' | 'updatedAt'>) => {
  const subContentRef = db.collection(`series/${seriesId}/subContent`);
  
  const subContent: Omit<SeriesSubContent, 'id'> = {
    ...subContentData,
    seriesId,
    status: subContentData.status || 'draft',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const docRef = await subContentRef.add(subContent);
  return { id: docRef.id, ...subContent } as SeriesSubContent;
};

// Update existing sub-content
export const updateSeriesSubContent = async (seriesId: string, subContentId: string, updateData: Partial<SeriesSubContent>) => {
  const subContentRef = db.collection(`series/${seriesId}/subContent`).doc(subContentId);
  
  const updatesWithTimestamp = {
    ...updateData,
    updatedAt: Date.now(),
  };

  await subContentRef.update(updatesWithTimestamp);
  
  const updated = await subContentRef.get();
  return { id: updated.id, ...updated.data() } as SeriesSubContent;
};

// Delete sub-content
export const deleteSeriesSubContent = async (seriesId: string, subContentId: string) => {
  const subContentRef = db.collection(`series/${seriesId}/subContent`).doc(subContentId);
  
  // Check if sub-content exists
  const doc = await subContentRef.get();
  if (!doc.exists) {
    throw new Error('Sub-content not found');
  }

  await subContentRef.delete();
  return { id: subContentId };
};

// Get published sub-content for public consumption
// Filters by BOTH:
// 1. Series publication workflow (publicationStatus == PUBLISHED)
// 2. Content draft status (subcontent.status == 'published')
export const getPublishedSeriesSubContent = async (seriesId: string, checkSeriesPublicationStatus: boolean = false) => {
  // For public endpoints, verify the series publication workflow status is PUBLISHED
  if (checkSeriesPublicationStatus) {
    const { SeriesPublicationStatus } = require('../types/series-status');
    try {
      const seriesDoc = await db.collection('series').doc(seriesId).get();
      if (!seriesDoc.exists) return [];
      
      const seriesData = seriesDoc.data();
      if (seriesData?.publicationStatus !== SeriesPublicationStatus.PUBLISHED) {
        return []; // Series publication workflow not PUBLISHED, return no sub-content
      }
    } catch (error) {
      console.error('Error checking series publication workflow status:', error);
      return []; // On error, don't expose sub-content
    }
  }
  
  const snapshot = await db
    .collection(`series/${seriesId}/subContent`)
    .where('status', '==', 'published')
    .orderBy('createdAt', 'desc')
    .get();
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SeriesSubContent));
};