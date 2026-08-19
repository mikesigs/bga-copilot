import { isBgaUrl } from "../isBgaUrl";

/**
 * The URL's `table=` query param — documented in the parent spec as the
 * fallback identifier before `gameui` finishes loading. Used as the sole
 * source here (rather than also reading `gameui.table_id`) since it's
 * already reliably present on every BGA table URL and needs no MAIN-world
 * script injection to reach.
 */
export function getTableIdFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).searchParams.get("table");
  } catch {
    return null;
  }
}

export async function resolveTableId(tabId: number): Promise<string | null> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isBgaUrl(tab.url)) return null;
    return getTableIdFromUrl(tab.url);
  } catch (error) {
    console.error("BGA Copilot: table-id resolution failed", error);
    return null;
  }
}
