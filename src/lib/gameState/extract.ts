import { isBgaUrl } from "../isBgaUrl";
import type { RawGamedatas } from "./types";

// Reads `window.gameui.gamedatas` from whichever frame of the tab has it —
// the live game runs inside `<iframe id="gameIframe">` on a BGA table page,
// not the top-level document, and its exact frameId isn't known in advance.
// Injected in MAIN world (the page's real JS context, not the extension's
// isolated world) since `gameui` is a page global. JSON round-tripping inside
// the injected function keeps the result structured-clone-safe regardless of
// what shape `gamedatas` actually is.
// `gameui.scoreCtrl` is BGA's shared animated-score-counter framework
// widget (one Counter per player, keyed by player id) — confirmed live that
// it stays genuinely up to date via BGA's own notification handling, unlike
// `gamedatas.players[id].score` which is a load-time snapshot never patched
// in place as a game progresses. Defensive about shape since it's an
// internal BGA implementation detail, not documented API.
function readLiveScores(scoreCtrl: unknown): Record<string, number> | undefined {
  if (!scoreCtrl || typeof scoreCtrl !== "object") return undefined;

  const liveScores: Record<string, number> = {};
  for (const [id, counter] of Object.entries(scoreCtrl as Record<string, unknown>)) {
    const getValue = (counter as { getValue?: unknown } | null)?.getValue;
    if (typeof getValue === "function") liveScores[id] = getValue.call(counter);
  }
  return Object.keys(liveScores).length > 0 ? liveScores : undefined;
}

export function readGamedatasJson(): string | null {
  const gameui = (
    window as unknown as {
      gameui?: {
        gamedatas?: unknown;
        player_id?: unknown;
        game_name_displayed?: unknown;
        game_name?: unknown;
        table_id?: unknown;
        scoreCtrl?: unknown;
      };
    }
  ).gameui;
  if (!gameui?.gamedatas) return null;

  // `player_id`, `game_name_displayed`, `game_name`, `table_id`, and
  // `scoreCtrl` are siblings of `gamedatas` on `gameui`, not fields within
  // it. Bundled onto the returned object here since extraction and
  // summarizing/persisting all treat "the current game-state snapshot" as
  // one value. `table_id` is the spec's documented primary source for
  // chat-persistence keying, ahead of the URL's `table=` query param (a
  // fallback for before `gameui` loads).
  return JSON.stringify({
    ...gameui.gamedatas,
    viewerPlayerId: gameui.player_id !== undefined ? String(gameui.player_id) : undefined,
    gameName: gameui.game_name_displayed,
    gameSlug: gameui.game_name,
    tableId: gameui.table_id !== undefined ? String(gameui.table_id) : undefined,
    liveScores: readLiveScores(gameui.scoreCtrl),
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
