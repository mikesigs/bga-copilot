---
id: 4
title: Sidebar mechanism — chrome.sidePanel API vs. injected custom panel
status: closed
labels: [wayfinder:grilling]
assignee: null
blocked_by: []
---

## Question

Decide how the chat sidebar is implemented: Chrome's native Side Panel API
(`chrome.sidePanel`, MV3) vs. a custom DOM panel injected into the BGA page by a
content script (e.g. a fixed-position iframe/div).

Cover the tradeoffs: Side Panel API gives a persistent, extension-managed UI
independent of page layout but is a separate browser-chrome surface (can it read
page state directly, or does it need messaging to a content script?); an injected
panel can sit visually "in" the page and read the DOM/live JS objects directly but
fights with page layout/CSS and BGA's own page updates. Recommend one, with the
messaging architecture (content script <-> background <-> panel) sketched at a level
a build phase can implement from.

## Resolution

**Decision: `chrome.sidePanel` API**, confirmed with the user.

Rationale:
- BGA's own UI already fills the right edge of the screen (player list, chat, action
  buttons — visible directly in the Ark Nova/Ticket to Ride screenshots taken while
  resolving the architecture ticket). An injected custom panel would compete with that
  layout and be fragile against BGA's own CSS/UI changes.
- The side panel is a separate browser-chrome surface entirely outside the page's
  layout — no reflow hacks, no CSS fights.
- A content-script ↔ background messaging relay is required regardless, since the
  `world: "MAIN"` state-extraction script (tickets 001/003) already has to relay
  extracted data out via `postMessage` → content script → background. The side panel's
  inability to touch the page DOM directly costs nothing extra on top of that.
- `chrome.sidePanel.setOptions({tabId, ...})` scopes the panel per tab and can be
  swapped on `chrome.tabs.onActivated`, which directly satisfies "stateful and aware of
  whichever BGA tab/table is currently active" from the original brief, and dovetails
  with the per-table persistence model (ticket 006).

**Architecture:**
1. Content script (isolated world), injected on `boardgamearena.com/*`.
2. On a BGA game table page, the content script injects the MAIN-world extractor via
   `chrome.scripting.executeScript({ world: "MAIN", frameIds: [<gameIframe's frameId>] })`
   to read `window.gameui.gamedatas`.
3. The MAIN-world script `postMessage`s the extracted (JSON-serializable) data back to
   the content script.
4. The content script forwards it to the background service worker via
   `chrome.runtime.sendMessage`, tagged with `tabId` and the BGA table id.
5. The background service worker: caches current state per tab/table, applies the
   per-game plugin (ticket 012) to interpret it, handles LLM calls (ticket 005), and
   routes data to/from the side panel.
6. The side panel (opened per active tab via `chrome.sidePanel.setOptions`) requests
   context from the background and renders the chat UI; it swaps which table's chat it
   shows on `chrome.tabs.onActivated`.
