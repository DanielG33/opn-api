// src/services/episode.service.ts
import { db } from '../firebase';
// import { format } from 'date-fns';
// import cryptoRandomString from 'crypto-random-string';

// TODO: enable draft system
export const getEpisodesByFilters = async (filters: { [key: string]: string }) => {
//   let query: FirebaseFirestore.Query = db.collection('episodes-draft');
  let query: FirebaseFirestore.Query = db.collection('episodes');
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query = query.where(key, '==', value);
  });

  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getEpisodeById = async (id: string) => {
//   const doc = await db.collection('episodes-draft').doc(id).get();
  const doc = await db.collection('episodes').doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
};

// TODO: implement season data
export const createEpisode = async (raw: any) => {
  const videoUrl = 'https://vimeo.com/' + raw.videoUrl.split('/').pop();

  // const seriesData = await db.collection('series').doc(raw.seriesId).get();
  // const seasonData = await db.collection(`series/${raw.seriesId}/seasons`).doc(raw.seasonId).get();

  const episode = {
    ...raw,
    videoUrl,
    // series: seriesData.data(),
    // season: seasonData.data(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

//   episode.subcontent?.forEach((slider: any) => {
//     slider.items = slider.items.map((item: any) => ({
//       ...item,
//       id: item.id || cryptoRandomString({ length: 10, type: 'alphanumeric' })
//     }));
//   });

//   const docRef = await db.collection('episodes-draft').add(episode);
  const docRef = await db.collection('episodes').add(episode);
  return { id: docRef.id, ...episode };
};

export const updateEpisode = async (id: string, data: any) => {
//   const ref = db.collection('episodes-draft').doc(id);
  const ref = db.collection('episodes').doc(id);
  await ref.update({ ...data, updatedAt: Date.now() });
  const updated = await ref.get();
  return { id: updated.id, ...updated.data() };
};

export const deleteEpisode = async (id: string) => {
//   await db.collection('episodes-draft').doc(id).delete();
  await db.collection('episodes').doc(id).delete();
  return { id };
};
