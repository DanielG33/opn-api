import { applySnapshotForPointers, removeItemsForPointers } from "./subcontentSnapshotSync";

describe("subcontent snapshot propagation helpers", () => {
  const baseSnapshot = {
    subContentId: "sub_1",
    seriesId: "series_1",
    title: "Title",
    description: "Desc",
    type: "video",
    status: "published",
    updatedAt: Date.now()
  };

  it("published -> draft disables items", () => {
    const items = [
      { itemKey: "a", subContentId: "sub_1", snapshot: baseSnapshot, isActive: true },
      { itemKey: "b", subContentId: "sub_1", snapshot: baseSnapshot, isActive: true }
    ];

    const result = applySnapshotForPointers(items, ["a", "b"], { ...baseSnapshot, status: "draft" }, false);

    expect(result.updatedItems.every(item => item.isActive === false)).toBe(true);
  });

  it("draft -> published re-enables items", () => {
    const items = [
      { itemKey: "a", subContentId: "sub_1", snapshot: { ...baseSnapshot, status: "draft" }, isActive: false }
    ];

    const result = applySnapshotForPointers(items, ["a"], baseSnapshot, true);

    expect(result.updatedItems[0].isActive).toBe(true);
    expect(result.updatedItems[0].snapshot.status).toBe("published");
  });

  it("delete removes items", () => {
    const items = [
      { itemKey: "a", subContentId: "sub_1" },
      { itemKey: "b", subContentId: "sub_1" },
      { itemKey: "c", subContentId: "other" }
    ];

    const result = removeItemsForPointers(items, ["a", "b"]);

    expect(result.updatedItems).toHaveLength(1);
    expect(result.updatedItems[0].itemKey).toBe("c");
  });
});
