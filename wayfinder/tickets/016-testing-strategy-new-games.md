---
id: 16
title: Validation/testing strategy for extending the generic engine to new games
status: closed
labels: [wayfinder:grilling]
assignee: null
blocked_by: []
---

## Question

The generic-core-plus-plugin architecture (ticket 003) was validated against two games
(Ark Nova, Ticket to Ride) via live, manual devtools inspection. Beyond the initial
games, decide how confidence is built for a new game before shipping a plugin for it:

- Is there a lightweight, repeatable manual process (e.g. a checklist: open devtools on
  a live table, dump `gamedatas` keys, diff against the generic-core field list, note
  what's bespoke) that a plugin author follows, given there's no BGA sandbox/test API to
  automate this against?
- Does the generic-core fallback itself get any automated verification (e.g. a small
  script injected during manual testing that asserts the expected shared keys —
  `gamestate.name`, `possibleactions`, `players`, etc. — are present), or is this purely
  manual given BGA's lack of an official API (ticket 001)?
- What's the bar for "this plugin is good enough to ship" — does it need to handle
  every `gamestate.name` the game can reach, or is partial coverage (with graceful
  degradation to the generic summary for unhandled states) acceptable to start?
- Since this is a personal tool, is there value in a minimal regression check (e.g.
  saved sample `gamedatas` snapshots per game, replayed through the plugin's
  `summarizeState` to catch obvious breakage after a plugin edit) even without a real
  test framework in scope yet?

## Resolution

**Manual discovery, fixture-based regression** — matches the personal-tool scope and
BGA's lack of any test/sandbox API:

- **New-game discovery checklist** (repeatable manual process, same shape as this
  session's live Ark Nova/Ticket to Ride comparison): open devtools on a live table,
  run a one-line snippet dumping `Object.keys(gamedatas)`, diff against the known
  generic-core field list (`gamestate.name`/`possibleactions`, `gamestates`, `players`,
  `notifications`, `playerorder`, `decision`, per ticket 003) to see what's bespoke,
  then note the game-specific keys and inspect a couple of `gamestate.args` shapes for
  the states reachable early in a game. No automation possible here given BGA has no
  official API (ticket 001) — this stays a manual, one-time-per-game exercise.
- **No automated verification against live BGA** — there's nothing to script against
  without a real account/session, so the generic-core field list is a documented
  reference (this ticket + ticket 003), not something continuously checked live.
- **Shipping bar: partial coverage is fine.** A plugin doesn't need to handle every
  `gamestate.name` the game can reach — only the common/early-game states worth
  covering first. Unhandled states fall back to the generic-core summary for that
  specific state, extending the same per-state degrade behavior decided in ticket 014.
  This means a plugin can ship incrementally and improve over time rather than
  blocking on full coverage.
- **Regression check: yes, worth it, kept minimal.** Save a real `gamedatas` JSON
  snapshot per game (captured once during the manual discovery pass) as a fixture
  file, and write a small script that runs each plugin's `summarizeState` against its
  fixture(s) to catch obvious breakage after an edit — no test framework, no CI, just
  a plain script runnable by hand. Cheap enough to be worth it even at this scope.
