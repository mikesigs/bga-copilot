import { afterEach, describe, expect, it, vi } from "vitest";
import { getTableIdFromUrl, resolveTableId } from "./tableId";

describe("getTableIdFromUrl", () => {
  it("extracts the table query param from a BGA table URL", () => {
    expect(getTableIdFromUrl("https://boardgamearena.com/table?table=900372479")).toBe("900372479");
  });

  it("returns null when there's no table param", () => {
    expect(getTableIdFromUrl("https://boardgamearena.com/lobby")).toBeNull();
  });

  it("returns null for an unparseable URL, without throwing", () => {
    expect(() => getTableIdFromUrl("not a url")).not.toThrow();
    expect(getTableIdFromUrl("not a url")).toBeNull();
  });

  it("returns null when the url is undefined", () => {
    expect(getTableIdFromUrl(undefined)).toBeNull();
  });
});

describe("resolveTableId", () => {
  afterEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it("resolves the table id from the tab's current URL", async () => {
    (globalThis as unknown as { chrome: unknown }).chrome = {
      tabs: { get: vi.fn(async () => ({ url: "https://boardgamearena.com/table?table=900372479" })) },
    };

    expect(await resolveTableId(42)).toBe("900372479");
  });

  it("returns null for a non-BGA tab", async () => {
    (globalThis as unknown as { chrome: unknown }).chrome = {
      tabs: { get: vi.fn(async () => ({ url: "https://example.com/" })) },
    };

    expect(await resolveTableId(42)).toBeNull();
  });

  it("returns null instead of throwing when the tab can't be found", async () => {
    (globalThis as unknown as { chrome: unknown }).chrome = {
      tabs: { get: vi.fn().mockRejectedValue(new Error("no such tab")) },
    };

    expect(await resolveTableId(42)).toBeNull();
  });
});
