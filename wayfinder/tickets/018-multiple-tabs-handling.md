---
id: 18
title: Handling multiple simultaneous BGA game tabs/tables
status: closed
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

## Resolution

**No special handling needed beyond what's already decided** — this ticket confirms
existing decisions cover it rather than introducing new mechanisms:

- **Different tables in different tabs:** already handled for free. Ticket 004's
  per-tab content script + per-tab side-panel scoping, combined with ticket 006's
  per-table-id storage keys, means each tab's extraction/relay/chat is independently
  isolated with no shared state to coordinate.
- **Same table open in two tabs at once:** chat history stays consistent since storage
  is keyed by table id, not tab id (ticket 006) — both tabs read/write the same
  record. A race where both tabs extract/relay state at the same moment is possible in
  theory, but this is a rare, low-stakes scenario for a personal tool (deliberately
  duplicating a tab onto the same table is unusual), and the worst case is a stale or
  duplicate message rather than data loss. Not worth a locking mechanism at this
  scope — accepted as a known, low-priority edge case rather than solved.
- **Background service worker load:** personal BGA usage tops out at a handful of
  concurrent tabs; MV3 service workers handle that level of concurrent message
  traffic natively. No queuing or throttling needed.
