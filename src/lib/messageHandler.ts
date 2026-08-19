import { appendMessage, createChatRecord, markFinishedIfGameEnd } from "./chat/chatRecord";
import type { ChatRecord } from "./chat/types";
import { assembleContext } from "./context/assembleContext";
import type { RawGamedatas } from "./gameState/types";
import { maskKey } from "./maskKey";
import type {
  GetChatHistoryResponse,
  GetSettingsResponse,
  Message,
  SaveKeyResponse,
  SendChatMessageResponse,
  SetActiveProviderResponse,
} from "./messages";
import { hasKey, setActiveProvider, setKey, type Provider, type Settings } from "./settings";
import type { ChatSender, KeyValidator } from "./providers/types";

export interface ChatPersistenceDeps {
  resolveTableId: (tabId: number) => Promise<string | null>;
  loadChatRecord: (tableId: string) => Promise<ChatRecord | null>;
  saveChatRecord: (record: ChatRecord) => Promise<void>;
  now: () => number;
}

export interface MessageHandlerDeps {
  loadSettings: () => Promise<Settings>;
  saveSettings: (settings: Settings) => Promise<void>;
  validators: Record<Provider, KeyValidator>;
  chatSenders: Record<Provider, ChatSender>;
  extractGameState: (tabId: number) => Promise<RawGamedatas | null>;
  chatPersistence: ChatPersistenceDeps;
}

// `gamedatas.tableId` (from `gameui.table_id`, the spec's documented primary
// source) takes priority when available; the URL-based resolver is the
// documented fallback for before `gameui` has finished loading.
async function resolveEffectiveTableId(
  gamedatas: RawGamedatas | null,
  tabId: number | undefined,
  deps: ChatPersistenceDeps,
): Promise<string | null> {
  if (gamedatas?.tableId) return gamedatas.tableId;
  return tabId !== undefined ? deps.resolveTableId(tabId) : null;
}

export async function handleMessage(
  message: Message,
  deps: MessageHandlerDeps,
): Promise<
  GetSettingsResponse | SaveKeyResponse | SetActiveProviderResponse | GetChatHistoryResponse | SendChatMessageResponse
> {
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

    case "GET_CHAT_HISTORY": {
      const tableId = message.tabId !== undefined ? await deps.chatPersistence.resolveTableId(message.tabId) : null;
      if (!tableId) return { tableId: null, status: null, messages: [] };

      const record = await deps.chatPersistence.loadChatRecord(tableId);
      return { tableId, status: record?.status ?? null, messages: record?.messages ?? [] };
    }

    case "SEND_CHAT_MESSAGE": {
      const settings = await deps.loadSettings();
      const provider = settings.activeProvider;
      const key = settings.keys[provider];
      if (!key) return { ok: false, error: `No API key configured for ${provider}.` };

      const gamedatas = message.tabId !== undefined ? await deps.extractGameState(message.tabId) : null;
      const tableId = await resolveEffectiveTableId(gamedatas, message.tabId, deps.chatPersistence);

      // Persisted history is the source of truth for a recognized table; an
      // unresolvable table (not on a BGA table page) falls back to a
      // single-turn, unpersisted exchange rather than failing.
      // A finished table stays chattable — a player may want to keep
      // discussing the game (a post-mortem) after it ends.
      let record: ChatRecord | null = null;
      if (tableId) {
        const existing = await deps.chatPersistence.loadChatRecord(tableId);
        record = existing ?? createChatRecord(tableId, gamedatas?.gameSlug, deps.chatPersistence.now());
        record = appendMessage(record, { role: "user", content: message.message }, deps.chatPersistence.now());
      }
      const history = record?.messages ?? [{ role: "user" as const, content: message.message }];

      const contextualMessages = assembleContext({ gamedatas, history });
      console.log("BGA Copilot: prompt sent to provider", { provider, messages: contextualMessages });

      const result = await deps.chatSenders[provider](key, contextualMessages);

      if (record) {
        if (result.ok) {
          record = appendMessage(record, { role: "assistant", content: result.text }, deps.chatPersistence.now());
        }
        record = markFinishedIfGameEnd(record, gamedatas?.gamestate?.name);
        await deps.chatPersistence.saveChatRecord(record);
      }

      return result;
    }
  }
}
