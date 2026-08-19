import { describe, expect, it, vi } from "vitest";
import type { ChatRecord } from "./chat/types";
import { handleMessage, type ChatPersistenceDeps, type MessageHandlerDeps } from "./messageHandler";
import { defaultSettings, setKey, type Settings } from "./settings";

function makeChatPersistence(overrides: Partial<ChatPersistenceDeps> = {}): ChatPersistenceDeps {
  const chatRecords = new Map<string, ChatRecord>();
  let clock = 1000;

  return {
    resolveTableId: vi.fn(async () => null),
    loadChatRecord: vi.fn(async (tableId: string) => chatRecords.get(tableId) ?? null),
    saveChatRecord: vi.fn(async (record: ChatRecord) => {
      chatRecords.set(record.tableId, record);
    }),
    now: vi.fn(() => clock++),
    ...overrides,
  };
}

function makeDeps(
  initial: Settings,
  overrides: Partial<Omit<MessageHandlerDeps, "chatPersistence">> & { chatPersistence?: Partial<ChatPersistenceDeps> } = {},
): MessageHandlerDeps {
  let stored = initial;
  const { chatPersistence: chatPersistenceOverrides, ...rest } = overrides;

  return {
    loadSettings: vi.fn(async () => stored),
    saveSettings: vi.fn(async (next: Settings) => {
      stored = next;
    }),
    validators: {
      anthropic: vi.fn(async () => ({ ok: true }) as const),
      openai: vi.fn(async () => ({ ok: true }) as const),
    },
    chatSenders: {
      anthropic: vi.fn(async () => ({ ok: true, text: "anthropic reply" }) as const),
      openai: vi.fn(async () => ({ ok: true, text: "openai reply" }) as const),
    },
    extractGameState: vi.fn(async () => null),
    chatPersistence: makeChatPersistence(chatPersistenceOverrides),
    ...rest,
  };
}

describe("handleMessage", () => {
  it("GET_SETTINGS reports the active provider, which providers have keys, and a masked preview — never the raw key", async () => {
    const settings = setKey(defaultSettings(), "anthropic", "sk-ant-secretvalue");
    const deps = makeDeps(settings);

    const response = await handleMessage({ type: "GET_SETTINGS" }, deps);

    expect(response).toEqual({
      activeProvider: "anthropic",
      hasKey: { anthropic: true, openai: false },
      keyPreview: { anthropic: "sk-...alue", openai: null },
    });
  });

  it("SAVE_KEY validates before persisting, and merges rather than replacing the whole key set", async () => {
    const settings = setKey(defaultSettings(), "openai", "sk-oai-existing");
    const deps = makeDeps(settings);

    const response = await handleMessage({ type: "SAVE_KEY", provider: "anthropic", key: "sk-ant-new" }, deps);

    expect(response).toEqual({ ok: true });
    expect(deps.validators.anthropic).toHaveBeenCalledWith("sk-ant-new");
    const saved = await deps.loadSettings();
    expect(saved.keys).toEqual({ openai: "sk-oai-existing", anthropic: "sk-ant-new" });
  });

  it("SAVE_KEY does not persist an invalid key", async () => {
    const deps = makeDeps(defaultSettings(), {
      validators: {
        anthropic: vi.fn(async () => ({ ok: false, error: "Invalid API key." }) as const),
        openai: vi.fn(async () => ({ ok: true }) as const),
      },
    });

    const response = await handleMessage({ type: "SAVE_KEY", provider: "anthropic", key: "bad-key" }, deps);

    expect(response).toEqual({ ok: false, error: "Invalid API key." });
    expect(deps.saveSettings).not.toHaveBeenCalled();
  });

  it("SET_ACTIVE_PROVIDER switches the active provider without touching saved keys", async () => {
    const settings = setKey(setKey(defaultSettings(), "anthropic", "sk-ant-abc"), "openai", "sk-oai-xyz");
    const deps = makeDeps(settings);

    const response = await handleMessage({ type: "SET_ACTIVE_PROVIDER", provider: "openai" }, deps);

    expect(response).toEqual({ ok: true });
    const saved = await deps.loadSettings();
    expect(saved.activeProvider).toBe("openai");
    expect(saved.keys).toEqual({ anthropic: "sk-ant-abc", openai: "sk-oai-xyz" });
  });
});

