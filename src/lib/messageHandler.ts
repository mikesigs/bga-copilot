import { assembleContext } from "./context/assembleContext";
import type { RawGamedatas } from "./gameState/types";
import { maskKey } from "./maskKey";
import type {
  GetSettingsResponse,
  Message,
  SaveKeyResponse,
  SendChatMessageResponse,
  SetActiveProviderResponse,
} from "./messages";
import { hasKey, setActiveProvider, setKey, type Provider, type Settings } from "./settings";
import type { ChatSender, KeyValidator } from "./providers/types";

export interface MessageHandlerDeps {
  loadSettings: () => Promise<Settings>;
  saveSettings: (settings: Settings) => Promise<void>;
  validators: Record<Provider, KeyValidator>;
  chatSenders: Record<Provider, ChatSender>;
  extractGameState: (tabId: number) => Promise<RawGamedatas | null>;
}

export async function handleMessage(
  message: Message,
  deps: MessageHandlerDeps,
): Promise<GetSettingsResponse | SaveKeyResponse | SetActiveProviderResponse | SendChatMessageResponse> {
  switch (message.type) {
    case "GET_SETTINGS": {
      const settings = await deps.loadSettings();
      return {
        activeProvider: settings.activeProvider,
        hasKey: { anthropic: hasKey(settings, "anthropic"), openai: hasKey(settings, "openai") },
        keyPreview: {
          anthropic: settings.keys.anthropic ? maskKey(settings.keys.anthropic) : null,
          openai: settings.keys.openai ? maskKey(settings.keys.openai) : null,
        },
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

    case "SEND_CHAT_MESSAGE": {
      const settings = await deps.loadSettings();
      const provider = settings.activeProvider;
      const key = settings.keys[provider];
      if (!key) return { ok: false, error: `No API key configured for ${provider}.` };

      const gamedatas = message.tabId !== undefined ? await deps.extractGameState(message.tabId) : null;
      const contextualMessages = assembleContext({ gamedatas, history: message.messages });
      console.log("BGA Copilot: prompt sent to provider", { provider, messages: contextualMessages });

      return deps.chatSenders[provider](key, contextualMessages);
    }
  }
}
