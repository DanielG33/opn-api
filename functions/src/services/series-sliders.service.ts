import { db } from "../firebase";
import type { SliderItem, SubContentSnapshot, UsagePointer } from "../contracts";
import { TargetKind } from "../contracts";
import { buildContentKeyForSubContent, buildPointerId } from "../utils/content-usage-helpers";
import { getSectionsOrder, updateSeriesPageBlock } from "./series-page.service";

// Series slider interface
interface SeriesSlider {
  id?: string;
  title: string;
  description?: string;
  sponsor?: any;
  items: SliderItem[]; // Denormalized snapshots
  order?: number;
  showOnSeriesPage?: boolean;
  showOnPlayerPage?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

const validateSliderItems = (items: any[], seriesId: string) => {
  if (!Array.isArray(items)) {
    throw new Error("Slider items must be an array");
  }

  const itemKeys = new Set<string>();

  for (const item of items) {
    if (!item?.itemKey || typeof item.itemKey !== "string") {
      throw new Error("Slider item missing required itemKey");
    }
    if (itemKeys.has(item.itemKey)) {
      throw new Error("Duplicate itemKey in slider items");
    }
    itemKeys.add(item.itemKey);

    if (!item?.contentKey || typeof item.contentKey !== "string") {
      throw new Error("Slider item missing required contentKey");
    }

    if (!item?.subContentId || typeof item.subContentId !== "string") {
      throw new Error("Slider item missing required subContentId");
    }

    const expectedContentKey = `subContent_${item.subContentId}`;
    if (item.contentKey !== expectedContentKey) {
      throw new Error("Slider item contentKey does not match subContentId");
    }

    if (!item?.snapshot) {
      throw new Error("Slider item missing required snapshot");
    }

    if (item.snapshot.seriesId && item.snapshot.seriesId !== seriesId) {
      throw new Error("Slider item snapshot seriesId mismatch");
    }

    if (typeof item.isActive !== "boolean") {
      throw new Error("Slider item missing required isActive flag");
    }
  }
};

const buildSubContentSnapshot = (seriesId: string, subContentId: string, data: any): SubContentSnapshot => {
  if (data?.seriesId && data.seriesId !== seriesId) {
    throw new Error("Sub-content seriesId mismatch");
  }

  if (!data?.title || !data?.type || !data?.status) {
    throw new Error("Sub-content snapshot missing required fields");
  }

  return {
    subContentId,
    seriesId,
    title: data.title,
    description: data.description || "",
    videoUrl: data.videoUrl,
    thumbnail: data.thumbnail,
    type: data.type,
    status: data.status,
    updatedAt: data.updatedAt || Date.now()
  };
};

const buildUsagePointer = (seriesId: string, sliderId: string, itemKey: string): UsagePointer => ({
  targetKind: TargetKind.SeriesSubContentSlider,
  seriesId,
  sliderId,
  itemKey,
  createdAt: Date.now(),
  updatedAt: Date.now()
});

// Get all sliders for a series
export const getSeriesSliders = async (seriesId: string): Promise<SeriesSlider[]> => {
  const snapshot = await db
    .collection(`series/${seriesId}/subContentSliders`)
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
      showOnSeriesPage: sliderData.showOnSeriesPage || false,
      showOnPlayerPage: sliderData.showOnPlayerPage || false,
      createdAt: sliderData.createdAt,
      updatedAt: sliderData.updatedAt,
      items: sliderData.items || []
    };

    sliders.push(slider);
  }
  
  return sliders;
};

// Get a specific slider by ID
export const getSeriesSliderById = async (seriesId: string, sliderId: string): Promise<SeriesSlider | null> => {
  const doc = await db.collection(`series/${seriesId}/subContentSliders`).doc(sliderId).get();
  
  if (!doc.exists) return null;
  
  const sliderData = doc.data();
  const slider: any = {
    id: doc.id,
    title: sliderData!.title,
    description: sliderData!.description || '',
    sponsor: sliderData!.sponsor || null,
    order: sliderData!.order || 0,
    showOnSeriesPage: sliderData!.showOnSeriesPage || false,
    showOnPlayerPage: sliderData!.showOnPlayerPage || false,
    createdAt: sliderData!.createdAt,
    updatedAt: sliderData!.updatedAt,
    items: sliderData!.items || []
  };

  return slider;
};

