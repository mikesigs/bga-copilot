import { describe, expect, it } from "vitest";
import { defaultSettings, hasKey, setActiveProvider, setKey } from "./settings";

describe("settings", () => {
  it("defaults to anthropic active with no keys saved", () => {
    const settings = defaultSettings();
    expect(settings.activeProvider).toBe("anthropic");
    expect(hasKey(settings, "anthropic")).toBe(false);
    expect(hasKey(settings, "openai")).toBe(false);
  });

  it("setKey saves a key for one provider without touching the other", () => {
    const initial = defaultSettings();
    const withAnthropic = setKey(initial, "anthropic", "sk-ant-abc");
    expect(hasKey(withAnthropic, "anthropic")).toBe(true);
    expect(hasKey(withAnthropic, "openai")).toBe(false);

    const withBoth = setKey(withAnthropic, "openai", "sk-oai-xyz");
    expect(hasKey(withBoth, "anthropic")).toBe(true);
    expect(hasKey(withBoth, "openai")).toBe(true);
  });

  it("setKey overwrites an existing key for the same provider", () => {
    const initial = setKey(defaultSettings(), "anthropic", "sk-ant-old");
    const updated = setKey(initial, "anthropic", "sk-ant-new");
    expect(updated.keys.anthropic).toBe("sk-ant-new");
  });

  it("setActiveProvider switches the active provider without clearing either key", () => {
    const withBoth = setKey(setKey(defaultSettings(), "anthropic", "sk-ant-abc"), "openai", "sk-oai-xyz");
    const switched = setActiveProvider(withBoth, "openai");
    expect(switched.activeProvider).toBe("openai");
    expect(hasKey(switched, "anthropic")).toBe(true);
    expect(hasKey(switched, "openai")).toBe(true);
  });

  it("does not mutate the settings object passed in", () => {
    const initial = defaultSettings();
    setKey(initial, "anthropic", "sk-ant-abc");
    expect(hasKey(initial, "anthropic")).toBe(false);
  });
});
