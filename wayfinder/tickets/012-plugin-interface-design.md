---
id: 12
title: Per-game plugin interface design
status: closed
labels: [wayfinder:grilling]
assignee: null
blocked_by: []
---

## Question

Given the generic-core-plus-per-game-plugin architecture decided in "Generic
state-extraction engine vs. per-game plugin architecture", design the actual plugin
contract:

- What shape does a plugin export/implement? (e.g. a function that takes the raw
  `gamedatas` + current `gamestate` and returns a normalized "human-readable game
  summary" object/string for prompt assembly.)
- How does a plugin handle the fact that `gamestate.args` shape varies *per state
  within a game*, not just per game — does the plugin register per-state handlers
  keyed by `gamestate.name`, or one big interpreter function per game?
- Where do per-game static lookup tables (numeric code → label, e.g. card type/color
  translations) live, and how are they authored/maintained (hand-written per game,
  scraped from the game's own client assets, etc.)?
- How/where are plugins packaged in the extension (bundled at build time vs. loaded
  dynamically), and how is a plugin matched to the live game (BGA's game slug, read
  from the page URL or `gamedatas`)?
- What exactly does "degrade to generic-only" look like in code — a default no-op
  plugin, or a branch in the prompt-assembly step that checks plugin availability?

## Resolution

Confirmed with user.

**Shape:** each plugin is a module exporting:
```js
{
  gameSlug: "arknova",
  summarizeState(gamedatas, gamestate) -> string,   // human-readable summary for the prompt
  codeLookups: { cardType: {...}, color: {...}, ... }
}
```
`summarizeState` internally dispatches on `gamestate.name` to per-state handler
functions (a small registry inside the plugin itself), since `gamestate.args` shape
varies per state within a game, not just across games (confirmed in ticket 003).

**Static lookup tables:** hand-authored per game as plain bundled JS/JSON assets, not
scraped or reverse-engineered from the game's client at runtime — simpler and safer,
at the cost of manual authoring effort per game.

**Packaging:** all plugins bundled into the extension at build time; matched to the
live game by its BGA slug (already confirmed available via `gameui`, e.g.
`"arknova"`, per ticket 006). No dynamic/remote plugin loading — avoids the
remote-code-execution concerns Chrome Web Store review flags, and keeps this
forward-compatible with the eventual publishing goal.

**Degrade-to-generic:** implemented as a default no-op plugin satisfying the same
interface (its `summarizeState` returns only the generic-core summary — turn, state
name, action names, recent log). The plugin registry falls back to this default when
the current game's slug has no registered plugin, so the rest of the pipeline (context
assembly, ticket 007) never needs its own "is there a plugin" branch — it always calls
`summarizeState` on whatever plugin the registry resolves.
