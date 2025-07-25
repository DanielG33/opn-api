import {db} from "../firebase";
import {Sponsor} from "../models/sponsor";

export const getSponsorsBySeries = async (seriesId: string): Promise<Sponsor[]> => {
  const snapshot = await db.collection(`series/${seriesId}/sponsors`).get();
  return snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()} as Sponsor));
};

export const getSponsorById = async (seriesId: string, sponsorId: string): Promise<Sponsor | null> => {
  const doc = await db.collection(`series/${seriesId}/sponsors`).doc(sponsorId).get();
  return doc.exists ? ({id: doc.id, ...doc.data()} as Sponsor) : null;
};

export const createSponsor = async (seriesId: string, data: Partial<Sponsor>): Promise<Sponsor> => {
  const timestamp = Date.now();
  const sponsor: Sponsor = {
    name: data.name || "",
    logo: data.logo,
    link: data.link || "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const ref = await db.collection(`series/${seriesId}/sponsors`).add(sponsor);
  return {id: ref.id, ...sponsor};
};

export const updateSponsor = async (seriesId: string, sponsorId: string, data: Partial<Sponsor>): Promise<Sponsor> => {
  const ref = db.collection(`series/${seriesId}/sponsors`).doc(sponsorId);
  await ref.update({...data, updatedAt: Date.now()});
  const updated = await ref.get();
  return {id: updated.id, ...updated.data()} as Sponsor;
};

export const deleteSponsor = async (seriesId: string, sponsorId: string): Promise<void> => {
  await db.collection(`series/${seriesId}/sponsors`).doc(sponsorId).delete();
};
