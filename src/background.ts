import { loadChatRecord, saveChatRecord, sweepExpiredChatRecords } from "./lib/chat/chatStore";
import { extractGameState } from "./lib/gameState/extract";
import { resolveTableId } from "./lib/gameState/tableId";
import { isBgaUrl } from "./lib/isBgaUrl";
import { handleMessage } from "./lib/messageHandler";
import type { Message } from "./lib/messages";
import { chatSenders, validators } from "./lib/providers";
import { loadSettings, saveSettings } from "./lib/settingsStore";

// A backstop for tables that never reach `gameEnd` — run once whenever the
// service worker (re)starts, rather than on a recurring alarm, since a
// worker that's been asleep for a while gets a fresh start anyway.
void sweepExpiredChatRecords(Date.now()).catch((error) =>
  console.error("BGA Copilot: chat-record sweep failed", error),
);

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
  handleMessage(message, {
    loadSettings,
    saveSettings,
    validators,
    chatSenders,
    extractGameState,
    chatPersistence: { resolveTableId, loadChatRecord, saveChatRecord, now: () => Date.now() },
  }).then(sendResponse);
  return true; // keep the message channel open for the async response
});
