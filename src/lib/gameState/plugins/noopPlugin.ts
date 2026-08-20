import type { GamePlugin } from "./types";

/**
 * Default plugin for any BGA game with no game-specific plugin registered —
 * contributes nothing beyond the generic-core summary.
 */
export const noopPlugin: GamePlugin = {
  gameSlug: "",
  summarizeState: () => null,
};
