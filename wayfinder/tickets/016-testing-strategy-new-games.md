---
id: 16
title: Validation/testing strategy for extending the generic engine to new games
status: open
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
