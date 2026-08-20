import type { RawGamedatas } from "../../types";
import type { GamePlugin } from "../types";
import type { ArkNovaCard, ArkNovaGamedatas } from "./types";

// Observed live (2026-08-20, see `fixtures/liveGamedatas.json`) — expand as
// more states/actions are confirmed live.
const CODE_LOOKUPS: Record<string, string> = {
  discardScoring: "Discard a final scoring card",
  actDiscardScoring: "Discard a final scoring card",
};

function describeCard(card: ArkNovaCard): string {
  switch (card.type) {
    case "animal":
      return `${card.name} (animal, cost ${card.cost}, appeal ${card.appeal})`;
    case "sponsor":
      return `${card.name} (sponsor, level ${card.lvl})`;
    case "project":
      return `${card.name} (conservation project)`;
    default:
      return card.name ?? card.id;
  }
}

/**
 * Interprets Ark Nova's bespoke `gamedatas` shape (board, hand, action
 * cards) into a human-readable summary for the viewing player, injected
 * alongside the generic-core summary. Ark Nova's hand contents are
 * privacy-scoped by BGA itself — only the viewing player's own `hand` array
 * is ever populated; opponents' hands come through as an empty array with a
 * separate `handCount`, so there's no risk of leaking hidden information
 * here.
 */
export const arkNovaPlugin: GamePlugin = {
  gameSlug: "arknova",
  codeLookups: CODE_LOOKUPS,

  summarizeState(gamedatas, gamestate) {
    const raw = gamedatas as RawGamedatas & ArkNovaGamedatas;
    const viewerId = raw.viewerPlayerId;
    if (!viewerId) return null;

    const viewer = raw.players?.[viewerId];
    if (!viewer) return null;

    const ownedByViewer = (pId: string | number | null | undefined) => String(pId) === viewerId;

    const lines: string[] = [];

    if (gamestate?.name) {
      const friendlyState = CODE_LOOKUPS[gamestate.name];
      if (friendlyState) lines.push(`Current action needed: ${friendlyState}`);
    }
    if (gamestate?.possibleactions?.length) {
      const friendlyActions = gamestate.possibleactions
        .map((action) => CODE_LOOKUPS[action])
        .filter((label): label is string => Boolean(label));
      if (friendlyActions.length) lines.push(`Available actions: ${friendlyActions.join(", ")}`);
    }

    const zooCards = (raw.cards ?? []).filter((card) => ownedByViewer(card.pId) && card.location === "inPlay");
    const animals = zooCards.filter((card) => card.type === "animal");
    const sponsors = zooCards.filter((card) => card.type === "sponsor");
    if (animals.length) {
      lines.push(`Animals in your zoo (${animals.length}): ${animals.map((card) => card.name).join(", ")}`);
    }
    if (sponsors.length) lines.push(`Sponsors in play: ${sponsors.map((card) => card.name).join(", ")}`);

    const buildings = (raw.buildings ?? []).filter((building) => ownedByViewer(building.pId));
    if (buildings.length) {
      const counts = new Map<string, number>();
      for (const building of buildings) {
        const type = building.type ?? "unknown";
        counts.set(type, (counts.get(type) ?? 0) + 1);
      }
      const summary = Array.from(counts.entries())
        .map(([type, count]) => `${count} ${type}`)
        .join(", ");
      lines.push(`Buildings: ${summary}`);
    }

    const stats = [
      viewer.money !== undefined ? `money ${viewer.money}` : null,
      viewer.reputation !== undefined ? `reputation ${viewer.reputation}` : null,
      viewer.appeal !== undefined ? `appeal ${viewer.appeal}` : null,
      viewer.conservation !== undefined ? `conservation ${viewer.conservation}` : null,
    ].filter((entry): entry is string => Boolean(entry));
    if (stats.length) lines.push(`Your stats: ${stats.join(", ")}`);

    if (raw.break !== undefined && raw.maxBreak !== undefined) {
      lines.push(`Break progress: ${raw.break}/${raw.maxBreak}`);
    }

    if (viewer.hand?.length) {
      const handLines = viewer.hand.map((card) => `- ${describeCard(card)}`).join("\n");
      lines.push(`Your hand (${viewer.hand.length} cards):\n${handLines}`);
    }

    if (viewer.actionCards?.length) {
      const actionLines = viewer.actionCards
        .map((card) => `- ${card.name}: level ${card.level}, strength ${card.strength}`)
        .join("\n");
      lines.push(`Your action cards:\n${actionLines}`);
    }

    return lines.length ? lines.join("\n\n") : null;
  },
};
