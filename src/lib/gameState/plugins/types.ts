import type { RawGamedatas, RawGamestate } from "../types";

/**
 * A per-game interpreter of `gamedatas`/`gamestate`'s bespoke, game-specific
 * shape (board, hand, action-card content) into a human-readable summary
 * for the LLM prompt — contributed alongside the generic-core summary
 * (`summarizeGenericState`), which only covers what's shared across every
 * BGA game.
 */
export interface GamePlugin {
  // BGA's internal game slug this plugin handles, e.g. "arknova" (sourced
  // from `gameui.game_name`, surfaced on `gamedatas.gameSlug`).
  gameSlug: string;
  summarizeState(gamedatas: RawGamedatas, gamestate: RawGamestate | undefined): string | null;
  // Per-game translations for internal BGA state/action codes into
  // human-readable text, e.g. "actDiscardScoring" -> "Discard a final
  // scoring card". A plugin is expected to consult its own `codeLookups`
  // from within `summarizeState` (rather than have a caller reach in and
  // read it separately) since only the plugin knows which of its own
  // summary lines, if any, a given code should enrich. Optional — a plugin
  // only needs this if it has codes worth translating.
  codeLookups?: Record<string, string>;
}
