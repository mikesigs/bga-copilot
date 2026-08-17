---
id: 18
title: Handling multiple simultaneous BGA game tabs/tables
status: open
labels: [wayfinder:grilling]
assignee: null
blocked_by: []
---

## Question

Ticket 004 already scopes the side panel per active tab via `chrome.tabs.onActivated`,
and ticket 006 keys chat/state per BGA table id. Decide the remaining edge cases:

- If the user has two different BGA tables open in two different browser tabs (e.g.
  Ark Nova in one, Ticket to Ride in another) and switches between them, does the
  extraction/relay pipeline (content script per tab, per ticket 004's architecture)
  need any coordination, or does per-tab isolation already handle this for free?
- What if the *same* table is somehow open in two tabs at once (e.g. duplicated tab) —
  does chat history stay consistent (it should, since storage is keyed by table id, not
  tab id), and could two tabs both trying to extract/relay state simultaneously cause
  any race condition worth guarding against?
- Background service worker load: does handling N simultaneous tabs' state-extraction
  and LLM-call routing need any queuing, or is BGA usage (a handful of tabs at most,
  personal use) clearly within "no special handling needed" territory?
