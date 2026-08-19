import { isBgaUrl } from "../isBgaUrl";
import type { RawGamedatas } from "./types";

// Reads `window.gameui.gamedatas` from whichever frame of the tab has it —
// the live game runs inside `<iframe id="gameIframe">` on a BGA table page,
// not the top-level document, and its exact frameId isn't known in advance.
// Injected in MAIN world (the page's real JS context, not the extension's
// isolated world) since `gameui` is a page global. JSON round-tripping inside
// the injected function keeps the result structured-clone-safe regardless of
// what shape `gamedatas` actually is.
export function readGamedatasJson(): string | null {
  const gameui = (
    window as unknown as {
      gameui?: {
        gamedatas?: unknown;
        player_id?: unknown;
        game_name_displayed?: unknown;
        game_name?: unknown;
        table_id?: unknown;
      };
    }
  ).gameui;
  if (!gameui?.gamedatas) return null;

  // `player_id`, `game_name_displayed`, `game_name`, and `table_id` are
  // siblings of `gamedatas` on `gameui`, not fields within it. Bundled onto
  // the returned object here since extraction and summarizing/persisting all
  // treat "the current game-state snapshot" as one value. `table_id` is the
  // spec's documented primary source for chat-persistence keying, ahead of
  // the URL's `table=` query param (a fallback for before `gameui` loads).
  return JSON.stringify({
    ...gameui.gamedatas,
    viewerPlayerId: gameui.player_id !== undefined ? String(gameui.player_id) : undefined,
    gameName: gameui.game_name_displayed,
    gameSlug: gameui.game_name,
    tableId: gameui.table_id !== undefined ? String(gameui.table_id) : undefined,
  });
}

/**
 * Extracts the current game's `gamedatas` for a tab, or null if it can't be
 * found (no game iframe, `gameui` not yet loaded, or any other failure) —
 * callers fall back to context-free chat rather than treating this as fatal.
 * Always re-runs from scratch; never caches a prior extraction.
 */
export async function extractGameState(tabId: number): Promise<RawGamedatas | null> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isBgaUrl(tab.url)) return null;

    // `allFrames: true` rather than targeting the `#gameIframe` frameId
    // specifically (as issue #3's research recommends): the frameId isn't
    // known without either a content-script relay or a webNavigation lookup,
    // and scanning every frame's result for the first non-null one is a
    // simpler generic-core-only trade-off. The isBgaUrl check above already
    // scopes this to the extension's own host_permissions, so the search is
    // never broader than one BGA table's own frames.
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: "MAIN",
      func: readGamedatasJson,
    });

    for (const { result } of results) {
      if (typeof result === "string") return JSON.parse(result) as RawGamedatas;
    }
    return null;
  } catch (error) {
    console.error("BGA Copilot: game-state extraction failed", error);
    return null;
  }
}
