export type Provider = "anthropic" | "openai";

export interface Settings {
  activeProvider: Provider;
  keys: Partial<Record<Provider, string>>;
}

export function defaultSettings(): Settings {
  return { activeProvider: "anthropic", keys: {} };
}

export function hasKey(settings: Settings, provider: Provider): boolean {
  return Boolean(settings.keys[provider]);
}

export function setKey(settings: Settings, provider: Provider, key: string): Settings {
  return { ...settings, keys: { ...settings.keys, [provider]: key } };
}

export function setActiveProvider(settings: Settings, provider: Provider): Settings {
  return { ...settings, activeProvider: provider };
}
