import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as extractModule from "./extract";
import { waitForGamedatas } from "./waitForGamedatas";

const BGA_TAB = { url: "https://boardgamearena.com/table?table=123" };
const NON_BGA_TAB = { url: "https://example.com/" };

function mockChrome(tab: { url: string }): void {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    tabs: { get: vi.fn(async () => tab) },
  };
}

describe("waitForGamedatas", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it("returns immediately without polling when the tab isn't a BGA URL", async () => {
    mockChrome(NON_BGA_TAB);
    const extractGameState = vi.spyOn(extractModule, "extractGameState");

    const result = await waitForGamedatas(42, 3000);

    expect(result).toBeNull();
    expect(extractGameState).not.toHaveBeenCalled();
  });

  it("returns gamedatas immediately once available, without waiting out the full timeout", async () => {
    mockChrome(BGA_TAB);
    vi.spyOn(extractModule, "extractGameState").mockResolvedValue({ gamestate: { name: "playerTurn" } });

    const result = await waitForGamedatas(42, 3000);

    expect(result).toEqual({ gamestate: { name: "playerTurn" } });
  });

  it("keeps polling until gamedatas appears, then returns it", async () => {
    mockChrome(BGA_TAB);
    const extractGameState = vi
      .spyOn(extractModule, "extractGameState")
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ gamestate: { name: "playerTurn" } });

    const resultPromise = waitForGamedatas(42, 3000);
    await vi.runAllTimersAsync();

    expect(await resultPromise).toEqual({ gamestate: { name: "playerTurn" } });
    expect(extractGameState).toHaveBeenCalledTimes(3);
  });

  it("gives up and returns null once the timeout elapses with gamedatas never appearing", async () => {
    mockChrome(BGA_TAB);
    vi.spyOn(extractModule, "extractGameState").mockResolvedValue(null);

    const resultPromise = waitForGamedatas(42, 3000);
    await vi.runAllTimersAsync();

    expect(await resultPromise).toBeNull();
  });

  describe("concurrent calls for the same tab", () => {
    // Confirmed live (2026-08-25): the panel's onActivated/onUpdated
    // listeners can both fire for one tab-focus event, each independently
    // calling GET_CHAT_HISTORY. Before gamedatas polling existed that was
    // harmless (an instant URL read); left undeduplicated, it means two
    // polling loops repeatedly injecting a script into the same live tab at
    // once — which reliably starved out gamedatas for the SEND_CHAT_MESSAGE
    // extraction that followed. This is the regression test for that.
    it("shares one poll across concurrent callers for the same tab, rather than starting a second", async () => {
      mockChrome(BGA_TAB);
      const extractGameState = vi
        .spyOn(extractModule, "extractGameState")
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ gamestate: { name: "playerTurn" } });

      const first = waitForGamedatas(42, 3000);
      const second = waitForGamedatas(42, 3000);
      await vi.runAllTimersAsync();

      expect(await first).toEqual({ gamestate: { name: "playerTurn" } });
      expect(await second).toEqual({ gamestate: { name: "playerTurn" } });
      expect(extractGameState).toHaveBeenCalledTimes(2);
    });

    it("does not share a poll across different tabs", async () => {
      mockChrome(BGA_TAB);
      vi.spyOn(extractModule, "extractGameState").mockResolvedValue({ gamestate: { name: "playerTurn" } });

      await Promise.all([waitForGamedatas(1, 3000), waitForGamedatas(2, 3000)]);

      expect(extractModule.extractGameState).toHaveBeenCalledWith(1);
      expect(extractModule.extractGameState).toHaveBeenCalledWith(2);
    });

    it("starts a fresh poll for the same tab once the prior one has completed", async () => {
      mockChrome(BGA_TAB);
      const extractGameState = vi
        .spyOn(extractModule, "extractGameState")
        .mockResolvedValueOnce({ gamestate: { name: "playerTurn" } })
        .mockResolvedValueOnce({ gamestate: { name: "gameEnd" } });

      const first = await waitForGamedatas(42, 3000);
      const second = await waitForGamedatas(42, 3000);

      expect(first).toEqual({ gamestate: { name: "playerTurn" } });
      expect(second).toEqual({ gamestate: { name: "gameEnd" } });
      expect(extractGameState).toHaveBeenCalledTimes(2);
    });
  });
});
