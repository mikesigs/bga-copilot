import { isBgaUrl } from "./lib/isBgaUrl";
import { handleMessage } from "./lib/messageHandler";
import type { Message } from "./lib/messages";
import { validators } from "./lib/providers";
import { loadSettings, saveSettings } from "./lib/settingsStore";

// The side panel is only meaningful on BoardGameArena tabs — keep it enabled
// exclusively there so switching to any other tab reflects "no active game"
// by simply having nothing to show, rather than a stale panel from another site.
async function syncPanelForTab(tabId: number, url: string | undefined): Promise<void> {
  await chrome.sidePanel.setOptions({
    tabId,
    path: "sidepanel.html",
    enabled: isBgaUrl(url),
  });
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    void syncPanelForTab(tabId, tab.url);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "loading" && changeInfo.url === undefined) return;
  void syncPanelForTab(tabId, tab.url);
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Failed to set side panel behavior:", error));

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  handleMessage(message, { loadSettings, saveSettings, validators }).then(sendResponse);
  return true; // keep the message channel open for the async response
});
