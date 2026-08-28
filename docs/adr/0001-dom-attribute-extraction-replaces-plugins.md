---
status: accepted
---

# DOM-attribute extraction + LLM interpretation replaces per-game plugins

Board Semantics were originally handled by a per-game plugin architecture (mikesigs/bga-copilot#5, #14, #26): a static registry of hand-authored `GamePlugin` modules, each mapping a game's `gamedatas`/`gamestate.args` JSON and numeric codes into a text summary via hard-coded lookup tables. That design was chosen empirically — comparing Ark Nova and Ticket to Ride showed `gamedatas` has zero overlapping keys across games, and numeric codes (card type, route color, building type) have no self-describing label anywhere in the API response, so no generic parser could interpret them without per-game knowledge.

We're reversing that decision. The plugin model's real cost is that a human has to author and maintain a bespoke plugin per game, which doesn't scale across BGA's catalog — after #26 shipped, only one plugin (Ark Nova) was ever built, and it went unused. Instead, Board Semantics are now surfaced by reading Semantic DOM Attributes (`data-id`/`data-name`) that BGA game authors already attach to rendered board elements, and handing that extracted content to the LLM to interpret at prompt time — no per-game static lookup tables, no per-game code. This pattern has been empirically validated across three games, a stronger evidence base than the two-game comparison that originally justified plugins.

The Generic Core (turn state, legal actions, notifications, players — read from `window.gameui.gamedatas`) is unaffected by this decision.

## Considered options

- **Keep the plugin architecture, add more plugins over time.** Rejected — doesn't scale with a single maintainer across BGA's game catalog.
- **Generic parsing of `gamedatas`/`gamestate.args` without an LLM.** Rejected in #5/#14 — no shared schema across games, opaque numeric codes with no derivable label.
- **DOM-attribute extraction + LLM interpretation (chosen).** Human-legible strings already exist in the rendered DOM; the LLM absorbs the interpretation work instead of a hand-authored lookup table.

## Consequences

- The plugin infrastructure (`src/lib/gameState/plugins/`: registry, `noopPlugin`, `arkNovaPlugin`) is deleted — the Ark Nova plugin was unused, nothing worth preserving as a fallback.
- Board-semantics correctness is no longer guaranteed by construction (a human-verified lookup table); occasional LLM misreads of DOM text are acceptable as long as the assistant degrades gracefully and never falsely claims confidence — the same philosophy #14 established for the no-plugin fallback case.
- The concrete DOM-extraction heuristic (scan scope, which attributes/text to capture, noise filtering, size/token budget, capture cadence) is intentionally left open — deferred to a prototyping spike, not decided here.
