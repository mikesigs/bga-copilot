---
id: 14
title: Error/fallback handling for rulebook and state-extraction failures
status: open
labels: [wayfinder:grilling]
assignee: null
blocked_by: []
---

## Question

Decide the failure-handling behavior for the two main things that can go wrong
client-side:

- **Rulebook acquisition fails**: an uploaded PDF fails to parse (corrupt file, scanned
  image with no text layer, pdf.js error), or BGA's same-origin "Rules summary" text is
  empty/missing for a game. What does the chat surface to the user, and does the
  assistant still respond using whatever context it does have (state-only) rather than
  refusing outright?
- **State extraction fails**: the MAIN-world script can't find `window.gameui` (timing
  race, BGA markup change, game not yet loaded), or the per-game plugin throws while
  interpreting `gamedatas`. Does the extension retry, fall back to the generic-core
  summary only, fall back further to no game context at all (pure chat), or surface an
  explicit error state in the panel?
- Should any of these failures be silent-with-a-small-indicator (e.g. a muted icon) or
  require an explicit acknowledgement/banner, given this is meant to feel like a
  reliable companion, not a flaky tool?