describe("handleMessage GET_CHAT_HISTORY", () => {
  it("returns no persisted history when the tab isn't a recognizable BGA table", async () => {
    const deps = makeDeps(defaultSettings());

    const response = await handleMessage({ type: "GET_CHAT_HISTORY", tabId: 7 }, deps);

    expect(response).toEqual({ tableId: null, status: null, messages: [] });
  });

  it("returns no persisted history when no tabId is given", async () => {
    const deps = makeDeps(defaultSettings(), { chatPersistence: { resolveTableId: vi.fn(async () => "12345") } });

    const response = await handleMessage({ type: "GET_CHAT_HISTORY" }, deps);

    expect(response).toEqual({ tableId: null, status: null, messages: [] });
    expect(deps.chatPersistence.resolveTableId).not.toHaveBeenCalled();
  });

  it("returns tableId with an empty message list and null status when the table has no saved record yet", async () => {
    const deps = makeDeps(defaultSettings(), { chatPersistence: { resolveTableId: vi.fn(async () => "12345") } });

    const response = await handleMessage({ type: "GET_CHAT_HISTORY", tabId: 7 }, deps);

    expect(response).toEqual({ tableId: "12345", status: null, messages: [] });
  });

  it("restores a previously saved record's messages and status", async () => {
    const deps = makeDeps(defaultSettings(), { chatPersistence: { resolveTableId: vi.fn(async () => "12345") } });
    await deps.chatPersistence.saveChatRecord({
      tableId: "12345",
      status: "finished",
      createdAt: 1,
      lastActiveAt: 2,
      messages: [{ role: "user", content: "hi", timestamp: 1 }],
      cachedRulebookExcerpt: null,
    });

    const response = await handleMessage({ type: "GET_CHAT_HISTORY", tabId: 7 }, deps);

    expect(response).toEqual({
      tableId: "12345",
      status: "finished",
      messages: [{ role: "user", content: "hi", timestamp: 1 }],
    });
  });
});

