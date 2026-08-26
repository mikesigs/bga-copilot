import { isBgaUrl } from "../isBgaUrl";
import { extractGameState } from "./extract";
import type { RawGamedatas } from "./types";

// First-pass figure per issue #32 — expected to need tuning once real usage
// data exists, so it's a named export rather than inlined at the call site.
export const GAMEDATAS_WAIT_TIMEOUT_MS = 3000;
const POLL_INTERVAL_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollForGamedatas(tabId: number, timeoutMs: number): Promise<RawGamedatas | null> {
  let tabUrl: string | undefined;
  try {
    tabUrl = (await chrome.tabs.get(tabId)).url;
  } catch (error) {
    console.error("BGA Copilot: gamedatas wait failed to read tab", error);
    return null;
  }
  if (!isBgaUrl(tabUrl)) return null;

  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const gamedatas = await extractGameState(tabId);
    if (gamedatas) return gamedatas;
    if (Date.now() >= deadline) return null;
    await sleep(POLL_INTERVAL_MS);
  }
}

// Keyed by tabId — the panel's own `onActivated`/`onUpdated` listeners can
// both fire for a single tab-focus event, and each independently calls
// GET_CHAT_HISTORY. Before this wait existed that was harmless (the old
// check was one instant URL read); left undeduplicated here, it means two
// polling loops repeatedly firing `chrome.scripting.executeScript` into the
// same live tab at once — confirmed live (2026-08-25) to reliably starve out
// gamedatas for the SEND_CHAT_MESSAGE extraction that follows shortly after.
// Sharing one in-flight poll per tab keeps script-injection traffic into any
// given tab to at most one call at a time, regardless of how many callers ask.
const inFlight = new Map<number, Promise<RawGamedatas | null>>();

/**
 * Polls for `gameui.gamedatas` up to `timeoutMs` before giving up, so a table
 * page whose game script is still loading isn't mistaken for "not a table at
 * all" — a single `extractGameState` call would see the same `null` either
 * way. Short-circuits immediately (no polling) when the tab isn't a BGA URL,
 * since only a genuine BGA table page can ever produce `gamedatas`.
 */
export function waitForGamedatas(
  tabId: number,
  timeoutMs: number = GAMEDATAS_WAIT_TIMEOUT_MS,
): Promise<RawGamedatas | null> {
  const existing = inFlight.get(tabId);
  if (existing) return existing;

  const poll = pollForGamedatas(tabId, timeoutMs).finally(() => {
    inFlight.delete(tabId);
  });
  inFlight.set(tabId, poll);
  return poll;
}
