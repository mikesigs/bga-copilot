---
id: 14
title: Error/fallback handling for rulebook and state-extraction failures
status: closed
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

## Resolution

**Never refuse to chat — always degrade and say so via the existing non-blocking
callout pattern**, not a new modal/blocking UI:

- **Rulebook failures** (parse error, empty rules-summary text): the assistant
  responds using whatever context it does have (state-only, or general knowledge), and
  the panel shows a small inline note reusing the same callout style already
  established in the prototype for "couldn't auto-download" (ticket 009) — e.g.
  "Couldn't read the uploaded PDF — try re-uploading, or ask me without rulebook
  context for now." One consistent callout pattern for every rulebook-related problem,
  not a separate UI per failure mode.
- **State extraction failures:** retry a couple of times with a short backoff first
  (covers the known async-load timing race from ticket 001), then degrade in stages:
  a per-game plugin throwing while interpreting a specific state's `args` is caught and
  treated as "no plugin data for this state" — falls back to the generic-core summary
  for that message only (extends ticket 012's degrade-to-generic default to a
  per-state granularity, not just per-game). If `window.gameui` can't be found at all
  (not on a live table, or BGA markup changed), fall back further to pure chat with no
  game context, with a clear small note ("I can't see your game state right now — you
  can still ask general rules questions").
- **Failure visibility:** small, non-blocking inline indicators in the chat flow
  (reusing the callout component), never a blocking banner or modal — consistent with
  wanting this to feel like a reliable companion that degrades gracefully rather than
  interrupting the user every time something's imperfect.
