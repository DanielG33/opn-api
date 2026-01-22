import { db } from "../firebase";

/**
 * Series page editing - always reads/writes from series-draft collection
 * Only published data appears in public series collection
 */
export const getPageBlocks = async (seriesId: string) => {
  // Read from draft collection for admin editing
  return db.collection('series-draft').doc(seriesId).get()
    .then(async doc => {
      if (!doc.exists)
        throw new Error('Resource not found');

      const data: any = doc.data();
      const sectionsOrder: string[] = data['sectionsOrder'] || [];
      const episodes_sliders = (data['episodes_sliders'] || {});
      const galleries = (data['galleries'] || {});
      const banners = (data['banners'] || {});
      const ads = (data['ads'] || {});

      // Fetch series sliders marked for series page
      const seriesSlidersSnapshot = await db
        .collection(`series/${seriesId}/sliders`)
        .where('showOnSeriesPage', '==', true)
        .get();
      
      const seriesSliders: any = {};
      seriesSlidersSnapshot.docs.forEach(doc => {
        seriesSliders[doc.id] = {
          id: doc.id,
          title: doc.data().title,
          type: 'series_slider',
          ...doc.data()
        };
      });

      const availableBlocks = {
        sponsorsSlider: {
          title: 'Sponsors carousel',
          id: 'sponsorsSlider',
          hidden: !(data.sponsorsSlider?.items || []).filter((s: any) => s.checked).length
        },
        ...banners,
        ...ads,
        ...episodes_sliders,
        ...galleries,
        ...seriesSliders
      };

      const blocks = sectionsOrder.map(key => (availableBlocks[key] || null))
        .filter(block => Boolean(block));

      return blocks;
    })
}

/**
 * Update series page block in draft collection
 * Writes to series-draft (admin working copy) only
 * Changes become public only when series is published via workflow
 */
export const updateSeriesPageBlock = async (seriesId: string, data: any, options: FirebaseFirestore.SetOptions = { merge: true }) => {
  return db.collection("series-draft").doc(seriesId)
    .set(data, options)
    .catch(error => {
      throw { code: "error", message: "There was an error updating the block" };
    })
};

/**
 * Get sections order from draft collection
 */
export const getSectionsOrder = async (seriesId: string): Promise<string[]> => {
  return (await db.collection('series-draft').doc(seriesId).get()).data()?.sectionsOrder || []
}
