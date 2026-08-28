# BGA Copilot

A browser extension that gives an LLM assistant live context about a Board Game Arena (BGA) game in progress, so it can answer questions and offer advice during play.

## Language

**Generic Core**:
The game-state context available identically across every BGA game — turn state, legal action names, notification log, and player list — read from BGA's own `gamedatas`/`gamestate` objects via the injected content script.
_Avoid_: base state, common data

**Board Semantics**:
The per-game meaning of a specific board: what a player's hand cards are, what a route or building represents, what a token count means. Not derivable generically from `gamedatas` — per-game key names and numeric codes have no shared schema or self-describing label across games.
_Avoid_: game-specific data, plugin data

**Semantic DOM Attributes**:
`data-id` and `data-name` (and similar) HTML attributes that BGA game authors already attach to rendered board elements, carrying human-legible identifiers independent of the opaque `gamedatas` JSON. This is the mechanism used to surface Board Semantics to the LLM without hand-authored per-game code — see [ADR-0001](docs/adr/0001-dom-attribute-extraction-replaces-plugins.md).
_Avoid_: data attributes (too generic — this is the specific BGA authoring convention)
