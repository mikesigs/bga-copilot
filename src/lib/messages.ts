import type { Provider } from "./settings";

export type Message =
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_KEY"; provider: Provider; key: string }
  | { type: "SET_ACTIVE_PROVIDER"; provider: Provider };

export interface GetSettingsResponse {
  activeProvider: Provider;
  hasKey: Record<Provider, boolean>;
}

export type SaveKeyResponse = { ok: true } | { ok: false; error: string };

export interface SetActiveProviderResponse {
  ok: true;
}
