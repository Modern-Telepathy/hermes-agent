import { describe, expect, it } from "vitest";

import {
  SIDEBAR_ORDER_KEY,
  applySidebarOrder,
  emptySidebarOrder,
  movePath,
  orderPaths,
  readStoredSidebarOrder,
  writeStoredSidebarOrder,
} from "./sidebar-order";

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, value),
  } as Storage;
}

const items = [{ path: "/chat" }, { path: "/sessions" }, { path: "/files" }];

describe("sidebar order", () => {
  it("reorders saved paths and appends items the order does not know", () => {
    expect(orderPaths(applySidebarOrder(items, ["/files", "/chat"]))).toEqual([
      "/files",
      "/chat",
      "/sessions",
    ]);
  });

  it("leaves the list untouched when nothing is saved", () => {
    expect(applySidebarOrder(items, [])).toBe(items);
  });

  it("moves one path to another position", () => {
    expect(movePath(["/a", "/b", "/c"], 2, 0)).toEqual(["/c", "/a", "/b"]);
    expect(movePath(["/a", "/b", "/c"], 0, 2)).toEqual(["/b", "/c", "/a"]);
  });

  it("ignores moves that are out of range or a no-op", () => {
    const paths = ["/a", "/b"];
    expect(movePath(paths, 1, 1)).toBe(paths);
    expect(movePath(paths, -1, 0)).toBe(paths);
    expect(movePath(paths, 0, 5)).toBe(paths);
  });

  it("round-trips through storage", () => {
    const storage = fakeStorage();
    writeStoredSidebarOrder({ core: ["/files", "/chat"], plugins: ["/meet"] }, storage);
    expect(storage.getItem(SIDEBAR_ORDER_KEY)).toContain("/meet");
    expect(readStoredSidebarOrder(storage)).toEqual({
      core: ["/files", "/chat"],
      plugins: ["/meet"],
    });
  });

  it("falls back to an empty order for corrupt or partly-invalid storage", () => {
    expect(readStoredSidebarOrder(fakeStorage({ [SIDEBAR_ORDER_KEY]: "{not json" }))).toEqual(
      emptySidebarOrder(),
    );
    expect(
      readStoredSidebarOrder(
        fakeStorage({ [SIDEBAR_ORDER_KEY]: JSON.stringify({ core: ["/chat", 7], plugins: "x" }) }),
      ),
    ).toEqual({ core: ["/chat"], plugins: [] });
  });
});
