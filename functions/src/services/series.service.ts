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

  const seasonsSnap = await db.collection(`series/${seriesId}/seasons`).get();
  data.seasons = seasonsSnap.docs.map(s => ({ id: s.id, ...s.data() }));

  data.sponsorsSlider = {
    title: 'Sponsors carousel',
    id: 'sponsors',
    items: (data.sponsorsSlider?.items || []).filter((item: any) => item.checked && sponsors[item.id])
  };

  data.gallery = {
    ...(data.gallery || null),
    title: 'gallery',
    id: 'gallery'
  };

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
  const docRef = db.collection("series-draft").doc(id);
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
