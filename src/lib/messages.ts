import type { ChatMessage } from "./providers/types";
import type { Provider } from "./settings";

export type Message =
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_KEY"; provider: Provider; key: string }
  | { type: "SET_ACTIVE_PROVIDER"; provider: Provider }
  | { type: "SEND_CHAT_MESSAGE"; messages: ChatMessage[] };

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

export type SendChatMessageResponse = { ok: true; text: string } | { ok: false; error: string };
