---
id: 6
title: Per-game-table chat persistence data model
status: closed
labels: [wayfinder:grilling]
assignee: null
blocked_by: []
---

## Question

The destination requires chat to persist per BGA game-table across sessions (survive
tab close/reload) until the game ends. Decide:

- What key identifies a "game table" (BGA's table id from the URL/page?) and how it's
  captured reliably.
- Storage mechanism (`chrome.storage.local` keyed by table id) and rough shape of what's
  stored (raw chat turns? also cached extracted game-state snapshots or rulebook text?).
- What triggers cleanup/expiry (game marked finished, table archived, a manual "clear"
  action, or a time-based TTL) so storage doesn't grow unbounded across many games
  played over time.
- Behavior if the user reopens a finished/archived game table later — is history still
  viewable, read-only?

## Resolution

**Table identity:** confirmed live — `window.gameui.table_id` (numeric, e.g.
`900372479`) is directly available once the game object exists, matching the `table=`
query param in the URL. `window.gameui.game_id` (numeric, e.g. `1741`) and the game
slug (e.g. `arknova`, readable from the URL/gamepanel) identify which game/plugin
applies. The URL param is a fallback for the brief window before `gameui` finishes
loading.

**Storage:** `chrome.storage.local`, one record per table, keyed
`bga_copilot:table:<table_id>`. Shape:

```js
{
  tableId: 900372479,
  gameId: 1741,
  gameSlug: "arknova",
  status: "active" | "finished",
  createdAt: <timestamp>,
  lastActiveAt: <timestamp>,
  messages: [ { role: "user"|"assistant", content: "...", timestamp: <t> }, ... ],
  cachedRulebookExcerpt: { sourceUrl, text, fetchedAt } | null
}
```
Raw chat turns and the on-demand rulebook cache (ticket 007) live together since both
are scoped to the table; live game-state snapshots are *not* persisted here — they're
re-extracted from the live page each time (cheap, and avoids storing stale data).

**Finish detection:** BGA's state machine includes a standard `gameEnd` state name as
part of its shared framework template (confirmed present in Ark Nova's `gamestates`
list alongside dozens of game-specific states) — when `gamestate.name === "gameEnd"`
is observed, mark the record `status: "finished"`. This is expected to be a generic,
game-independent signal since it comes from BGA's base state machine, not authored
per-game (unverified across all games, but consistent with the shared-framework
pattern established in ticket 003).

**Cleanup:** two layers, since `gameEnd` detection could miss abandoned/aborted
tables that never reach that state:
1. On detecting `status: "finished"`, keep the record but stop attempting further
   state extraction for that table.
2. A time-based sweep (e.g. on extension startup) deletes any record whose
   `lastActiveAt` is older than a fixed TTL (suggest 90 days) regardless of status, as
   a backstop against unbounded storage growth.
A manual "clear this game's chat" action in the side panel is left as a UI nicety, not
required for the core model.

**Reopening a finished table:** history renders read-only (no new state extraction
attempted, no new assistant replies generated against stale state) unless the user
explicitly asks a question, in which case only chat history + cached rulebook context
is used (no live game state, since none exists for a finished table).
