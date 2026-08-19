import type { ChatMessageRecord, ChatStatus } from "./chat/types";
import type { Provider } from "./settings";

export type Message =
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_KEY"; provider: Provider; key: string }
  | { type: "SET_ACTIVE_PROVIDER"; provider: Provider }
  // tabId identifies which BGA table's persisted chat history to load —
  // omitted (or unresolvable) means no persisted history (not on a
  // recognizable BGA table).
  | { type: "GET_CHAT_HISTORY"; tabId?: number }
  // tabId identifies which BGA tab's game state to extract as context, and
  // which table's persisted history this message belongs to — omitted (or
  // unresolvable) falls back to context-free, unpersisted chat rather than
  // failing.
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

export type SendChatMessageResponse = { ok: true; text: string } | { ok: false; error: string };