describe("handleMessage SEND_CHAT_MESSAGE", () => {
  it("sends the new message (prefixed with an assembled system prompt) to the active provider's chat sender using its stored key", async () => {
    const settings = setKey(defaultSettings(), "anthropic", "sk-ant-abc");
    const deps = makeDeps(settings);

    const response = await handleMessage({ type: "SEND_CHAT_MESSAGE", message: "hello" }, deps);

    expect(deps.chatSenders.anthropic).toHaveBeenCalledWith("sk-ant-abc", [
      expect.objectContaining({ role: "system" }),
      { role: "user", content: "hello" },
    ]);
    expect(response).toEqual({ ok: true, text: "anthropic reply" });
  });

  it("returns an error without calling the provider when no key is configured", async () => {
    const deps = makeDeps(defaultSettings());

    const response = await handleMessage({ type: "SEND_CHAT_MESSAGE", message: "hello" }, deps);

    expect(response).toEqual({ ok: false, error: "No API key configured for anthropic." });
    expect(deps.chatSenders.anthropic).not.toHaveBeenCalled();
  });

  it("surfaces a provider error instead of throwing", async () => {
    const settings = setKey(defaultSettings(), "anthropic", "sk-ant-abc");
    const deps = makeDeps(settings, {
      chatSenders: {
        anthropic: vi.fn(async () => ({ ok: false, error: "Could not reach Anthropic: network down" }) as const),
        openai: vi.fn(async () => ({ ok: true, text: "openai reply" }) as const),
      },
    });

    const response = await handleMessage({ type: "SEND_CHAT_MESSAGE", message: "hello" }, deps);

    expect(response).toEqual({ ok: false, error: "Could not reach Anthropic: network down" });
  });

  it("extracts game state for the given tabId and folds it into the system prompt sent to the provider", async () => {
    const settings = setKey(defaultSettings(), "anthropic", "sk-ant-abc");
    const deps = makeDeps(settings, {
      extractGameState: vi.fn(async (tabId: number) =>
        tabId === 7 ? { gamestate: { name: "playerTurn", active_player: "1" }, players: { "1": { name: "Alice" } } } : null,
      ),
    });

    await handleMessage({ type: "SEND_CHAT_MESSAGE", message: "whose turn?", tabId: 7 }, deps);

    expect(deps.extractGameState).toHaveBeenCalledWith(7);
    const sentMessages = (deps.chatSenders.anthropic as ReturnType<typeof vi.fn>).mock.calls[0]![1];
    expect(sentMessages[0].content).toContain("Current turn: Alice");
  });

  it("re-extracts game state on every call rather than reusing a prior result", async () => {
    const settings = setKey(defaultSettings(), "anthropic", "sk-ant-abc");
    const deps = makeDeps(settings);

    await handleMessage({ type: "SEND_CHAT_MESSAGE", message: "a", tabId: 7 }, deps);
    await handleMessage({ type: "SEND_CHAT_MESSAGE", message: "b", tabId: 7 }, deps);

    expect(deps.extractGameState).toHaveBeenCalledTimes(2);
  });

  it("falls back to context-free, unpersisted chat without crashing when no tabId is given", async () => {
    const settings = setKey(defaultSettings(), "anthropic", "sk-ant-abc");
    const deps = makeDeps(settings);

    const response = await handleMessage({ type: "SEND_CHAT_MESSAGE", message: "hello" }, deps);

    expect(deps.extractGameState).not.toHaveBeenCalled();
    expect(deps.chatPersistence.saveChatRecord).not.toHaveBeenCalled();
    expect(response).toEqual({ ok: true, text: "anthropic reply" });
  });

  describe("table-id resolution", () => {
    it("prefers gamedatas.tableId (from gameui.table_id) over the URL-based fallback when both are available", async () => {
      const settings = setKey(defaultSettings(), "anthropic", "sk-ant-abc");
      const resolveTableId = vi.fn(async () => "url-based-id");
      const deps = makeDeps(settings, {
        extractGameState: vi.fn(async () => ({ gamestate: { name: "playerTurn" }, tableId: "gameui-based-id" })),
        chatPersistence: { resolveTableId },
      });

      await handleMessage({ type: "SEND_CHAT_MESSAGE", message: "hello", tabId: 7 }, deps);

      expect(resolveTableId).not.toHaveBeenCalled();
      expect(await deps.chatPersistence.loadChatRecord("gameui-based-id")).not.toBeNull();
      expect(await deps.chatPersistence.loadChatRecord("url-based-id")).toBeNull();
    });

    it("falls back to the URL-based resolver when gamedatas has no tableId (e.g. gameui hasn't loaded yet)", async () => {
      const settings = setKey(defaultSettings(), "anthropic", "sk-ant-abc");
      const resolveTableId = vi.fn(async () => "url-based-id");
      const deps = makeDeps(settings, {
        extractGameState: vi.fn(async () => ({ gamestate: { name: "playerTurn" } })),
        chatPersistence: { resolveTableId },
      });

      await handleMessage({ type: "SEND_CHAT_MESSAGE", message: "hello", tabId: 7 }, deps);

      expect(resolveTableId).toHaveBeenCalledWith(7);
      expect(await deps.chatPersistence.loadChatRecord("url-based-id")).not.toBeNull();
    });
  });

  describe("persistence", () => {
    it("creates a new record for a table with no prior history, tagging it with the extracted gameSlug", async () => {
      const settings = setKey(defaultSettings(), "anthropic", "sk-ant-abc");
      const deps = makeDeps(settings, {
        chatPersistence: { resolveTableId: vi.fn(async () => "12345") },
        extractGameState: vi.fn(async () => ({ gamestate: { name: "playerTurn" }, gameSlug: "arknova" })),
      });

      await handleMessage({ type: "SEND_CHAT_MESSAGE", message: "hello", tabId: 7 }, deps);

      const saved = await deps.chatPersistence.loadChatRecord("12345");
      expect(saved?.gameSlug).toBe("arknova");
      expect(saved?.messages).toEqual([
        expect.objectContaining({ role: "user", content: "hello" }),
        expect.objectContaining({ role: "assistant", content: "anthropic reply" }),
      ]);
    });

    it("appends to, rather than replaces, a table's existing history", async () => {
      const settings = setKey(defaultSettings(), "anthropic", "sk-ant-abc");
      const deps = makeDeps(settings, { chatPersistence: { resolveTableId: vi.fn(async () => "12345") } });
      await deps.chatPersistence.saveChatRecord({
        tableId: "12345",
        status: "active",
        createdAt: 1,
        lastActiveAt: 1,
        messages: [{ role: "user", content: "earlier message", timestamp: 1 }],
        cachedRulebookExcerpt: null,
      });

      await handleMessage({ type: "SEND_CHAT_MESSAGE", message: "hello", tabId: 7 }, deps);

      const saved = await deps.chatPersistence.loadChatRecord("12345");
      expect(saved?.messages.map((m) => m.content)).toEqual(["earlier message", "hello", "anthropic reply"]);
    });

    it("includes prior persisted history (not just the new message) in what's sent to the provider", async () => {
      const settings = setKey(defaultSettings(), "anthropic", "sk-ant-abc");
      const deps = makeDeps(settings, { chatPersistence: { resolveTableId: vi.fn(async () => "12345") } });
      await deps.chatPersistence.saveChatRecord({
        tableId: "12345",
        status: "active",
        createdAt: 1,
        lastActiveAt: 1,
        messages: [{ role: "user", content: "earlier message", timestamp: 1 }],
        cachedRulebookExcerpt: null,
      });

      await handleMessage({ type: "SEND_CHAT_MESSAGE", message: "hello", tabId: 7 }, deps);

      const sentMessages = (deps.chatSenders.anthropic as ReturnType<typeof vi.fn>).mock.calls[0]![1];
      expect(sentMessages.map((m: { content: string }) => m.content)).toContain("earlier message");
    });

    it("does not persist an assistant message when the provider call fails, but keeps the user's message", async () => {
      const settings = setKey(defaultSettings(), "anthropic", "sk-ant-abc");
      const deps = makeDeps(settings, {
        chatPersistence: { resolveTableId: vi.fn(async () => "12345") },
        chatSenders: {
          anthropic: vi.fn(async () => ({ ok: false, error: "network down" }) as const),
          openai: vi.fn(async () => ({ ok: true, text: "openai reply" }) as const),
        },
      });

      await handleMessage({ type: "SEND_CHAT_MESSAGE", message: "hello", tabId: 7 }, deps);

      const saved = await deps.chatPersistence.loadChatRecord("12345");
      expect(saved?.messages).toEqual([expect.objectContaining({ role: "user", content: "hello" })]);
    });

    it("marks the record finished once gameEnd is observed, and it stays finished on the next message", async () => {
      const settings = setKey(defaultSettings(), "anthropic", "sk-ant-abc");
      const deps = makeDeps(settings, {
        chatPersistence: { resolveTableId: vi.fn(async () => "12345") },
        extractGameState: vi.fn(async () => ({ gamestate: { name: "gameEnd" } })),
      });

      await handleMessage({ type: "SEND_CHAT_MESSAGE", message: "gg", tabId: 7 }, deps);
      expect((await deps.chatPersistence.loadChatRecord("12345"))?.status).toBe("finished");

      // A later message where extraction happens to report a different state
      // (e.g. a stale race) should never un-finish it.
      deps.extractGameState = vi.fn(async () => ({ gamestate: { name: "playerTurn" } }));
      await handleMessage({ type: "SEND_CHAT_MESSAGE", message: "still there?", tabId: 7 }, deps);
      expect((await deps.chatPersistence.loadChatRecord("12345"))?.status).toBe("finished");
    });

    it("rejects a new message server-side once a table is finished, even without relying on the panel disabling its composer", async () => {
      const settings = setKey(defaultSettings(), "anthropic", "sk-ant-abc");
      const deps = makeDeps(settings, { chatPersistence: { resolveTableId: vi.fn(async () => "12345") } });
      await deps.chatPersistence.saveChatRecord({
        tableId: "12345",
        status: "finished",
        createdAt: 1,
        lastActiveAt: 1,
        messages: [{ role: "assistant", content: "gg", timestamp: 1 }],
        cachedRulebookExcerpt: null,
      });

      const response = await handleMessage(
        { type: "SEND_CHAT_MESSAGE", message: "one more move?", tabId: 7 },
        deps,
      );

      expect(response).toEqual({ ok: false, error: "This game has ended — chat is read-only." });
      expect(deps.chatSenders.anthropic).not.toHaveBeenCalled();
      const saved = await deps.chatPersistence.loadChatRecord("12345");
      expect(saved?.messages).toEqual([expect.objectContaining({ content: "gg" })]);
    });

    it("keeps two different tables' histories from mixing", async () => {
      const settings = setKey(defaultSettings(), "anthropic", "sk-ant-abc");
      const resolveTableId = vi.fn(async (tabId: number) => (tabId === 1 ? "table-a" : "table-b"));
      const deps = makeDeps(settings, { chatPersistence: { resolveTableId } });

      await handleMessage({ type: "SEND_CHAT_MESSAGE", message: "hello from A", tabId: 1 }, deps);
      await handleMessage({ type: "SEND_CHAT_MESSAGE", message: "hello from B", tabId: 2 }, deps);

      const a = await deps.chatPersistence.loadChatRecord("table-a");
      const b = await deps.chatPersistence.loadChatRecord("table-b");
      expect(a?.messages.map((m) => m.content)).toEqual(["hello from A", "anthropic reply"]);
      expect(b?.messages.map((m) => m.content)).toEqual(["hello from B", "anthropic reply"]);
    });
  });
});
