import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors the elements in index.html that index.ts binds to by id/class.
// Kept minimal (no settings-view provider cards markup) since those ids are
// only read lazily inside bindProviderCard(), which still needs each id to
// exist — so the full provider-card markup for both providers is included.
const FIXTURE_HTML = `
  <button id="settings-toggle" type="button">Settings</button>
  <section id="chat-view">
    <div id="key-prompt" hidden>
      <button id="key-prompt-open-settings" type="button">Open settings</button>
    </div>
    <div id="finished-banner" hidden></div>
    <div id="loading-banner" hidden></div>
    <div id="no-table-banner" hidden></div>
    <main id="msg-list"><p id="empty-state">No messages yet.</p></main>
    <div id="quick-actions">
      <button type="button" class="quick-action" data-prompt="Suggest my next move.">Suggest my next move</button>
      <button type="button" class="quick-action" data-prompt="Explain this rule.">Explain this rule</button>
      <button type="button" class="quick-action" data-prompt="What just happened?">What just happened</button>
    </div>
    <div class="composer">
      <input type="text" id="composer-input" />
      <button type="button" id="composer-send">Send</button>
    </div>
  </section>
  <section id="settings-view" hidden>
    ${["anthropic", "openai"]
      .map(
        (provider) => `
      <div class="provider-card" data-provider="${provider}">
        <input type="radio" name="active-provider" id="active-${provider}" />
        <div id="key-status-${provider}">
          <span id="key-preview-${provider}"></span>
          <button type="button" id="edit-${provider}"></button>
        </div>
        <div id="key-edit-${provider}" hidden>
          <input type="password" id="key-input-${provider}" />
          <button type="button" id="save-${provider}">Save</button>
          <button type="button" id="cancel-${provider}">Cancel</button>
          <p id="error-${provider}" hidden></p>
        </div>
      </div>`,
      )
      .join("")}
  </section>
`;

function setupDom(): void {
  document.body.innerHTML = FIXTURE_HTML;
}

type Responder = unknown | ((message: { type: string; tabId?: number }) => unknown);

interface MockChrome {
  calls: { type: string }[];
  setActiveTabId: (id: number) => void;
  triggerTabActivated: () => void;
}

// `message` is mutated by the panel after this call returns (in earlier
// versions it carried a live chat-history array), so recording the live
// reference (vi.fn's default) could see later mutations. Snapshotting with
// structuredClone captures the value as of the call, which is now moot for
// the current message shape but kept for safety.
function mockChrome(responses: Record<string, Responder>, initialTabId = 7): MockChrome {
  const calls: { type: string }[] = [];
  let activeTabId = initialTabId;
  const activatedListeners: (() => void)[] = [];

  const sendMessage = vi.fn((message: { type: string; tabId?: number }, callback: (response: unknown) => void) => {
    calls.push(structuredClone(message));
    const responder = responses[message.type];
    const response = typeof responder === "function" ? responder(message) : responder;
    // Supports a responder returning a Promise (to test the panel's
    // in-flight "loading" state), not just a plain value.
    void Promise.resolve(response).then(callback);
  });

  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: { sendMessage, lastError: undefined },
    tabs: {
      query: (_info: unknown, callback: (tabs: { id: number }[]) => void) => callback([{ id: activeTabId }]),
      onActivated: { addListener: (fn: () => void) => activatedListeners.push(fn) },
      onUpdated: { addListener: () => {} },
    },
  };

  return {
    calls,
    setActiveTabId: (id: number) => {
      activeTabId = id;
    },
    triggerTabActivated: () => activatedListeners.forEach((fn) => fn()),
  };
}

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const defaultSettingsResponse = {
  activeProvider: "anthropic",
  hasKey: { anthropic: true, openai: false },
  keyPreview: { anthropic: "sk-...abcd", openai: null },
};

const noHistory = { tableId: null, status: null, messages: [] };
const hasTable = { tableId: "12345", status: "active", messages: [] };

// Sending a message on a real table always re-syncs from GET_CHAT_HISTORY
// afterward (to pick up e.g. a game-end status change) — a static
// GET_CHAT_HISTORY response would wipe the just-rendered exchange back to
// empty on that resync, so these mocks mirror the background's real
// behavior of persisting each turn and serving it back.
function mockChromeWithPersistedChat(
  sendChatResponse: unknown | ((message: { message: string }) => unknown),
): MockChrome {
  let messages: { role: string; content: string }[] = [];
  return mockChrome({
    GET_SETTINGS: defaultSettingsResponse,
    GET_CHAT_HISTORY: () => ({ tableId: "12345", status: "active", messages }),
    SEND_CHAT_MESSAGE: (message: { message: string }) => {
      messages = [...messages, { role: "user", content: message.message }];
      const response =
        typeof sendChatResponse === "function"
          ? (sendChatResponse as (message: { message: string }) => { ok: boolean; text?: string })(message)
          : sendChatResponse;
      if ((response as { ok: boolean }).ok) {
        messages = [...messages, { role: "assistant", content: (response as { text: string }).text }];
      }
      return response;
    },
  });
}

