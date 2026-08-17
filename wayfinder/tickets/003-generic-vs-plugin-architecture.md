---
id: 3
title: Generic state-extraction engine vs. per-game plugin architecture
status: closed
labels: [wayfinder:grilling]
assignee: user-session
blocked_by: [1]
---

## Question

Given the findings from "How is live game state exposed and accessible for Ark Nova,
Darwin's Journey, and Wingspan?", decide: does BGA Copilot ship with a single generic
state-extraction engine, a generic engine plus a thin per-game plugin/adapter layer for
semantic content (cards/pieces/board zones), or fully bespoke per-game modules?

Cover: what the generic core guarantees (turn state, notification/move log, gamestate
name) vs. what a plugin would need to supply per game; how a plugin is
registered/loaded (e.g. keyed by BGA's game identifier); and what happens for a game
with no plugin yet (degrade to generic-only context, or refuse gracefully).

Note: the user has a live authenticated session and offered to compare real DOM/state
structure across their own active games. Darwin's Journey isn't currently active, so
**Ticket to Ride** stands in for it as the third comparison point (alongside Ark Nova
and Wingspan) for this ticket's empirical check.

## Resolution

**Decision: generic core + per-game plugin layer.** Confirmed empirically by reading
`window.gameui.gamedatas` live, inside `#gameIframe`, for both Ark Nova and Ticket to
Ride (via `chrome`-equivalent devtools access through the browser tool, read-only, no
game actions taken).

**Generic core (identical top-level keys observed in both games — safe to build
without any per-game code):**
- `gamestate.name` — current state id (e.g. `"chooseAction"`, `"chooseActionCard"`)
- `gamestate.possibleactions` — array of legal action *names* (not resolved targets)
- `gamestates` — the full state-machine definition dictionary
- `players` — base fields (`id`, `score`, `playerNo`, `color`, `name`, `zombie`,
  `eliminated`, `is_ai`, `avatar`); games merge in extra per-game stat fields (e.g.
  Ticket to Ride's `trainCarsCount`) alongside these, which the plugin layer can
  surface or ignore
- `notifications`, `playerorder`, `tablespeed`, `decision`,
  `game_result_neutralized`/`neutralized_player_id` — session/control-level fields
- Access mechanism (per ticket 001, confirmed): MV3 `world: "MAIN"` script targeting
  `#gameIframe` via `frameIds`, reading `window.gameui.gamedatas`, relayed out via
  `postMessage`.

**Per-game plugin responsibilities (everything else — confirmed to differ completely
between the two games, zero key overlap):**
- The rest of top-level `gamedatas`: Ticket to Ride has `handTrainCars`,
  `handDestinations`, `visibleTrainCards`, `claimedRoutes`, `builtStations`,
  `completedDestinations`, etc.; Ark Nova has `cards`, `buildings`, `meeples`,
  `deckCount`, `conservationBonuses`, `maxAppeal`, etc. No shared schema — a plugin
  must know its own game's key names and turn them into a human-readable summary for
  the LLM prompt (e.g. "You have 8 train cars in hand: 4 blue, 2 red...").
- `gamestate.args` — shape is bespoke **per game AND per state within that game**.
  Ticket to Ride's `chooseAction`-adjacent args include a fully-resolved
  `possibleRoutes` list (route ids, map coordinates, color codes); Ark Nova's
  `chooseActionCard` args have an unrelated shape (`cards`, `strengths`, `xtokens`,
  `xtoken`, `previousEngineChoices`...). A plugin needs a lookup keyed by
  `(game, gamestate.name)` to interpret args correctly.
- Numeric/id code translation — card `type`, route `color`, building type, etc. are
  opaque integers with no self-describing label; each plugin needs a small static
  lookup table (game asset data, not derivable from the API response itself).
- Plugin registration: keyed by BGA's own game slug (e.g. `arknova`, `ticket2ride`),
  matching the identifier already present in game URLs.
- No-plugin fallback: **degrade to generic-only context, don't refuse.** For any game
  without a plugin yet, the assistant still gets turn/state/action-name/notification-
  log context and should say so plainly in its answers (e.g. "I don't have detailed
  board knowledge for this game yet, but here's what I can see..."), rather than
  being unusable until every game gets bespoke code.

Good confidence from two structurally different games (route-building vs.
card-engine/tableau); Wingspan wasn't checked but nothing in the findings suggests a
third game would break this pattern — the framework-level fields are clearly injected
by BGA's shared base client, not something each game author could plausibly recreate
differently by convention.
