import { db } from "../firebase";
import { TargetKind } from "../contracts";
import { buildContentKeyForSubContent, buildPointerId } from "../utils/content-usage-helpers";
import {
  addItemToSeriesSlider,
  createSeriesSlider,
  deleteSeriesSlider,
  removeItemFromSeriesSlider
} from "./series-sliders.service";

describe("Series slider usage pointers", () => {
  const seriesId = `test_series_${Date.now()}`;
  const subContentId = `sub_${Date.now()}`;
  const subContentIdTwo = `sub_${Date.now()}_b`;

  const buildPointerIdFor = (sliderId: string, itemKey: string) =>
    buildPointerId({
      targetKind: TargetKind.SeriesSubContentSlider,
      seriesId,
      sliderId,
      itemKey
    } as any);

  beforeAll(async () => {
    await db.collection("series").doc(seriesId).set({
      title: "Test Series",
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    await db.collection(`series/${seriesId}/subContent`).doc(subContentId).set({
      seriesId,
      title: "SubContent A",
      description: "",
      type: "video",
      status: "published",
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    await db.collection(`series/${seriesId}/subContent`).doc(subContentIdTwo).set({
      seriesId,
      title: "SubContent B",
      description: "",
      type: "video",
      status: "published",
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  });

  afterAll(async () => {
    await db.collection(`series/${seriesId}/subContent`).doc(subContentId).delete();
    await db.collection(`series/${seriesId}/subContent`).doc(subContentIdTwo).delete();
    await db.collection("series").doc(seriesId).delete();
  });

  it("add item -> pointer exists", async () => {
    const slider = await createSeriesSlider(seriesId, {
      title: "Slider A",
      items: []
    });

    const updated = await addItemToSeriesSlider(seriesId, slider.id as string, subContentId);
    const itemKey = updated?.items?.[0]?.itemKey as string;

    const contentKey = buildContentKeyForSubContent(subContentId);
    const pointerId = buildPointerIdFor(slider.id as string, itemKey);
    const pointerDoc = await db
      .doc(`series/${seriesId}/contentUsage/${contentKey}/pointers/${pointerId}`)
      .get();

    expect(pointerDoc.exists).toBe(true);
  });

  it("remove item -> pointer removed", async () => {
    const slider = await createSeriesSlider(seriesId, {
      title: "Slider B",
      items: []
    });

    const updated = await addItemToSeriesSlider(seriesId, slider.id as string, subContentId);
    const itemKey = updated?.items?.[0]?.itemKey as string;

    const contentKey = buildContentKeyForSubContent(subContentId);
    const pointerId = buildPointerIdFor(slider.id as string, itemKey);

    await removeItemFromSeriesSlider(seriesId, slider.id as string, itemKey);

    const pointerDoc = await db
      .doc(`series/${seriesId}/contentUsage/${contentKey}/pointers/${pointerId}`)
      .get();

    expect(pointerDoc.exists).toBe(false);
  });

  it("delete slider -> pointers removed", async () => {
    const slider = await createSeriesSlider(seriesId, {
      title: "Slider C",
      items: []
    });

    await addItemToSeriesSlider(seriesId, slider.id as string, subContentId);
    const updatedTwo = await addItemToSeriesSlider(seriesId, slider.id as string, subContentIdTwo);

    const itemKeyOne = updatedTwo?.items?.find(item => item.subContentId === subContentId)?.itemKey as string;
    const itemKeyTwo = updatedTwo?.items?.find(item => item.subContentId === subContentIdTwo)?.itemKey as string;

    const contentKeyOne = buildContentKeyForSubContent(subContentId);
    const contentKeyTwo = buildContentKeyForSubContent(subContentIdTwo);

    const pointerIdOne = buildPointerIdFor(slider.id as string, itemKeyOne);
    const pointerIdTwo = buildPointerIdFor(slider.id as string, itemKeyTwo);

    await deleteSeriesSlider(seriesId, slider.id as string);

    const pointerDocOne = await db
      .doc(`series/${seriesId}/contentUsage/${contentKeyOne}/pointers/${pointerIdOne}`)
      .get();
    const pointerDocTwo = await db
      .doc(`series/${seriesId}/contentUsage/${contentKeyTwo}/pointers/${pointerIdTwo}`)
      .get();

    expect(pointerDocOne.exists).toBe(false);
    expect(pointerDocTwo.exists).toBe(false);
  });
});
