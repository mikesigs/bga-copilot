import type { GamePlugin } from "./types";
import { noopPlugin } from "./noopPlugin";
import { arkNovaPlugin } from "./arkNova/arkNovaPlugin";

const plugins: Record<string, GamePlugin> = {
  [arkNovaPlugin.gameSlug]: arkNovaPlugin,
};

/**
 * Selects the per-game plugin for a live game's BGA slug (e.g. "arknova"),
 * falling back to the no-op plugin when none is registered for it.
 */
export function getPlugin(gameSlug: string | undefined): GamePlugin {
  if (!gameSlug) return noopPlugin;
  return plugins[gameSlug] ?? noopPlugin;
}
