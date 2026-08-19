import type { ChatRecord } from "./types";

const STORAGE_PREFIX = "bga_copilot_chat_";

// Suggested figure from the parent spec — a backstop for tables that never
// reach `gameEnd`, not a precision requirement.
export const TTL_MS = 90 * 24 * 60 * 60 * 1000;

function storageKey(tableId: string): string {
  return `${STORAGE_PREFIX}${tableId}`;
}

export async function loadChatRecord(tableId: string): Promise<ChatRecord | null> {
  const key = storageKey(tableId);
  const result = await chrome.storage.local.get(key);
  return (result[key] as ChatRecord | undefined) ?? null;
}

export async function saveChatRecord(record: ChatRecord): Promise<void> {
  await chrome.storage.local.set({ [storageKey(record.tableId)]: record });
}

/**
 * Removes chat records whose `lastActiveAt` is older than the TTL,
 * regardless of `status` — a backstop for tables that never reach
 * `gameEnd`. Scoped to this module's own storage-key prefix so it never
 * touches unrelated stored data (settings, etc).
 */
export async function sweepExpiredChatRecords(now: number, ttlMs: number = TTL_MS): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const expiredKeys = Object.entries(all)
    .filter(([key]) => key.startsWith(STORAGE_PREFIX))
    .filter(([, value]) => now - (value as ChatRecord).lastActiveAt > ttlMs)
    .map(([key]) => key);

  if (expiredKeys.length > 0) await chrome.storage.local.remove(expiredKeys);
}
