// The subset of BGA's `window.gameui.gamedatas` shape that's shared across
// every BGA game (per the research in issue #3) — everything else lives in
// per-game `gamestate.args` shapes that need a per-game plugin to interpret.
export interface RawPlayer {
  id?: string;
  name?: string;
  score?: string | number;
}

export interface RawNotification {
  log?: string;
  args?: Record<string, unknown>;
}

export interface RawGamestate {
  name?: string;
  active_player?: string;
  possibleactions?: string[];
  // BGA's own human-readable sentence for the current state, e.g.
  // "${actplayer} must choose an action card" / "${you} must choose an
  // action card" — templated the same way notification log lines are.
  // Confirmed live (Ark Nova, Ticket to Ride, 2026-08-19). Can be "" for a
  // state with nothing to say.
  description?: string;
  descriptionmyturn?: string;
  // "activeplayer" | "multipleactiveplayer" | "manager" | "game" — whether
  // one player, several simultaneously, or an internal engine step governs
  // this state. Confirmed live on both games checked.
  type?: string;
}

export interface RawGamedatas {
  gamestate?: RawGamestate;
  players?: Record<string, RawPlayer>;
  // Confirmed live (Ark Nova, 2026-08-18) that this is NOT a log array in
  // practice — it's `{ last_packet_id, move_nbr }` polling metadata. Typed
  // loosely and checked with Array.isArray at the one call site, since a
  // future BGA version or a different game could plausibly shape it either
  // way and this generic core shouldn't assume either without re-verifying.
  notifications?: RawNotification[] | unknown;
  // Seating/turn order as player ids. Confirmed live on both games checked.
  playerorder?: (string | number)[];
  // Sourced from `gameui.player_id`, a sibling of `gamedatas` rather than a
  // field within it — the id of whoever is actually viewing this browser
  // session, distinct from `gamestate.active_player` (whoever's turn it
  // currently is). Confirmed live (Ticket to Ride, 2026-08-19) this is
  // necessary: without it, "what's my score?" has no way to distinguish
  // "you" from "whoever's turn it is right now".
  viewerPlayerId?: string;
  // Sourced from `gameui.game_name_displayed`, a sibling of `gamedatas`
  // rather than a field within it. Confirmed live on both games checked.
  gameName?: string;
}
