import type { ContentKey, UsagePointer } from "../contracts";
import { db } from "../firebase";

export const buildContentKeyForSubContent = (subContentId: string): ContentKey =>
  `subContent_${subContentId}`;

export const buildPointerId = (pointer: UsagePointer): string => {
  if (!pointer.itemKey) {
    throw new Error("itemKey is required for pointerId");
  }

  if (pointer.targetKind === "seriesSubContentSlider") {
    if (!pointer.sliderId) {
      throw new Error("sliderId is required for seriesSubContentSlider pointerId");
    }
    return `seriesSubContentSlider_${pointer.sliderId}_${pointer.itemKey}`;
  }

  if (pointer.targetKind === "episodeSubContentSlider") {
    if (!pointer.episodeId || !pointer.sliderId) {
      throw new Error("episodeId and sliderId are required for episodeSubContentSlider pointerId");
    }
    return `episodeSubContentSlider_${pointer.episodeId}_${pointer.sliderId}_${pointer.itemKey}`;
  }

  throw new Error(`Unsupported targetKind for pointerId: ${pointer.targetKind}`);
};

export const upsertUsagePointer = async (
  seriesId: string,
  contentKey: ContentKey,
  pointer: UsagePointer
): Promise<string> => {
  const pointerId = buildPointerId(pointer);
  await db
    .doc(`series/${seriesId}/contentUsage/${contentKey}/pointers/${pointerId}`)
    .set(pointer, { merge: true });
  return pointerId;
};

export const deleteUsagePointer = async (
  seriesId: string,
  contentKey: ContentKey,
  pointerId: string
): Promise<void> => {
  await db
    .doc(`series/${seriesId}/contentUsage/${contentKey}/pointers/${pointerId}`)
    .delete();
};

export const listUsagePointers = async (
  seriesId: string,
  contentKey: ContentKey
): Promise<UsagePointer[]> => {
  const snapshot = await db
    .collection(`series/${seriesId}/contentUsage/${contentKey}/pointers`)
    .get();
  return snapshot.docs.map(doc => doc.data() as UsagePointer);
};

export const resolveTargetDocRef = (pointer: UsagePointer) => {
  if (pointer.targetKind === "seriesSubContentSlider") {
    if (!pointer.sliderId) {
      throw new Error("sliderId is required for seriesSubContentSlider target");
    }
    return db.doc(`series/${pointer.seriesId}/subContentSliders/${pointer.sliderId}`);
  }

  if (pointer.targetKind === "episodeSubContentSlider") {
    if (!pointer.episodeId || !pointer.sliderId) {
      throw new Error("episodeId and sliderId are required for episodeSubContentSlider target");
    }
    return db.doc(`episodes/${pointer.episodeId}/subContentSliders/${pointer.sliderId}`);
  }

  throw new Error(`Unsupported targetKind: ${pointer.targetKind}`);
};