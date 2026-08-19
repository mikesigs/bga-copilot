import { describe, expect, it, vi } from "vitest";
import { handleMessage, type MessageHandlerDeps } from "./messageHandler";
import { defaultSettings, setKey, type Settings } from "./settings";

function makeDeps(initial: Settings, overrides: Partial<MessageHandlerDeps> = {}): MessageHandlerDeps {
  let stored = initial;
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
    ...overrides,
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

describe("handleMessage SEND_CHAT_MESSAGE", () => {
  it("sends the message history (prefixed with an assembled system prompt) to the active provider's chat sender using its stored key", async () => {
    const settings = setKey(defaultSettings(), "anthropic", "sk-ant-abc");
    const deps = makeDeps(settings);

    const response = await handleMessage(
      { type: "SEND_CHAT_MESSAGE", messages: [{ role: "user", content: "hello" }] },
      deps,
    );

    expect(deps.chatSenders.anthropic).toHaveBeenCalledWith("sk-ant-abc", [
      expect.objectContaining({ role: "system" }),
      { role: "user", content: "hello" },
    ]);
    expect(response).toEqual({ ok: true, text: "anthropic reply" });
  });

  it("returns an error without calling the provider when no key is configured", async () => {
    const deps = makeDeps(defaultSettings());

    const response = await handleMessage(
      { type: "SEND_CHAT_MESSAGE", messages: [{ role: "user", content: "hello" }] },
      deps,
    );

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

    const response = await handleMessage(
      { type: "SEND_CHAT_MESSAGE", messages: [{ role: "user", content: "hello" }] },
      deps,
    );

    expect(response).toEqual({ ok: false, error: "Could not reach Anthropic: network down" });
  });

  it("extracts game state for the given tabId and folds it into the system prompt sent to the provider", async () => {
    const settings = setKey(defaultSettings(), "anthropic", "sk-ant-abc");
    const deps = makeDeps(settings, {
      extractGameState: vi.fn(async (tabId: number) =>
        tabId === 7 ? { gamestate: { name: "playerTurn", active_player: "1" }, players: { "1": { name: "Alice" } } } : null,
      ),
    });

    await handleMessage({ type: "SEND_CHAT_MESSAGE", messages: [{ role: "user", content: "whose turn?" }], tabId: 7 }, deps);

    expect(deps.extractGameState).toHaveBeenCalledWith(7);
    const sentMessages = (deps.chatSenders.anthropic as ReturnType<typeof vi.fn>).mock.calls[0]![1];
    expect(sentMessages[0].content).toContain("Current turn: Alice");
  });

  it("re-extracts game state on every call rather than reusing a prior result", async () => {
    const settings = setKey(defaultSettings(), "anthropic", "sk-ant-abc");
    const deps = makeDeps(settings);

    await handleMessage({ type: "SEND_CHAT_MESSAGE", messages: [{ role: "user", content: "a" }], tabId: 7 }, deps);
    await handleMessage({ type: "SEND_CHAT_MESSAGE", messages: [{ role: "user", content: "b" }], tabId: 7 }, deps);

    expect(deps.extractGameState).toHaveBeenCalledTimes(2);
  });

  it("falls back to context-free chat without crashing when no tabId is given", async () => {
    const settings = setKey(defaultSettings(), "anthropic", "sk-ant-abc");
    const deps = makeDeps(settings);

    const response = await handleMessage(
      { type: "SEND_CHAT_MESSAGE", messages: [{ role: "user", content: "hello" }] },
      deps,
    );

    expect(deps.extractGameState).not.toHaveBeenCalled();
    expect(response).toEqual({ ok: true, text: "anthropic reply" });
  });
});
