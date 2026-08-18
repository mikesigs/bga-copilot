import type { GetSettingsResponse, Message, SaveKeyResponse } from "../lib/messages";
import type { Provider } from "../lib/settings";

function sendMessage<T>(message: Message): Promise<T> {
  return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
}

const settingsToggle = document.getElementById("settings-toggle") as HTMLButtonElement;
const chatView = document.getElementById("chat-view") as HTMLElement;
const settingsView = document.getElementById("settings-view") as HTMLElement;
const keyPrompt = document.getElementById("key-prompt") as HTMLElement;
const openSettingsFromPrompt = document.getElementById("key-prompt-open-settings") as HTMLButtonElement;
const providerPicker = document.getElementById("provider-picker") as HTMLElement;
const apiKeyInput = document.getElementById("api-key-input") as HTMLInputElement;
const keyError = document.getElementById("key-error") as HTMLElement;
const keySaved = document.getElementById("key-saved") as HTMLElement;
const saveKeyBtn = document.getElementById("save-key-btn") as HTMLButtonElement;

let settings: GetSettingsResponse = { activeProvider: "anthropic", hasKey: { anthropic: false, openai: false } };
let selectedProvider: Provider = "anthropic";

function showView(view: "chat" | "settings"): void {
  chatView.hidden = view !== "chat";
  settingsView.hidden = view !== "settings";
}

function render(): void {
  keyPrompt.hidden = settings.hasKey[settings.activeProvider];

  selectedProvider = settings.activeProvider;
  for (const button of providerPicker.querySelectorAll<HTMLButtonElement>(".provider-option")) {
    const provider = button.dataset.provider as Provider;
    button.classList.toggle("active", provider === selectedProvider);
    const badge = button.querySelector<HTMLElement>(".key-badge");
    if (badge) badge.hidden = !settings.hasKey[provider];
  }

  apiKeyInput.value = "";
  keyError.hidden = true;
  keySaved.hidden = true;
}

async function refreshSettings(): Promise<void> {
  settings = await sendMessage<GetSettingsResponse>({ type: "GET_SETTINGS" });
  render();
}

settingsToggle.addEventListener("click", () => {
  showView(settingsView.hidden ? "settings" : "chat");
});

openSettingsFromPrompt.addEventListener("click", () => showView("settings"));

providerPicker.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".provider-option");
  if (!button) return;
  const provider = button.dataset.provider as Provider;
  if (provider === selectedProvider) return;

  void sendMessage({ type: "SET_ACTIVE_PROVIDER", provider }).then(() => refreshSettings());
});

saveKeyBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  keyError.hidden = true;
  keySaved.hidden = true;

  if (!key) {
    keyError.textContent = "Enter a key first.";
    keyError.hidden = false;
    return;
  }

  saveKeyBtn.disabled = true;
  void sendMessage<SaveKeyResponse>({ type: "SAVE_KEY", provider: selectedProvider, key })
    .then(async (result) => {
      if (result.ok) {
        // refreshSettings() re-renders (clearing transient state), so only
        // reveal the confirmation once that settles.
        await refreshSettings();
        keySaved.hidden = false;
      } else {
        keyError.textContent = result.error;
        keyError.hidden = false;
      }
    })
    .finally(() => {
      saveKeyBtn.disabled = false;
    });
});

void refreshSettings();
