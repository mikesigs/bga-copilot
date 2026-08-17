---
id: 5
title: LLM provider abstraction and API key storage
status: closed
labels: [wayfinder:grilling]
assignee: null
blocked_by: []
---

## Question

The user has already chosen "cloud API with my own key" over local/open models. Decide:

- Which provider(s) to support at MVP (e.g. Anthropic only, or Anthropic + OpenAI via a
  thin provider interface) — both support direct browser calls (Anthropic's
  `anthropic-dangerous-direct-browser-access` header, OpenAI's
  `dangerouslyAllowBrowser`), so either is technically viable from a background service
  worker.
- Where/how the API key is stored (`chrome.storage.local` vs `chrome.storage.sync`),
  and what security tradeoffs that implies (sync replicates the key to Google's
  servers/other devices; local does not leave the machine).
- Required `content_security_policy`/`host_permissions` entries for the chosen
  provider endpoint(s).
- Whether the provider choice is fixed at build time or user-configurable via a
  settings UI (ties into the "onboarding/settings UX" item in the map's fog).

## Resolution

**Decision, confirmed with user:**
- **Support both Anthropic and OpenAI at MVP**, user-selectable, via a thin provider
  interface — not a single hardcoded provider.
- **Store the API key(s) in `chrome.storage.local`**, not `sync` — stays on-machine
  only, never replicated to Google's servers. Tradeoff accepted: re-entering the key
  is required on a new device/profile.

**Provider interface sketch:** a small common shape both providers implement, e.g.
`sendChatMessage({ systemPrompt, history, userMessage, apiKey }) -> assistantReply`,
with a per-provider module translating to that provider's actual request format
(Anthropic Messages API vs. OpenAI Chat Completions). The settings UI stores which
provider is active plus that provider's key, keyed separately (e.g.
`{ activeProvider: "anthropic", keys: { anthropic: "...", openai: "..." } }`) so
switching providers doesn't require re-entering a key already saved for the other one.

**Browser-direct-call mechanics** (from earlier research): both vendors support
calling their API directly from client-side/browser code, not just server-to-server:
- Anthropic requires the request header `anthropic-dangerous-direct-browser-access: true`.
- OpenAI's JS SDK requires the client option `dangerouslyAllowBrowser: true`.
Both call this out as a deliberate, supported (if security-sensitive) pattern — not a
workaround. This call happens from the **background service worker**, not the side
panel or content script, to keep the key out of any page-adjacent context.

**Manifest requirements:**
- `host_permissions`: `https://api.anthropic.com/*`, `https://api.openai.com/*`.
- `content_security_policy.extension_pages`: `connect-src 'self' https://api.anthropic.com https://api.openai.com`.

**Settings/onboarding UX** (flagged in the map's fog as still needing its own design
pass): a preferences view in the side panel (or a dedicated options page) where the
user picks the active provider and pastes in that provider's key; the key is validated
with a lightweight test call before being saved, and the UI plainly discloses that the
key lives in browser storage in cleartext (an inherent property of the
`dangerouslyAllowBrowser`-style pattern, not something this extension can fully harden
away) so the user's expectations match reality.
