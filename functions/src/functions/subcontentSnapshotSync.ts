import { onDocumentDeleted, onDocumentUpdated } from "firebase-functions/v2/firestore";
import type { SubContentSnapshot, UsagePointer } from "../contracts";
import { db } from "../firebase";
import { resolveTargetDocRef } from "../utils/content-usage-helpers";

const MAX_BATCH_OPS = 450;

const buildSubContentSnapshot = (seriesId: string, subContentId: string, data: any): SubContentSnapshot => {
  if (!data) {
    throw new Error("Sub-content data missing");
  }

  if (data.seriesId && data.seriesId !== seriesId) {
    throw new Error("Sub-content seriesId mismatch");
  }

  if (!data.title || !data.type || !data.status) {
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

const isPublicSubContent = (data: any): boolean => data?.status === "published";

export const applySnapshotForPointers = (
  items: any[],
  pointerItemKeys: string[],
  snapshot: SubContentSnapshot,
  isActive: boolean
) => {
  const updatedItems = [...items];
  const missingKeys: string[] = [];
  let changed = false;
  const now = Date.now();

  for (const itemKey of pointerItemKeys) {
    const idx = updatedItems.findIndex(item => item?.itemKey === itemKey);
    if (idx === -1) {
      missingKeys.push(itemKey);
      continue;
    }

    updatedItems[idx] = {
      ...updatedItems[idx],
      snapshot,
      isActive,
      updatedAt: now
    };
    changed = true;
  }

  return { updatedItems, missingKeys, changed };
};

export const removeItemsForPointers = (items: any[], pointerItemKeys: string[]) => {
  const updatedItems = items.filter(item => !pointerItemKeys.includes(item?.itemKey));
  const missingKeys = pointerItemKeys.filter(key => !items.some(item => item?.itemKey === key));
  return { updatedItems, missingKeys };
};

type PointerEntry = {
  pointer: UsagePointer;
  ref: FirebaseFirestore.DocumentReference;
};

type SliderUpdate = {
  ref: FirebaseFirestore.DocumentReference;
  items: any[];
  updatedAt: number;
};

export const onSeriesSubContentUpdate = onDocumentUpdated(
  "series/{seriesId}/subContent/{subContentId}",
  async (event) => {
    const { seriesId, subContentId } = event.params;
    const change = event.data;
    if (!change?.before.exists || !change?.after.exists) {
      return;
    }

    const afterData = change.after.data();
    const isPublic = isPublicSubContent(afterData);
    const contentKey = `subContent_${subContentId}`;

    const snapshot = buildSubContentSnapshot(seriesId, subContentId, afterData);
    const pointersSnapshot = await db
      .collection(`series/${seriesId}/contentUsage/${contentKey}/pointers`)
      .get();

    const totalPointers = pointersSnapshot.size;
    if (totalPointers === 0) {
      console.log("subContent update: no pointers", { seriesId, subContentId });
      return;
    }

    const pointerEntries: PointerEntry[] = pointersSnapshot.docs.map(doc => ({
      pointer: doc.data() as UsagePointer,
      ref: doc.ref
    }));

    const grouped = new Map<string, { ref: FirebaseFirestore.DocumentReference; pointers: PointerEntry[] }>();

    for (const entry of pointerEntries) {
      const targetRef = resolveTargetDocRef(entry.pointer);
      const key = targetRef.path;
      const existing = grouped.get(key);
      if (existing) {
        existing.pointers.push(entry);
      } else {
        grouped.set(key, { ref: targetRef, pointers: [entry] });
      }
    }

    const sliderUpdates: SliderUpdate[] = [];
        const stalePointers: FirebaseFirestore.DocumentReference[] = [];
    let updatedSlidersCount = 0;
    let failuresCount = 0;

    for (const group of grouped.values()) {
      try {
        const sliderSnap = await group.ref.get();
        if (!sliderSnap.exists) {
              for (const entry of group.pointers) {
                stalePointers.push(entry.ref);
              }
          continue;
        }

        const sliderData = sliderSnap.data();
        const items = Array.isArray(sliderData?.items) ? [...sliderData.items] : [];
        const pointerItemKeys = group.pointers.map(entry => entry.pointer.itemKey);
        const { updatedItems, missingKeys, changed } = applySnapshotForPointers(
          items,
          pointerItemKeys,
          snapshot,
          isPublic
        );

            for (const entry of group.pointers) {
              if (missingKeys.includes(entry.pointer.itemKey)) {
                stalePointers.push(entry.ref);
              }
            }

        if (changed) {
          sliderUpdates.push({ ref: group.ref, items: updatedItems, updatedAt: Date.now() });
          updatedSlidersCount += 1;
        }
      } catch (error) {
        failuresCount += 1;
        console.error("subContent snapshot update failed", {
          seriesId,
          subContentId,
          target: group.ref.path,
          error
        });
      }
    }

    let batchedOps = 0;
    let batch = db.batch();

    const commitBatch = async () => {
      if (batchedOps === 0) {
        return;
      }
      await batch.commit();
      batchedOps = 0;
      batch = db.batch();
    };

    for (const update of sliderUpdates) {
      batch.update(update.ref, {
        items: update.items,
        updatedAt: update.updatedAt
      });
      batchedOps += 1;
      if (batchedOps >= MAX_BATCH_OPS) {
        await commitBatch();
      }
    }

    for (const ref of stalePointers) {
      batch.delete(ref);
      batchedOps += 1;
      if (batchedOps >= MAX_BATCH_OPS) {
        await commitBatch();
      }
    }

    await commitBatch();

    console.log("subContent visibility sync summary", {
      seriesId,
      subContentId,
      pointersCount: totalPointers,
      updatedSlidersCount,
          stalePointersPruned: stalePointers.length,
      failuresCount
    });

    if (failuresCount > 0) {
      throw new Error(`Failed to process ${failuresCount} slider targets`);
    }
  }
);

export const onSeriesSubContentDelete = onDocumentDeleted(
  "series/{seriesId}/subContent/{subContentId}",
  async (event) => {
    const { seriesId, subContentId } = event.params;
    const contentKey = `subContent_${subContentId}`;

    const pointersSnapshot = await db
      .collection(`series/${seriesId}/contentUsage/${contentKey}/pointers`)
      .get();

    const totalPointers = pointersSnapshot.size;
    if (totalPointers === 0) {
      console.log("subContent delete: no pointers", { seriesId, subContentId });
      return;
    }

    const pointerEntries: PointerEntry[] = pointersSnapshot.docs.map(doc => ({
      pointer: doc.data() as UsagePointer,
      ref: doc.ref
    }));

    const grouped = new Map<string, { ref: FirebaseFirestore.DocumentReference; pointers: PointerEntry[] }>();

    for (const entry of pointerEntries) {
      const targetRef = resolveTargetDocRef(entry.pointer);
      const key = targetRef.path;
      const existing = grouped.get(key);
      if (existing) {
        existing.pointers.push(entry);
      } else {
        grouped.set(key, { ref: targetRef, pointers: [entry] });
      }
    }

    const sliderUpdates: SliderUpdate[] = [];
    const stalePointers: FirebaseFirestore.DocumentReference[] = [];
    let updatedSlidersCount = 0;
    let failuresCount = 0;

    for (const group of grouped.values()) {
      try {
        const sliderSnap = await group.ref.get();
        if (!sliderSnap.exists) {
          for (const entry of group.pointers) {
            stalePointers.push(entry.ref);
          }
          continue;
        }

        const sliderData = sliderSnap.data();
        const items = Array.isArray(sliderData?.items) ? [...sliderData.items] : [];
        const pointerItemKeys = group.pointers.map(entry => entry.pointer.itemKey);
        const { updatedItems, missingKeys } = removeItemsForPointers(items, pointerItemKeys);

        for (const entry of group.pointers) {
          if (missingKeys.includes(entry.pointer.itemKey)) {
            stalePointers.push(entry.ref);
          }
        }

        sliderUpdates.push({ ref: group.ref, items: updatedItems, updatedAt: Date.now() });
        updatedSlidersCount += 1;
      } catch (error) {
        failuresCount += 1;
        console.error("subContent delete cleanup failed", {
          seriesId,
          subContentId,
          target: group.ref.path,
          error
        });
      }
    }

    let batchedOps = 0;
    let batch = db.batch();

    const commitBatch = async () => {
      if (batchedOps === 0) {
        return;
      }
      await batch.commit();
      batchedOps = 0;
      batch = db.batch();
    };

    for (const update of sliderUpdates) {
      batch.update(update.ref, {
        items: update.items,
        updatedAt: update.updatedAt
      });
      batchedOps += 1;
      if (batchedOps >= MAX_BATCH_OPS) {
        await commitBatch();
      }
    }

    for (const entry of pointerEntries) {
      batch.delete(entry.ref);
      batchedOps += 1;
      if (batchedOps >= MAX_BATCH_OPS) {
        await commitBatch();
      }
    }

    await commitBatch();

    console.log("subContent delete cleanup summary", {
      seriesId,
      subContentId,
      pointersCount: totalPointers,
      updatedSlidersCount,
          stalePointersPruned: stalePointers.length,
      failuresCount
    });

    if (failuresCount > 0) {
      throw new Error(`Failed to process ${failuresCount} slider targets`);
    }
  }
);