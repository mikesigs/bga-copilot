// The subset of Ark Nova's bespoke `gamedatas` shape this plugin reads.
// Confirmed live against a real Ark Nova table (2026-08-20, see
// `fixtures/liveGamedatas.json`) — BGA's own `readGamedatasJson` (in
// `../../extract.ts`) spreads the entire raw `gamedatas` object through
// untyped, so these per-game fields are genuinely present at runtime even
// though `RawGamedatas` (the generic-core type) doesn't declare them.
export interface ArkNovaCard {
  id: string;
  name?: string;
  // "animal" | "sponsor" | "project" | "scoring" | "baseProject" | ...
  type?: string;
  location?: string;
  pId?: string | number | null;
  cost?: number;
  appeal?: number;
  // Sponsor cards' level, confirmed live.
  lvl?: number;
}

export interface ArkNovaActionCard {
  name?: string;
  level?: number;
  strength?: number;
}

export interface ArkNovaBuilding {
  type?: string;
  pId?: string | number;
}

export interface ArkNovaPlayer {
  hand?: ArkNovaCard[];
  actionCards?: ArkNovaActionCard[];
  money?: number;
  reputation?: number;
  appeal?: number;
  conservation?: number;
}

export interface ArkNovaGamedatas {
  cards?: ArkNovaCard[];
  buildings?: ArkNovaBuilding[];
  players?: Record<string, ArkNovaPlayer>;
  break?: number;
  maxBreak?: number;
}
