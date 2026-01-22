import {db} from "../firebase";

export interface Season {
  id?: string;
  index: number;
  title?: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export const getSeasonsBySeries = async (seriesId: string): Promise<Season[]> => {
  const snapshot = await db.collection(`series/${seriesId}/seasons`).get();
  return snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()} as Season));
};

export const getSeasonById = async (seriesId: string, seasonId: string): Promise<Season | null> => {
  const doc = await db.collection(`series/${seriesId}/seasons`).doc(seasonId).get();
  return doc.exists ? ({id: doc.id, ...doc.data()} as Season) : null;
};

/**
 * @deprecated Use batchUpdateSeasons instead for better consistency
 * Single season creation - does not validate index uniqueness
 */
export const createSeason = async (seriesId: string, data: Partial<Season>): Promise<Season> => {
  const timestamp = Date.now();
  const season: Season = {
    index: data.index || 1,
    title: data.title || `Season ${data.index || 1}`,
    description: data.description || "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const ref = await db.collection(`series/${seriesId}/seasons`).add(season);
  return {id: ref.id, ...season};
};

/**
 * @deprecated Use batchUpdateSeasons instead for better consistency
 * Single season update - does not validate index uniqueness
 */
export const updateSeason = async (seriesId: string, seasonId: string, data: Partial<Season>): Promise<Season> => {
  const ref = db.collection(`series/${seriesId}/seasons`).doc(seasonId);
  await ref.update({...data, updatedAt: Date.now()});
  const updated = await ref.get();
  return {id: updated.id, ...updated.data()} as Season;
};

export const deleteSeason = async (seriesId: string, seasonId: string): Promise<void> => {
  await db.collection(`series/${seriesId}/seasons`).doc(seasonId).delete();
};

/**
 * Batch update seasons (reorder, create, update, delete)
 * This allows atomic updates of all seasons at once with validation
 */
export const batchUpdateSeasons = async (seriesId: string, seasons: Partial<Season>[]): Promise<Season[]> => {
  // Validate: indexes must be sequential 1..N
  const sortedByIndex = [...seasons].sort((a, b) => (a.index || 0) - (b.index || 0));
  const expectedIndexes = sortedByIndex.map((_, i) => i + 1);
  const actualIndexes = sortedByIndex.map(s => s.index);
  
  if (JSON.stringify(expectedIndexes) !== JSON.stringify(actualIndexes)) {
    throw new Error('Indexes must be sequential starting from 1 with no gaps or duplicates');
  }
  
  const batch = db.batch();
  const timestamp = Date.now();
  const seasonsRef = db.collection(`series/${seriesId}/seasons`);
  
  // Get existing seasons to determine which to delete
  const existingSnapshot = await seasonsRef.get();
  const existingIds = new Set(existingSnapshot.docs.map(doc => doc.id));
  const updatedIds = new Set(seasons.map(s => s.id).filter(Boolean));
  
  // Delete seasons not in the new list
  const toDelete = [...existingIds].filter(id => !updatedIds.has(id));
  for (const id of toDelete) {
    batch.delete(seasonsRef.doc(id));
  }
  
  // Create or update seasons
  const results: Season[] = [];
  for (const season of seasons) {
    const seasonData: Season = {
      index: season.index || 1,
      title: season.title || `Season ${season.index || 1}`,
      description: season.description || "",
      createdAt: season.createdAt || timestamp,
      updatedAt: timestamp,
    };
    
    if (season.id && existingIds.has(season.id)) {
      // Update existing
      batch.update(seasonsRef.doc(season.id), seasonData);
      results.push({ id: season.id, ...seasonData });
    } else {
      // Create new (ignore temporary client IDs like temp_*)
      const newRef = seasonsRef.doc();
      batch.set(newRef, seasonData);
      results.push({ id: newRef.id, ...seasonData });
    }
  }
  
  await batch.commit();
  
  // Return sorted by index for consistency
  return results.sort((a, b) => a.index - b.index);
};