describe("sidepanel chat", () => {
  beforeEach(() => {
    vi.resetModules();
    setupDom();
  });

  afterEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it("sends the typed message and renders the provider's reply", async () => {
    const chrome = mockChromeWithPersistedChat({ ok: true, text: "42" });

    await import("./index");
    await flushMicrotasks();

    const input = document.getElementById("composer-input") as HTMLInputElement;
    const send = document.getElementById("composer-send") as HTMLButtonElement;
    input.value = "what's my score?";
    send.click();
    await flushMicrotasks();

    const listText = document.getElementById("msg-list")!.textContent ?? "";
    expect(listText).toContain("what's my score?");
    expect(listText).toContain("42");
    expect(chrome.calls).toContainEqual({ type: "SEND_CHAT_MESSAGE", message: "what's my score?", tabId: 7 });
  });

  it("sends a quick-action chip's canned prompt", async () => {
    mockChromeWithPersistedChat({ ok: true, text: "Try building an engine." });

    await import("./index");
    await flushMicrotasks();

    const chip = document.querySelector<HTMLButtonElement>('[data-prompt="Suggest my next move."]')!;
    chip.click();
    await flushMicrotasks();

    const listText = document.getElementById("msg-list")!.textContent ?? "";
    expect(listText).toContain("Suggest my next move.");
    expect(listText).toContain("Try building an engine.");
  });

  it("renders a provider error as a chat message instead of throwing", async () => {
    mockChromeWithPersistedChat({ ok: false, error: "Could not reach Anthropic: network down" });

    await import("./index");
    await flushMicrotasks();

    const input = document.getElementById("composer-input") as HTMLInputElement;
    const send = document.getElementById("composer-send") as HTMLButtonElement;
    input.value = "hello";
    send.click();
    await flushMicrotasks();

    const errorMsg = document.querySelector(".msg-error");
    expect(errorMsg?.textContent).toBe("Could not reach Anthropic: network down");
  });

  it("renders a no-game-state rejection as a normal error bubble, not a silent self-heal like no-table (#32 follow-up)", async () => {
    mockChromeWithPersistedChat({ ok: false, error: "No live game state available for this table.", code: "no-game-state" });

    await import("./index");
    await flushMicrotasks();

    const input = document.getElementById("composer-input") as HTMLInputElement;
    const send = document.getElementById("composer-send") as HTMLButtonElement;
    input.value = "what's my score?";
    send.click();
    await flushMicrotasks();

    const errorMsg = document.querySelector(".msg-error");
    expect(errorMsg?.textContent).toBe("No live game state available for this table.");
    // A real, resolvable table shouldn't get gated shut by a one-off
    // extraction failure — the user should just be able to retry.
    expect((document.getElementById("composer-input") as HTMLInputElement).disabled).toBe(false);
  });

  it("disables the composer and quick actions while no key is configured for the active provider", async () => {
    mockChrome({
      GET_SETTINGS: {
        activeProvider: "anthropic",
        hasKey: { anthropic: false, openai: false },
        keyPreview: { anthropic: null, openai: null },
      },
      GET_CHAT_HISTORY: hasTable,
    });

    await import("./index");
    await flushMicrotasks();

    expect((document.getElementById("composer-input") as HTMLInputElement).disabled).toBe(true);
    expect((document.getElementById("composer-send") as HTMLButtonElement).disabled).toBe(true);
    for (const chip of document.querySelectorAll<HTMLButtonElement>(".quick-action")) {
      expect(chip.disabled).toBe(true);
    }
  });

  describe("per-table persistence", () => {
    it("restores a table's prior chat history on load", async () => {
      mockChrome({
        GET_SETTINGS: defaultSettingsResponse,
        GET_CHAT_HISTORY: {
          tableId: "12345",
          status: "active",
          messages: [
            { role: "user", content: "earlier question", timestamp: 1 },
            { role: "assistant", content: "earlier answer", timestamp: 2 },
          ],
        },
      });

      await import("./index");
      await flushMicrotasks();

      const listText = document.getElementById("msg-list")!.textContent ?? "";
      expect(listText).toContain("earlier question");
      expect(listText).toContain("earlier answer");
      expect((document.getElementById("empty-state") as HTMLElement).hidden).toBe(true);
    });

    it("switches to the newly active tab's own chat history when the active tab changes", async () => {
      const chrome = mockChrome({
        GET_SETTINGS: defaultSettingsResponse,
        GET_CHAT_HISTORY: (message: { tabId?: number }) =>
          message.tabId === 7
            ? { tableId: "table-a", status: "active", messages: [{ role: "user", content: "hello from A" }] }
            : { tableId: "table-b", status: "active", messages: [{ role: "user", content: "hello from B" }] },
      });

      await import("./index");
      await flushMicrotasks();
      expect(document.getElementById("msg-list")!.textContent).toContain("hello from A");
      expect(document.getElementById("msg-list")!.textContent).not.toContain("hello from B");

      chrome.setActiveTabId(9);
      chrome.triggerTabActivated();
      await flushMicrotasks();

      expect(document.getElementById("msg-list")!.textContent).toContain("hello from B");
      expect(document.getElementById("msg-list")!.textContent).not.toContain("hello from A");
    });

    it("shows a finished banner but keeps the composer and chips usable for post-game chat", async () => {
      mockChrome({
        GET_SETTINGS: defaultSettingsResponse,
        GET_CHAT_HISTORY: {
          tableId: "12345",
          status: "finished",
          messages: [{ role: "assistant", content: "gg" }],
        },
      });

      await import("./index");
      await flushMicrotasks();

      expect((document.getElementById("finished-banner") as HTMLElement).hidden).toBe(false);
      expect((document.getElementById("composer-input") as HTMLInputElement).disabled).toBe(false);
      expect((document.getElementById("composer-send") as HTMLButtonElement).disabled).toBe(false);
      for (const chip of document.querySelectorAll<HTMLButtonElement>(".quick-action")) {
        expect(chip.disabled).toBe(false);
      }
    });

    it("shows the empty state (not a stale finished banner) for an active table with no prior messages", async () => {
      mockChrome({
        GET_SETTINGS: defaultSettingsResponse,
        GET_CHAT_HISTORY: { tableId: "12345", status: null, messages: [] },
      });

      await import("./index");
      await flushMicrotasks();

      expect((document.getElementById("empty-state") as HTMLElement).hidden).toBe(false);
      expect((document.getElementById("finished-banner") as HTMLElement).hidden).toBe(true);
      expect((document.getElementById("composer-input") as HTMLInputElement).disabled).toBe(false);
    });
  });

  describe("no-table gate (#32)", () => {
    it("shows a loading indicator (not the no-table banner) while GET_CHAT_HISTORY is still pending", async () => {
      let resolveHistory!: (value: unknown) => void;
      const historyPromise = new Promise((resolve) => {
        resolveHistory = resolve;
      });
      mockChrome({
        GET_SETTINGS: defaultSettingsResponse,
        GET_CHAT_HISTORY: () => historyPromise,
      });

      await import("./index");
      await flushMicrotasks();

      expect((document.getElementById("loading-banner") as HTMLElement).hidden).toBe(false);
      expect((document.getElementById("no-table-banner") as HTMLElement).hidden).toBe(true);
      expect((document.getElementById("composer-input") as HTMLInputElement).disabled).toBe(true);

      resolveHistory({ tableId: "12345", status: "active", messages: [] });
      await flushMicrotasks();

      expect((document.getElementById("loading-banner") as HTMLElement).hidden).toBe(true);
      expect((document.getElementById("composer-input") as HTMLInputElement).disabled).toBe(false);
    });

    it("shows the no-table banner and disables the composer once resolved with no recognizable table", async () => {
      mockChrome({
        GET_SETTINGS: defaultSettingsResponse,
        GET_CHAT_HISTORY: noHistory,
      });

      await import("./index");
      await flushMicrotasks();

      expect((document.getElementById("loading-banner") as HTMLElement).hidden).toBe(true);
      expect((document.getElementById("no-table-banner") as HTMLElement).hidden).toBe(false);
      expect((document.getElementById("composer-input") as HTMLInputElement).disabled).toBe(true);
      expect((document.getElementById("composer-send") as HTMLButtonElement).disabled).toBe(true);
      for (const chip of document.querySelectorAll<HTMLButtonElement>(".quick-action")) {
        expect(chip.disabled).toBe(true);
      }
    });

    it("prioritizes the no-table banner over the missing-key prompt when both apply", async () => {
      mockChrome({
        GET_SETTINGS: {
          activeProvider: "anthropic",
          hasKey: { anthropic: false, openai: false },
          keyPreview: { anthropic: null, openai: null },
        },
        GET_CHAT_HISTORY: noHistory,
      });

      await import("./index");
      await flushMicrotasks();

      expect((document.getElementById("no-table-banner") as HTMLElement).hidden).toBe(false);
      expect((document.getElementById("key-prompt") as HTMLElement).hidden).toBe(true);
    });

    it("re-gates the composer when the active tab switches from a real table to no table", async () => {
      const chrome = mockChrome({
        GET_SETTINGS: defaultSettingsResponse,
        GET_CHAT_HISTORY: (message: { tabId?: number }) => (message.tabId === 7 ? hasTable : noHistory),
      });

      await import("./index");
      await flushMicrotasks();
      expect((document.getElementById("composer-input") as HTMLInputElement).disabled).toBe(false);

      chrome.setActiveTabId(9);
      chrome.triggerTabActivated();
      await flushMicrotasks();

      expect((document.getElementById("no-table-banner") as HTMLElement).hidden).toBe(false);
      expect((document.getElementById("composer-input") as HTMLInputElement).disabled).toBe(true);
    });
  });
});
