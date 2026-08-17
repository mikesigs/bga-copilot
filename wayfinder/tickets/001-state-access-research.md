---
id: 1
title: How is live game state exposed and accessible for Ark Nova, Darwin's Journey, and Wingspan?
status: closed
labels: [wayfinder:research]
assignee: research-agent
blocked_by: []
---

## Question

For each of Ark Nova, Darwin's Journey, and Wingspan on BoardGameArena:

- Confirm the presence and shape of the per-game `gameui`/`Game` JS instance and its
  `gamedatas` (including `gamedatas.gamestate`) and notification stream, as described
  generically in BGA's Studio docs. Note any per-game deviation from that shared shell.
- Determine how an extension's content script can actually reach that live object,
  given Manifest V3 content scripts normally run in an isolated JS world separate from
  the page's own `window`. Evaluate `chrome.scripting.executeScript` with
  `world: "MAIN"` (or an injected `<script>` tag) as the access mechanism, and note any
  caveats (timing/race with page load, CSP restrictions on the BGA page itself).
  Empirical check: open devtools console on a live game of each title and inspect
  `window` for the live instance.
  - Ark Nova game id/URL: https://boardgamearena.com/gamepanel?game=arknova (adjust as needed)
  - Darwin's Journey game id/URL: https://boardgamearena.com/gamepanel?game=darwinsjourney
  - Wingspan game id/URL: https://boardgamearena.com/gamepanel?game=wingspan
- Compare the three games' state/notification shapes to judge how much of "what's on
  the board, what's in my hand, whose turn, what actions are legal right now" can be
  extracted generically vs. requires game-specific parsing (cross-reference against the
  bga-assistant project's "reconstruct from the log" approach for Innovation/Azul/Crew
  as a precedent).

Report back: per-game findings, a concrete recommendation on the content-script access
mechanism, and an assessment of how far a single generic extractor could get across
these three games before needing per-game logic.

## Resolution

Researched via BGA's public Studio docs, forum threads, GitHub/Greasy Fork projects,
and a direct `curl` check of BGA's live CSP header (2026-08-17). No authenticated BGA
session was available, so nothing here is a direct devtools observation on a live
table of these three games — flagged throughout as inferred vs. observed.

**Shared shell (generic across all BGA games, documented):** every game's client
instantiates a `Game`/`gameui`-style object seeded by `gamedatas` from the server,
including a universally-shaped `gamedatas.gamestate` (`name`, `args`,
`possible_actions`) and a universal notification/log stream (`type`, `args`, `log`,
processed in order via `notif_<type>` handlers). Legacy (pre-"Studio 2.0") games
exposed this as a bare `window.gameui` global; newer migrated games wrap it as
`this.bga.gameui`. Whether Ark Nova / Darwin's Journey / Wingspan specifically still
expose a reachable global (and under what name) is **unverified — requires opening
devtools on a live table of each**.

**MV3 access mechanism — recommended:** `chrome.scripting.executeScript({ world:
"MAIN" })` to run extraction code in the page's real JS context, relayed back to the
extension via `window.postMessage` → an isolated-world content script listener →
`chrome.runtime.sendMessage`. BGA's live CSP (`'unsafe-inline' 'unsafe-eval'`,
observed directly) is permissive enough not to block this. Caveats: must wait past
`document_idle` and poll/retry since the game object loads asynchronously; MAIN-world
code has no `chrome.*` API access, only `postMessage`; complex `gamedatas` values must
be JSON-serialized before relaying (structured-clone limits).

**Existing community tooling per game:** no tool found for any of the three that reads
a live `gameui` object directly. Ark Nova and Wingspan community tools are either
manual/offline companion apps or replay/move-log scrapers (e.g.
`bskinn/bga-wingspan-scraper` operates on BGA's replay viewer, not a live table).
Darwin's Journey (BGA alpha since Aug 2024) has no known tooling at all. The closest
multi-game precedent, `AnotherSava/bga-assistant`, deliberately avoids live-object
reads entirely and reconstructs state purely from the notification/log stream, with
fully bespoke per-game reconstruction logic for each of its three supported games
(Innovation, Azul, The Crew) — no MAIN-world permissions in its manifest at all.

**Generic-vs-plugin assessment (feeds ticket "Generic state-extraction engine
vs. per-game plugin architecture"):** a generic core can reliably deliver, with no
per-game code: whose turn it is, the current state name, the list of legal *action
names* (not resolved targets), and raw player/score metadata — all part of the
documented universal shape. Board/hand/tableau content and fully-resolved legal move
targets (e.g. which specific cells/cards are currently clickable) live in
game-specific `gamedatas.args` fields and per-game DOM/CSS conventions with no shared
schema, and will need a per-game plugin — mirroring bga-assistant's per-game
reconstruction layers. Recommendation: **generic core (live-object turn/state/log
primitives) + per-game plugin layer for semantic board/hand content**, with the
notification stream kept as a fallback/delta mechanism rather than the sole source of
truth (unlike bga-assistant's log-only approach), since re-deriving full board state
from history alone is expensive for these tableau-heavy games.

Full agent report on file; empirical devtools verification against live Ark Nova,
Darwin's Journey, and Wingspan tables remains an open follow-up before implementation
begins.

**Addendum (from ticket 011's live-session check):** the game itself runs inside
`<iframe id="gameIframe">` on the table page, not the top-level document. Any MV3
`world: "MAIN"` script injection to reach `gameui`/`gamedatas` must target that iframe
specifically via `chrome.scripting.executeScript`'s `frameIds` option, not the
top-level frame.