// Create a new series slider
export const createSeriesSlider = async (seriesId: string, sliderData: Omit<SeriesSlider, 'id' | 'createdAt' | 'updatedAt'>) => {
  const slidersRef = db.collection(`series/${seriesId}/subContentSliders`);
  const sliderRef = slidersRef.doc();
  const now = Date.now();

  const itemsInput = Array.isArray(sliderData.items) ? sliderData.items : [];

  const batch = db.batch();

  const normalizedItems: SliderItem[] = [];
  const itemKeys = new Set<string>();

  for (const item of itemsInput) {
    const subContentId = item?.subContentId;
    if (!subContentId) {
      throw new Error("Slider item missing required subContentId");
    }

    const itemKey = typeof item?.itemKey === "string" ? item.itemKey : crypto.randomUUID();
    if (itemKeys.has(itemKey)) {
      throw new Error("Duplicate itemKey in slider items");
    }
    itemKeys.add(itemKey);

    const subContentRef = db.doc(`series/${seriesId}/subContent/${subContentId}`);
    const subContentSnap = await subContentRef.get();
    if (!subContentSnap.exists) {
      throw new Error("Sub-content not found");
    }

    const snapshot = buildSubContentSnapshot(seriesId, subContentId, subContentSnap.data());
    const contentKey = buildContentKeyForSubContent(subContentId);

    const normalizedItem: SliderItem = {
      itemKey,
      contentKey,
      subContentId,
      snapshot,
      isActive: true,
      isHidden: item?.isHidden,
      createdAt: now,
      updatedAt: now
    };

    normalizedItems.push(normalizedItem);

    const pointer = buildUsagePointer(seriesId, sliderRef.id, itemKey);
    const pointerId = buildPointerId(pointer);
    batch.set(
      db.doc(`series/${seriesId}/contentUsage/${contentKey}/pointers/${pointerId}`),
      pointer,
      { merge: true }
    );
  }

  validateSliderItems(normalizedItems, seriesId);

  const slider = {
    title: sliderData.title,
    description: sliderData.description || '',
    sponsor: sliderData.sponsor || null,
    items: normalizedItems,
    order: sliderData.order || 0,
    showOnSeriesPage: sliderData.showOnSeriesPage || false,
    showOnPlayerPage: sliderData.showOnPlayerPage || false,
    createdAt: now,
    updatedAt: now,
  };

  batch.set(sliderRef, slider);
  await batch.commit();
  
  // If slider is marked for series page, add it to sectionsOrder
  if (slider.showOnSeriesPage) {
    const sectionsOrder = await getSectionsOrder(seriesId);
    sectionsOrder.push(sliderRef.id);
    await updateSeriesPageBlock(seriesId, { sectionsOrder });
  }
  
  return { id: sliderRef.id, ...slider };
};

