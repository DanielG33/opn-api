import { db } from '../firebase';

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
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Season));
};

export const getSeasonById = async (seriesId: string, seasonId: string): Promise<Season | null> => {
  const doc = await db.collection(`series/${seriesId}/seasons`).doc(seasonId).get();
  return doc.exists ? ({ id: doc.id, ...doc.data() } as Season) : null;
};

export const createSeason = async (seriesId: string, data: Partial<Season>): Promise<Season> => {
  const timestamp = Date.now();
  const season: Season = {
    index: data.index || 1,
    title: data.title || `Season ${data.index}`,
    description: data.description || '',
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const ref = await db.collection(`series/${seriesId}/seasons`).add(season);
  return { id: ref.id, ...season };
};

export const updateSeason = async (seriesId: string, seasonId: string, data: Partial<Season>): Promise<Season> => {
  const ref = db.collection(`series/${seriesId}/seasons`).doc(seasonId);
  await ref.update({ ...data, updatedAt: Date.now() });
  const updated = await ref.get();
  return { id: updated.id, ...updated.data() } as Season;
};

export const deleteSeason = async (seriesId: string, seasonId: string): Promise<void> => {
  await db.collection(`series/${seriesId}/seasons`).doc(seasonId).delete();
};
