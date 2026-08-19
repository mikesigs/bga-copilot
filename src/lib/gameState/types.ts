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
  notifications?: RawNotification[];
}