// Update an existing series slider
export const updateSeriesSlider = async (seriesId: string, sliderId: string, sliderData: Partial<SeriesSlider>) => {
  const sliderRef = db.collection(`series/${seriesId}/subContentSliders`).doc(sliderId);
  
  // Get current slider data to check showOnSeriesPage changes
  const currentDoc = await sliderRef.get();
  const currentData = currentDoc.data();
  const previousShowOnSeriesPage = currentData?.showOnSeriesPage || false;
  const newShowOnSeriesPage = sliderData.showOnSeriesPage !== undefined ? sliderData.showOnSeriesPage : previousShowOnSeriesPage;

  const updateData = {
    ...sliderData,
    updatedAt: Date.now(),
  } as Partial<SeriesSlider> & { updatedAt: number };

  if (sliderData.items) {
    await db.runTransaction(async tx => {
      const sliderSnap = await tx.get(sliderRef);
      if (!sliderSnap.exists) {
        throw new Error("Slider not found");
      }

      const existingItems = (sliderSnap.data()?.items || []) as SliderItem[];
      const existingByKey = new Map(existingItems.map(item => [item.itemKey, item] as const));

      const nextItems: SliderItem[] = [];
      const nextKeys = new Set<string>();
      const now = Date.now();

      for (const item of sliderData.items || []) {
        const providedKey = typeof item?.itemKey === "string" ? item.itemKey : undefined;
        const itemKey = providedKey || crypto.randomUUID();

        if (nextKeys.has(itemKey)) {
          throw new Error("Duplicate itemKey in slider items");
        }
        nextKeys.add(itemKey);

        const existingItem = existingByKey.get(itemKey);

        if (existingItem) {
          if (item?.subContentId && item.subContentId !== existingItem.subContentId) {
            throw new Error("Cannot change subContentId for existing slider item");
          }

          nextItems.push({
            ...existingItem,
            isActive: typeof item?.isActive === "boolean" ? item.isActive : existingItem.isActive,
            isHidden: item?.isHidden !== undefined ? item.isHidden : existingItem.isHidden,
            updatedAt: now
          });
          continue;
        }

        const subContentId = item?.subContentId;
        if (!subContentId) {
          throw new Error("Slider item missing required subContentId");
        }

        const subContentRef = db.doc(`series/${seriesId}/subContent/${subContentId}`);
        const subContentSnap = await tx.get(subContentRef);
        if (!subContentSnap.exists) {
          throw new Error("Sub-content not found");
        }

        const snapshot = buildSubContentSnapshot(seriesId, subContentId, subContentSnap.data());
        const contentKey = buildContentKeyForSubContent(subContentId);

        nextItems.push({
          itemKey,
          contentKey,
          subContentId,
          snapshot,
          isActive: true,
          isHidden: item?.isHidden,
          createdAt: now,
          updatedAt: now
        });
      }

      validateSliderItems(nextItems, seriesId);

      const removedItems = existingItems.filter(item => !nextKeys.has(item.itemKey));
      const addedItems = nextItems.filter(item => !existingByKey.has(item.itemKey));

      tx.update(sliderRef, {
        ...updateData,
        items: nextItems,
        updatedAt: now
      });

      for (const item of removedItems) {
        const pointer = buildUsagePointer(seriesId, sliderId, item.itemKey);
        const pointerId = buildPointerId(pointer);
        const contentKey = item.contentKey || buildContentKeyForSubContent(item.subContentId);
        tx.delete(db.doc(`series/${seriesId}/contentUsage/${contentKey}/pointers/${pointerId}`));
      }

      for (const item of addedItems) {
        const pointer = buildUsagePointer(seriesId, sliderId, item.itemKey);
        const pointerId = buildPointerId(pointer);
        const contentKey = item.contentKey || buildContentKeyForSubContent(item.subContentId);
        tx.set(
          db.doc(`series/${seriesId}/contentUsage/${contentKey}/pointers/${pointerId}`),
          pointer,
          { merge: true }
        );
      }
    });
  } else {
    await sliderRef.update(updateData);
  }
  
  // Handle sectionsOrder changes
  if (previousShowOnSeriesPage !== newShowOnSeriesPage) {
    const sectionsOrder = await getSectionsOrder(seriesId);
    
    if (newShowOnSeriesPage && !sectionsOrder.includes(sliderId)) {
      // Add to sectionsOrder if now marked for series page
      sectionsOrder.push(sliderId);
      await updateSeriesPageBlock(seriesId, { sectionsOrder });
    } else if (!newShowOnSeriesPage && sectionsOrder.includes(sliderId)) {
      // Remove from sectionsOrder if unmarked
      const updatedSectionsOrder = sectionsOrder.filter(id => id !== sliderId);
      await updateSeriesPageBlock(seriesId, { sectionsOrder: updatedSectionsOrder });
    }
  }
  
  const updated = await sliderRef.get();
  return { id: updated.id, ...updated.data() };
};

