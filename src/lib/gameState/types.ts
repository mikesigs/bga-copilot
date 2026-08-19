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
}
