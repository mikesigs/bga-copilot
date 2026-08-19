import type { ChatMessageRecord, ChatRecord } from "./types";

export function createChatRecord(tableId: string, gameSlug: string | undefined, now: number): ChatRecord {
  return {
    tableId,
    gameSlug,
    status: "active",
    createdAt: now,
    lastActiveAt: now,
    messages: [],
    cachedRulebookExcerpt: null,
  };
}

export function appendMessage(
  record: ChatRecord,
  message: Pick<ChatMessageRecord, "role" | "content">,
  now: number,
): ChatRecord {
  return {
    ...record,
    messages: [...record.messages, { ...message, timestamp: now }],
    lastActiveAt: now,
  };
}

/**
 * `gameEnd` is a standard BGA framework state name (not authored per-game),
 * so this needs no per-game knowledge. Once finished, a record stays
 * finished — a later state name (e.g. a stale re-extraction race) never
 * un-finishes it.
 */
export function markFinishedIfGameEnd(record: ChatRecord, gamestateName: string | undefined): ChatRecord {
  if (record.status === "finished") return record;
  if (gamestateName !== "gameEnd") return record;
  return { ...record, status: "finished" };
}
