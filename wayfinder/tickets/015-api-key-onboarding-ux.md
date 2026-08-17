---
id: 15
title: Onboarding/settings UX for the LLM API key
status: closed
labels: [wayfinder:grilling]
assignee: null
blocked_by: []
---

## Question

Ticket 005 decided both Anthropic and OpenAI are supported, user-selectable, with keys
in `chrome.storage.local`. Design the actual settings flow:

- Where does this live — inside the side panel itself (a settings icon/view) or a
  separate `chrome://extensions` options page? (The side panel is the only UI surface
  decided so far per ticket 009's two-view design — Chat and Rulebook management — so
  this may need to become a third view, or live under one of those.)
- What happens on first install / first open before any key is configured — does the
  chat view show a blocking "add your API key to get started" state?
- Key validation: is a lightweight test call made before saving (to catch a bad key
  early), and what does the panel show if validation fails?
- Copy/disclosure: how plainly does the UI state that the key lives in browser storage
  in cleartext (an inherent property of the browser-direct-call pattern, per ticket
  005), so the user's expectations match reality?
- Switching providers later: does changing the active provider preserve both providers'
  saved keys (so switching back doesn't require re-entry), per ticket 005's storage
  shape?

## Resolution

Confirmed with user.

- **Location:** a settings icon in the panel header opens an in-panel settings view —
  not a separate `chrome://extensions` options page. Keeps everything in the single
  side-panel surface alongside the Chat and Rulebook views from ticket 009, rather than
  adding a third external surface.
- **First-run state:** the Chat view shows a blocking inline prompt ("Add your API key
  to get started") until a key is saved, rather than a generic/confusing error the
  first time the user opens the panel.
- **Validation:** a lightweight test call is made before saving a key; on failure, show
  an inline error and keep the key field editable rather than silently persisting an
  invalid key.
- **Disclosure:** one plain sentence directly in the settings view — "Your key is
  stored only in this browser and sent directly to `<provider>`, never to us or any
  other server. Treat it like a password." — matching reality of the
  `dangerouslyAllowBrowser`-style pattern from ticket 005, no fine print.
- **Switching providers:** both providers' keys persist independently in
  `chrome.storage.local` (per ticket 005's `{ activeProvider, keys: {...} }` shape);
  switching the active provider only re-prompts for a key if that provider doesn't
  have one saved yet.
