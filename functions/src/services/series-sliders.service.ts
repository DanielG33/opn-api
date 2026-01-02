import { db } from "../firebase";

// Series slider interface
interface SeriesSlider {
  id?: string;
  title: string;
  description?: string;
  sponsor?: any;
  items: string[]; // Array of sub-content IDs
  order?: number;
  createdAt?: number;
  updatedAt?: number;
}

// Get all sliders for a series
export const getSeriesSliders = async (seriesId: string): Promise<SeriesSlider[]> => {
  const snapshot = await db
    .collection(`series/${seriesId}/sliders`)
    .orderBy('order', 'asc')
    .get();
  
  const sliders = [];
  
  for (const doc of snapshot.docs) {
    const sliderData = doc.data();
    const slider: any = {
      id: doc.id,
      title: sliderData.title,
      description: sliderData.description || '',
      sponsor: sliderData.sponsor || null,
      order: sliderData.order || 0,
      createdAt: sliderData.createdAt,
      updatedAt: sliderData.updatedAt,
      items: []
    };

    // Fetch full sub-content items if items array exists
    if (sliderData.items && Array.isArray(sliderData.items)) {
      const itemIds = sliderData.items;
      const itemsPromises = itemIds.map(async (itemId: string) => {
        const itemDoc = await db.collection(`series/${seriesId}/subContent`).doc(itemId).get();
        if (itemDoc.exists) {
          return { id: itemDoc.id, ...itemDoc.data() };
        }
        return null;
      });
      
      const items = await Promise.all(itemsPromises);
      slider.items = items.filter(item => item !== null);
    }

    sliders.push(slider);
  }
  
  return sliders;
};

// Get a specific slider by ID
export const getSeriesSliderById = async (seriesId: string, sliderId: string): Promise<SeriesSlider | null> => {
  const doc = await db.collection(`series/${seriesId}/sliders`).doc(sliderId).get();
  
  if (!doc.exists) return null;
  
  const sliderData = doc.data();
  const slider: any = {
    id: doc.id,
    title: sliderData!.title,
    description: sliderData!.description || '',
    sponsor: sliderData!.sponsor || null,
    order: sliderData!.order || 0,
    createdAt: sliderData!.createdAt,
    updatedAt: sliderData!.updatedAt,
    items: []
  };

  // Fetch full sub-content items
  if (sliderData!.items && Array.isArray(sliderData!.items)) {
    const itemIds = sliderData!.items;
    const itemsPromises = itemIds.map(async (itemId: string) => {
      const itemDoc = await db.collection(`series/${seriesId}/subContent`).doc(itemId).get();
      if (itemDoc.exists) {
        return { id: itemDoc.id, ...itemDoc.data() };
      }
      return null;
    });
    
    const items = await Promise.all(itemsPromises);
    slider.items = items.filter(item => item !== null);
  }

  return slider;
};

// Create a new series slider
export const createSeriesSlider = async (seriesId: string, sliderData: Omit<SeriesSlider, 'id' | 'createdAt' | 'updatedAt'>) => {
  const slidersRef = db.collection(`series/${seriesId}/sliders`);
  
  const slider = {
    title: sliderData.title,
    description: sliderData.description || '',
    sponsor: sliderData.sponsor || null,
    items: sliderData.items || [], // Array of sub-content IDs
    order: sliderData.order || 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const docRef = await slidersRef.add(slider);
  return { id: docRef.id, ...slider };
};

// Update an existing series slider
export const updateSeriesSlider = async (seriesId: string, sliderId: string, sliderData: Partial<SeriesSlider>) => {
  const sliderRef = db.collection(`series/${seriesId}/sliders`).doc(sliderId);
  
  const updateData = {
    ...sliderData,
    updatedAt: Date.now(),
  };

  await sliderRef.update(updateData);
  const updated = await sliderRef.get();
  return { id: updated.id, ...updated.data() };
};

// Delete a series slider
export const deleteSeriesSlider = async (seriesId: string, sliderId: string) => {
  const sliderRef = db.collection(`series/${seriesId}/sliders`).doc(sliderId);
  await sliderRef.delete();
  return { id: sliderId };
};

// Add a sub-content item to a slider
export const addItemToSeriesSlider = async (seriesId: string, sliderId: string, itemId: string) => {
  const sliderRef = db.collection(`series/${seriesId}/sliders`).doc(sliderId);
  const sliderDoc = await sliderRef.get();
  
  if (!sliderDoc.exists) {
    throw new Error('Slider not found');
  }
  
  const sliderData = sliderDoc.data();
  const currentItems = sliderData?.items || [];
  
  // Avoid duplicates
  if (!currentItems.includes(itemId)) {
    currentItems.push(itemId);
  }
  
  await sliderRef.update({ 
    items: currentItems,
    updatedAt: Date.now()
  });
  
  return await getSeriesSliderById(seriesId, sliderId);
};

// Remove a sub-content item from a slider
export const removeItemFromSeriesSlider = async (seriesId: string, sliderId: string, itemId: string) => {
  const sliderRef = db.collection(`series/${seriesId}/sliders`).doc(sliderId);
  const sliderDoc = await sliderRef.get();
  
  if (!sliderDoc.exists) {
    throw new Error('Slider not found');
  }
  
  const sliderData = sliderDoc.data();
  const currentItems = sliderData?.items || [];
  const updatedItems = currentItems.filter((id: string) => id !== itemId);
  
  await sliderRef.update({ 
    items: updatedItems,
    updatedAt: Date.now()
  });
  
  return await getSeriesSliderById(seriesId, sliderId);
};
