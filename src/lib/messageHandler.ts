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
  // Used only by GET_CHAT_HISTORY to drive the panel's "is there a table
  // here" gate (#32) — waits out a timeout for `gameui.gamedatas` before
  // giving up, unlike the instant `extractGameState` above. SEND_CHAT_MESSAGE
  // deliberately keeps using the instant check: a message can only be sent
  // once the gate already passed, so re-running a multi-second wait on every
  // single send would be a bad latency trade for an already-rare case.
  waitForGamedatas: (tabId: number) => Promise<RawGamedatas | null>;
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
      if (message.tabId === undefined) return { tableId: null, status: null, messages: [] };

      // Waits out a timeout for `gameui.gamedatas` (unlike SEND_CHAT_MESSAGE's
      // instant check) so a table page that's still loading isn't mistaken
      // for "not a table at all" — see #32. `tableId: null` in the response
      // now means exactly that: the panel gates the composer on it.
      const gamedatas = await deps.waitForGamedatas(message.tabId);
      const tableId = await resolveEffectiveTableId(gamedatas, message.tabId, deps.chatPersistence);
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

      // No live game state at all — never spend an API call answering with
      // no grounding (#32). This replaces the old "soft fallback to
      // context-free chat" behavior for a real table whose extraction
      // happened to fail: silently degrading to a contextless reply is
      // exactly what made a real extraction regression invisible until a
      // user noticed the LLM giving generic answers. Failing loudly here
      // means a broken extraction shows up immediately as an error instead.
      if (!gamedatas) {
        return { ok: false, error: "No live game state available for this table.", code: "no-game-state" };
      }

      const tableId = await resolveEffectiveTableId(gamedatas, message.tabId, deps.chatPersistence);

      // Edge case distinct from the above: gamedatas was read successfully
      // but carried no table_id, and the URL fallback also couldn't resolve
      // one (e.g. gamedatas present without gameui.table_id on an
      // unrecognized/very old page shape). The panel's own gate should
      // already prevent this from being reachable, but this check never
      // trusts that alone.
      if (!tableId) return { ok: false, error: "No active Board Game Arena table found.", code: "no-table" };

      // A finished table stays chattable — a player may want to keep
      // discussing the game (a post-mortem) after it ends.
      const existing = await deps.chatPersistence.loadChatRecord(tableId);
      let record = existing ?? createChatRecord(tableId, gamedatas?.gameSlug, deps.chatPersistence.now());
      record = appendMessage(record, { role: "user", content: message.message }, deps.chatPersistence.now());
      const history = record.messages;

      const contextualMessages = assembleContext({ gamedatas, history });
      console.log("BGA Copilot: prompt sent to provider", { provider, messages: contextualMessages });

      const result = await deps.chatSenders[provider](key, contextualMessages);

      if (result.ok) {
        record = appendMessage(record, { role: "assistant", content: result.text }, deps.chatPersistence.now());
      }
      record = markFinishedIfGameEnd(record, gamedatas?.gamestate?.name);
      await deps.chatPersistence.saveChatRecord(record);

      return result;
    }
  }
}
