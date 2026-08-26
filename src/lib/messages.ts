import type { ChatMessageRecord, ChatStatus } from "./chat/types";
import type { Provider } from "./settings";

export type Message =
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_KEY"; provider: Provider; key: string }
  | { type: "SET_ACTIVE_PROVIDER"; provider: Provider }
  // tabId identifies which BGA table's persisted chat history to load —
  // omitted (or unresolvable, after waiting out GAMEDATAS_WAIT_TIMEOUT_MS for
  // gameui.gamedatas to appear) means there's no recognizable table: no
  // persisted history exists, and per #32 the panel gates the composer.
  | { type: "GET_CHAT_HISTORY"; tabId?: number }
  // tabId identifies which BGA tab's game state to extract as context, and
  // which table's persisted history this message belongs to. No live
  // gamedatas (no table at all, or a real table whose extraction failed) is
  // rejected with a "no-game-state" error rather than falling back to a
  // context-free LLM call — silently degrading was what made a real
  // extraction bug invisible until the LLM's answers were noticed to be
  // generic (per #32). An unresolvable tableId despite live gamedatas is the
  // narrower "no-table" case. Either way, the panel's own gate should
  // already prevent this from being reachable, but the background handler
  // never trusts that alone.
  | { type: "SEND_CHAT_MESSAGE"; message: string; tabId?: number };

export interface GetSettingsResponse {
  activeProvider: Provider;
  hasKey: Record<Provider, boolean>;
  // Masked preview (e.g. "sk-...vaMA") for display — never the real key.
  keyPreview: Record<Provider, string | null>;
}

export type SaveKeyResponse = { ok: true } | { ok: false; error: string };

export interface SetActiveProviderResponse {
  ok: true;
}

export interface GetChatHistoryResponse {
  // null when the active tab isn't a recognizable BGA table — chat still
  // works, it just isn't persisted.
  tableId: string | null;
  status: ChatStatus | null;
  messages: ChatMessageRecord[];
}

export type SendChatMessageResponse =
  | { ok: true; text: string }
  | { ok: false; error: string; code?: "no-table" | "no-game-state" };
