---
id: 15
title: Onboarding/settings UX for the LLM API key
status: open
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
