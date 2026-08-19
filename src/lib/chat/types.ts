export interface ChatMessageRecord {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export type ChatStatus = "active" | "finished";

// One record per BGA table, keyed by tableId (per the parent spec's Chat
// persistence decision). Live game-state snapshots are never persisted here
// — always re-extracted fresh (see src/lib/gameState).
export interface ChatRecord {
  tableId: string;
  gameSlug?: string;
  status: ChatStatus;
  createdAt: number;
  lastActiveAt: number;
  messages: ChatMessageRecord[];
  // Populated by a later ticket (manual rulebook upload / discovery) — always
  // null for now.
  cachedRulebookExcerpt: null;
}
