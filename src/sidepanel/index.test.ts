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

// `message` (specifically its `messages` chat-history array) is mutated by
// the panel after this call returns, so recording the live reference (vi.fn's
// default) would let later assertions see later mutations. Each call is
// snapshotted with structuredClone before returning, capturing the value as
// of the call.
function mockChrome(responses: Record<string, unknown>): { type: string }[] {
  const calls: { type: string }[] = [];
  const sendMessage = vi.fn((message: { type: string }, callback: (response: unknown) => void) => {
    calls.push(structuredClone(message));
    callback(responses[message.type]);
  });
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: { sendMessage, lastError: undefined },
  };
  return calls;
}

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const defaultSettingsResponse = {
  activeProvider: "anthropic",
  hasKey: { anthropic: true, openai: false },
  keyPreview: { anthropic: "sk-...abcd", openai: null },
};

describe("sidepanel chat", () => {
  beforeEach(() => {
    vi.resetModules();
    setupDom();
  });

  afterEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it("sends the typed message and renders the provider's reply", async () => {
    const calls = mockChrome({
      GET_SETTINGS: defaultSettingsResponse,
      SEND_CHAT_MESSAGE: { ok: true, text: "42" },
    });

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
    expect(calls).toContainEqual({
      type: "SEND_CHAT_MESSAGE",
      messages: [{ role: "user", content: "what's my score?" }],
    });
  });

  it("sends a quick-action chip's canned prompt", async () => {
    mockChrome({
      GET_SETTINGS: defaultSettingsResponse,
      SEND_CHAT_MESSAGE: { ok: true, text: "Try building an engine." },
    });

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
    mockChrome({
      GET_SETTINGS: defaultSettingsResponse,
      SEND_CHAT_MESSAGE: { ok: false, error: "Could not reach Anthropic: network down" },
    });

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

  it("disables the composer and quick actions while no key is configured for the active provider", async () => {
    mockChrome({
      GET_SETTINGS: {
        activeProvider: "anthropic",
        hasKey: { anthropic: false, openai: false },
        keyPreview: { anthropic: null, openai: null },
      },
    });

    await import("./index");
    await flushMicrotasks();

    expect((document.getElementById("composer-input") as HTMLInputElement).disabled).toBe(true);
    expect((document.getElementById("composer-send") as HTMLButtonElement).disabled).toBe(true);
    for (const chip of document.querySelectorAll<HTMLButtonElement>(".quick-action")) {
      expect(chip.disabled).toBe(true);
    }
  });
});
