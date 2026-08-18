import { defaultSettings, type Settings } from "./settings";

const STORAGE_KEY = "bga_copilot_settings";

export async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as Settings | undefined;
  return stored ?? defaultSettings();
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}
