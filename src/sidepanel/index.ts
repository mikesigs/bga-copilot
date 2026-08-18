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
  statusRow: HTMLElement;
  previewText: HTMLElement;
  editBtn: HTMLButtonElement;
  editRow: HTMLElement;
  keyInput: HTMLInputElement;
  saveBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  errorEl: HTMLElement;
}

function bindProviderCard(provider: Provider): ProviderCard {
  return {
    provider,
    radio: document.getElementById(`active-${provider}`) as HTMLInputElement,
    statusRow: document.getElementById(`key-status-${provider}`) as HTMLElement,
    previewText: document.getElementById(`key-preview-${provider}`) as HTMLElement,
    editBtn: document.getElementById(`edit-${provider}`) as HTMLButtonElement,
    editRow: document.getElementById(`key-edit-${provider}`) as HTMLElement,
    keyInput: document.getElementById(`key-input-${provider}`) as HTMLInputElement,
    saveBtn: document.getElementById(`save-${provider}`) as HTMLButtonElement,
    cancelBtn: document.getElementById(`cancel-${provider}`) as HTMLButtonElement,
    errorEl: document.getElementById(`error-${provider}`) as HTMLElement,
  };
}

const providerCards: ProviderCard[] = [bindProviderCard("anthropic"), bindProviderCard("openai")];

let settings: GetSettingsResponse = {
  activeProvider: "anthropic",
  hasKey: { anthropic: false, openai: false },
  keyPreview: { anthropic: null, openai: null },
};

function showView(view: "chat" | "settings"): void {
  chatView.hidden = view !== "chat";
  settingsView.hidden = view !== "settings";
}

function collapseToStatus(card: ProviderCard): void {
  card.editRow.hidden = true;
  card.statusRow.hidden = false;
  card.keyInput.value = "";
  card.errorEl.hidden = true;
}

function render(): void {
  keyPrompt.hidden = settings.hasKey[settings.activeProvider];

  for (const card of providerCards) {
    card.radio.checked = settings.activeProvider === card.provider;
    const preview = settings.keyPreview[card.provider];
    card.previewText.textContent = preview ?? "Not configured";
    card.editBtn.textContent = preview ? "Change key" : "Add key";
    collapseToStatus(card);
  }
}

// Defends against a background service worker still running an older build
// (Chrome doesn't always restart a service worker immediately on reload) —
// spreading the real response over safe defaults means a missing field
// degrades to "not configured" instead of crashing render().
function normalizeSettingsResponse(response: Partial<GetSettingsResponse>): GetSettingsResponse {
  return {
    activeProvider: response.activeProvider ?? "anthropic",
    hasKey: { anthropic: false, openai: false, ...response.hasKey },
    keyPreview: { anthropic: null, openai: null, ...response.keyPreview },
  };
}

async function refreshSettings(): Promise<void> {
  try {
    settings = normalizeSettingsResponse(
      await sendMessage<Partial<GetSettingsResponse>>({ type: "GET_SETTINGS" }),
    );
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

  card.editBtn.addEventListener("click", () => {
    card.statusRow.hidden = true;
    card.editRow.hidden = false;
    card.keyInput.focus();
  });

  card.cancelBtn.addEventListener("click", () => collapseToStatus(card));

  card.saveBtn.addEventListener("click", () => {
    const key = card.keyInput.value.trim();
    card.errorEl.hidden = true;

    if (!key) {
      card.errorEl.textContent = "Enter a key first.";
      card.errorEl.hidden = false;
      return;
    }

    card.saveBtn.disabled = true;
    void sendMessage<SaveKeyResponse>({ type: "SAVE_KEY", provider: card.provider, key })
      .then(async (result) => {
        if (result.ok) {
          // refreshSettings() re-renders every card (including collapsing
          // this one back to its status view with the fresh masked preview).
          await refreshSettings();
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
