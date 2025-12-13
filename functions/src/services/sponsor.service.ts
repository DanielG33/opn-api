import {db} from "../firebase";
import {Sponsor} from "../models/sponsor";
import { getSectionsOrder, updateSeriesPageBlock } from "./series-page.service";

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
  
  // Add sponsorsSlider to sectionsOrder if this is the first sponsor
  const sponsors = await getSponsorsBySeries(seriesId);
  if (sponsors.length === 1) { // This was the first sponsor
    const sectionsOrder = await getSectionsOrder(seriesId);
    if (!sectionsOrder.includes('sponsorsSlider')) {
      sectionsOrder.unshift('sponsorsSlider'); // Add at the beginning
      await updateSeriesPageBlock(seriesId, { sectionsOrder }, { mergeFields: ['sectionsOrder'] });
    }
  }
  
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
  
  // Remove sponsorsSlider from sectionsOrder if this was the last sponsor
  const sponsors = await getSponsorsBySeries(seriesId);
  if (sponsors.length === 0) { // That was the last sponsor
    const sectionsOrder = await getSectionsOrder(seriesId);
    const index = sectionsOrder.indexOf('sponsorsSlider');
    if (index > -1) {
      sectionsOrder.splice(index, 1);
      await updateSeriesPageBlock(seriesId, { sectionsOrder }, { mergeFields: ['sectionsOrder'] });
    }
  }
};
