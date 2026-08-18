import type { GetSettingsResponse, Message, SaveKeyResponse, SetActiveProviderResponse } from "./messages";
import { hasKey, setActiveProvider, setKey, type Provider, type Settings } from "./settings";
import type { KeyValidator } from "./providers/types";

export interface MessageHandlerDeps {
  loadSettings: () => Promise<Settings>;
  saveSettings: (settings: Settings) => Promise<void>;
  validators: Record<Provider, KeyValidator>;
}

export async function handleMessage(
  message: Message,
  deps: MessageHandlerDeps,
): Promise<GetSettingsResponse | SaveKeyResponse | SetActiveProviderResponse> {
  switch (message.type) {
    case "GET_SETTINGS": {
      const settings = await deps.loadSettings();
      return {
        activeProvider: settings.activeProvider,
        hasKey: { anthropic: hasKey(settings, "anthropic"), openai: hasKey(settings, "openai") },
      };
    }

    case "SAVE_KEY": {
      const result = await deps.validators[message.provider](message.key);
      if (!result.ok) return result;

      const settings = await deps.loadSettings();
      await deps.saveSettings(setKey(settings, message.provider, message.key));
      return { ok: true };
    }

    case "SET_ACTIVE_PROVIDER": {
      const settings = await deps.loadSettings();
      await deps.saveSettings(setActiveProvider(settings, message.provider));
      return { ok: true };
    }
  }
}
