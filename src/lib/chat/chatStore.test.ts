import { afterEach, describe, expect, it, vi } from "vitest";
import { loadChatRecord, saveChatRecord, sweepExpiredChatRecords, TTL_MS } from "./chatStore";
import type { ChatRecord } from "./types";

function record(overrides: Partial<ChatRecord> = {}): ChatRecord {
  return {
    tableId: "12345",
    gameSlug: "arknova",
    status: "active",
    createdAt: 1000,
    lastActiveAt: 1000,
    messages: [],
    cachedRulebookExcerpt: null,
    ...overrides,
  };
}

function mockChromeStorage(initial: Record<string, unknown> = {}): { store: Record<string, unknown> } {
  const store = { ...initial };
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: vi.fn(async (keys: unknown) => {
          if (keys === null || keys === undefined) return { ...store };
          const keyList = Array.isArray(keys) ? keys : [keys as string];
          return Object.fromEntries(keyList.filter((k) => k in store).map((k) => [k, store[k]]));
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(store, items);
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key];
        }),
      },
    },
  };
  return { store };
}

describe("loadChatRecord / saveChatRecord", () => {
  afterEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it("returns null for a table with no saved record", async () => {
    mockChromeStorage();
    expect(await loadChatRecord("12345")).toBeNull();
  });

  it("round-trips a saved record", async () => {
    mockChromeStorage();
    const original = record();

    await saveChatRecord(original);
    const loaded = await loadChatRecord("12345");

    expect(loaded).toEqual(original);
  });

  it("keeps two different tables' records separate", async () => {
    mockChromeStorage();
    await saveChatRecord(record({ tableId: "111", gameSlug: "arknova" }));
    await saveChatRecord(record({ tableId: "222", gameSlug: "tickettoride" }));

    expect((await loadChatRecord("111"))?.gameSlug).toBe("arknova");
    expect((await loadChatRecord("222"))?.gameSlug).toBe("tickettoride");
  });
});

describe("sweepExpiredChatRecords", () => {
  afterEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it("removes records whose lastActiveAt is past the TTL, regardless of status", async () => {
    const { store } = mockChromeStorage();
    await saveChatRecord(record({ tableId: "stale-active", status: "active", lastActiveAt: 0 }));
    await saveChatRecord(record({ tableId: "stale-finished", status: "finished", lastActiveAt: 0 }));
    await saveChatRecord(record({ tableId: "fresh", lastActiveAt: 1000 }));

    await sweepExpiredChatRecords(TTL_MS + 1000);

    expect(await loadChatRecord("stale-active")).toBeNull();
    expect(await loadChatRecord("stale-finished")).toBeNull();
    expect(await loadChatRecord("fresh")).not.toBeNull();
    // Only chat records are touched, never unrelated storage keys.
    expect(Object.keys(store)).toEqual(expect.arrayContaining([expect.stringContaining("fresh")]));
  });

  it("does nothing when every record is within the TTL", async () => {
    mockChromeStorage();
    await saveChatRecord(record({ tableId: "12345", lastActiveAt: 1000 }));

    await sweepExpiredChatRecords(1000 + TTL_MS - 1);

    expect(await loadChatRecord("12345")).not.toBeNull();
  });

  it("never touches storage keys outside its own chat-record namespace", async () => {
    const { store } = mockChromeStorage({ bga_copilot_settings: { activeProvider: "anthropic" } });
    await saveChatRecord(record({ tableId: "stale", lastActiveAt: 0 }));

    await sweepExpiredChatRecords(TTL_MS + 1000);

    expect(store.bga_copilot_settings).toEqual({ activeProvider: "anthropic" });
  });
});
