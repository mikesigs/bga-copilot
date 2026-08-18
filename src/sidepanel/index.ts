import type { GetSettingsResponse, Message, SaveKeyResponse } from "../lib/messages";
import type { Provider } from "../lib/settings";

function sendMessage<T>(message: Message): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: T) => {
      // chrome.runtime.sendMessage still invokes this callback (with an
      // undefined response) when delivery itself fails — e.g. the background
      // service worker hasn't finished registering its listener yet. Without
      // this check that failure was silently treated as a valid empty
      // response, corrupting all downstream state.
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

const settingsToggle = document.getElementById("settings-toggle") as HTMLButtonElement;
const chatView = document.getElementById("chat-view") as HTMLElement;
const settingsView = document.getElementById("settings-view") as HTMLElement;
const keyPrompt = document.getElementById("key-prompt") as HTMLElement;
const openSettingsFromPrompt = document.getElementById("key-prompt-open-settings") as HTMLButtonElement;

interface ProviderCard {
  provider: Provider;
  radio: HTMLInputElement;
  badge: HTMLElement;
  keyInput: HTMLInputElement;
  saveBtn: HTMLButtonElement;
  errorEl: HTMLElement;
  savedEl: HTMLElement;
}

function bindProviderCard(provider: Provider): ProviderCard {
  return {
    provider,
    radio: document.getElementById(`active-${provider}`) as HTMLInputElement,
    badge: document.getElementById(`badge-${provider}`) as HTMLElement,
    keyInput: document.getElementById(`key-input-${provider}`) as HTMLInputElement,
    saveBtn: document.getElementById(`save-${provider}`) as HTMLButtonElement,
    errorEl: document.getElementById(`error-${provider}`) as HTMLElement,
    savedEl: document.getElementById(`saved-${provider}`) as HTMLElement,
  };
}

const providerCards: ProviderCard[] = [bindProviderCard("anthropic"), bindProviderCard("openai")];

let settings: GetSettingsResponse = { activeProvider: "anthropic", hasKey: { anthropic: false, openai: false } };

function showView(view: "chat" | "settings"): void {
  chatView.hidden = view !== "chat";
  settingsView.hidden = view !== "settings";
}

function render(): void {
  keyPrompt.hidden = settings.hasKey[settings.activeProvider];

  for (const card of providerCards) {
    card.radio.checked = settings.activeProvider === card.provider;
    card.badge.textContent = settings.hasKey[card.provider] ? "✓ saved" : "not saved";
    card.keyInput.value = "";
    card.errorEl.hidden = true;
    card.savedEl.hidden = true;
  }
}

async function refreshSettings(): Promise<void> {
  try {
    settings = await sendMessage<GetSettingsResponse>({ type: "GET_SETTINGS" });
    render();
  } catch (error) {
    // Leave `settings` at its last-known-good value rather than corrupting
    // it — a transient failure here shouldn't break every other read of
    // `settings` for the rest of the panel's lifetime.
    console.error("BGA Copilot: failed to load settings", error);
  }
}

settingsToggle.addEventListener("click", () => {
  showView(settingsView.hidden ? "settings" : "chat");
});

openSettingsFromPrompt.addEventListener("click", () => showView("settings"));

for (const card of providerCards) {
  card.radio.addEventListener("change", () => {
    if (!card.radio.checked) return;
    void sendMessage({ type: "SET_ACTIVE_PROVIDER", provider: card.provider })
      .then(() => refreshSettings())
      .catch((error) => console.error("BGA Copilot: failed to switch provider", error));
  });

  card.saveBtn.addEventListener("click", () => {
    const key = card.keyInput.value.trim();
    card.errorEl.hidden = true;
    card.savedEl.hidden = true;

    if (!key) {
      card.errorEl.textContent = "Enter a key first.";
      card.errorEl.hidden = false;
      return;
    }

    card.saveBtn.disabled = true;
    void sendMessage<SaveKeyResponse>({ type: "SAVE_KEY", provider: card.provider, key })
      .then(async (result) => {
        if (result.ok) {
          // refreshSettings() re-renders (clearing transient state), so only
          // reveal the confirmation once that settles.
          await refreshSettings();
          card.savedEl.hidden = false;
        } else {
          card.errorEl.textContent = result.error;
          card.errorEl.hidden = false;
        }
      })
      .catch((error) => {
        card.errorEl.textContent = "Something went wrong talking to the extension. Try again.";
        card.errorEl.hidden = false;
        console.error("BGA Copilot: failed to save key", error);
      })
      .finally(() => {
        card.saveBtn.disabled = false;
      });
  });
}

void refreshSettings();