// Delete a series slider
export const deleteSeriesSlider = async (seriesId: string, sliderId: string) => {
  const sliderRef = db.collection(`series/${seriesId}/subContentSliders`).doc(sliderId);
  
  // Remove from sectionsOrder before deleting
  const sectionsOrder = await getSectionsOrder(seriesId);
  if (sectionsOrder.includes(sliderId)) {
    const updatedSectionsOrder = sectionsOrder.filter(id => id !== sliderId);
    await updateSeriesPageBlock(seriesId, { sectionsOrder: updatedSectionsOrder });
  }
  
  await db.runTransaction(async tx => {
    const sliderSnap = await tx.get(sliderRef);
    if (!sliderSnap.exists) {
      return;
    }
    const items = (sliderSnap.data()?.items || []) as SliderItem[];

    for (const item of items) {
      const pointer = buildUsagePointer(seriesId, sliderId, item.itemKey);
      const pointerId = buildPointerId(pointer);
      const contentKey = item.contentKey || buildContentKeyForSubContent(item.subContentId);
      tx.delete(db.doc(`series/${seriesId}/contentUsage/${contentKey}/pointers/${pointerId}`));
    }

    tx.delete(sliderRef);
  });
  return { id: sliderId };
};

// Add a sub-content item to a slider
export const addItemToSeriesSlider = async (seriesId: string, sliderId: string, itemId: string) => {
  const sliderRef = db.collection(`series/${seriesId}/subContentSliders`).doc(sliderId);
  const subContentRef = db.doc(`series/${seriesId}/subContent/${itemId}`);
  const now = Date.now();

  await db.runTransaction(async tx => {
    const [sliderSnap, subContentSnap] = await Promise.all([
      tx.get(sliderRef),
      tx.get(subContentRef)
    ]);

    if (!sliderSnap.exists) {
      throw new Error("Slider not found");
    }
    if (!subContentSnap.exists) {
      throw new Error("Sub-content not found");
    }

    const currentItems = (sliderSnap.data()?.items || []) as SliderItem[];
    const itemKey = crypto.randomUUID();
    const snapshot = buildSubContentSnapshot(seriesId, itemId, subContentSnap.data());
    const contentKey = buildContentKeyForSubContent(itemId);

    const nextItems = [
      ...currentItems,
      {
        itemKey,
        contentKey,
        subContentId: itemId,
        snapshot,
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    ];

    validateSliderItems(nextItems, seriesId);

    tx.update(sliderRef, {
      items: nextItems,
      updatedAt: now
    });

    const pointer = buildUsagePointer(seriesId, sliderId, itemKey);
    const pointerId = buildPointerId(pointer);
    tx.set(
      db.doc(`series/${seriesId}/contentUsage/${contentKey}/pointers/${pointerId}`),
      pointer,
      { merge: true }
    );
  });

  return await getSeriesSliderById(seriesId, sliderId);
};

// Remove a sub-content item from a slider
export const removeItemFromSeriesSlider = async (seriesId: string, sliderId: string, itemId: string) => {
  const sliderRef = db.collection(`series/${seriesId}/subContentSliders`).doc(sliderId);
  await db.runTransaction(async tx => {
    const sliderSnap = await tx.get(sliderRef);
    if (!sliderSnap.exists) {
      throw new Error('Slider not found');
    }

    const currentItems = (sliderSnap.data()?.items || []) as SliderItem[];
    validateSliderItems(currentItems, seriesId);

    const updatedItems = currentItems.filter(item => item?.itemKey !== itemId);
    const removedItem = currentItems.find(item => item?.itemKey === itemId);

    tx.update(sliderRef, {
      items: updatedItems,
      updatedAt: Date.now()
    });

    if (removedItem) {
      const pointer = buildUsagePointer(seriesId, sliderId, removedItem.itemKey);
      const pointerId = buildPointerId(pointer);
      const contentKey = removedItem.contentKey || buildContentKeyForSubContent(removedItem.subContentId);
      tx.delete(db.doc(`series/${seriesId}/contentUsage/${contentKey}/pointers/${pointerId}`));
    }
  });

  return await getSeriesSliderById(seriesId, sliderId);
};
