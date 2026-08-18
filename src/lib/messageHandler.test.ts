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
    ...overrides,
  };
}

describe("handleMessage", () => {
  it("GET_SETTINGS reports the active provider and which providers have keys, never the keys themselves", async () => {
    const settings = setKey(defaultSettings(), "anthropic", "sk-ant-abc");
    const deps = makeDeps(settings);

    const response = await handleMessage({ type: "GET_SETTINGS" }, deps);

    expect(response).toEqual({
      activeProvider: "anthropic",
      hasKey: { anthropic: true, openai: false },
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
