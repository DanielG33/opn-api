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

export const createSponsor = async (seriesId: string, data: any): Promise<Sponsor> => {
  const timestamp = Date.now();
  const sponsor: any = {
    name: data.name || "",
    link: data.link || "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  
  // Store logo as AssetRef if provided
  if (data.logo) {
    sponsor.logo = data.logo;
    sponsor.logoUrl = data.logo.url || ""; // Computed field for backward compatibility
  } else {
    sponsor.logoUrl = "";
  }
  
  const ref = await db.collection(`series/${seriesId}/sponsors`).add(sponsor);
  return {id: ref.id, ...sponsor};
};

export const updateSponsor = async (seriesId: string, sponsorId: string, data: any): Promise<Sponsor> => {
  const ref = db.collection(`series/${seriesId}/sponsors`).doc(sponsorId);
  const updateData: any = {...data, updatedAt: Date.now()};
  
  // If logo AssetRef is provided, also update logoUrl for backward compatibility
  if (data.logo) {
    updateData.logoUrl = data.logo.url || "";
  }
  
  await ref.update(updateData);
  const updated = await ref.get();
  return {id: updated.id, ...updated.data()} as Sponsor;
};

export const deleteSponsor = async (seriesId: string, sponsorId: string): Promise<void> => {
  await db.collection(`series/${seriesId}/sponsors`).doc(sponsorId).delete();
};
