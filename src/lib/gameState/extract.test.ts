import { afterEach, describe, expect, it, vi } from "vitest";
import { extractGameState } from "./extract";

const BGA_TAB = { url: "https://boardgamearena.com/table?table=123" };

function mockChrome(options: {
  tabUrl?: string;
  executeScript?: (...args: unknown[]) => unknown;
}): ReturnType<typeof vi.fn> {
  const executeScript = vi.fn(options.executeScript ?? (() => Promise.resolve([{ frameId: 0, result: null }])));
  (globalThis as unknown as { chrome: unknown }).chrome = {
    tabs: { get: vi.fn(async () => ({ url: options.tabUrl ?? BGA_TAB.url })) },
    scripting: { executeScript },
  };
  return executeScript;
}

describe("extractGameState", () => {
  afterEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it("targets all frames of the tab in the MAIN world", async () => {
    const executeScript = mockChrome({});

    await extractGameState(42);

    expect(executeScript).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { tabId: 42, allFrames: true },
        world: "MAIN",
      }),
    );
  });

  it("parses the JSON gamedatas string from whichever frame returned one", async () => {
    mockChrome({
      executeScript: () =>
        Promise.resolve([
          { frameId: 0, result: null },
          { frameId: 1, result: JSON.stringify({ gamestate: { name: "playerTurn" } }) },
        ]),
    });

    const result = await extractGameState(42);
    expect(result).toEqual({ gamestate: { name: "playerTurn" } });
  });

  it("returns null when no frame has a result (no gameui found in any frame)", async () => {
    mockChrome({});

    expect(await extractGameState(42)).toBeNull();
  });

  it("returns null instead of throwing when executeScript itself rejects", async () => {
    mockChrome({ executeScript: () => Promise.reject(new Error("no such tab")) });

    expect(await extractGameState(42)).toBeNull();
  });

  it("skips injection entirely for a tab that isn't a BGA page", async () => {
    const executeScript = mockChrome({ tabUrl: "https://example.com/" });

    expect(await extractGameState(42)).toBeNull();
    expect(executeScript).not.toHaveBeenCalled();
  });

  it("returns null instead of throwing when the tab itself can't be found", async () => {
    (globalThis as unknown as { chrome: unknown }).chrome = {
      tabs: { get: vi.fn().mockRejectedValue(new Error("no such tab")) },
      scripting: { executeScript: vi.fn() },
    };

    expect(await extractGameState(42)).toBeNull();
  });
});
