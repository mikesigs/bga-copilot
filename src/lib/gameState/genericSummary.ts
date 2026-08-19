import type { RawGamedatas, RawGamestate, RawNotification, RawPlayer } from "./types";

const MAX_LOG_LINES = 10;

const STATE_TYPE_LABELS: Record<string, string> = {
  activeplayer: "single player's turn",
  multipleactiveplayer: "multiple players acting simultaneously",
  manager: "internal game transition",
  game: "internal game step",
};

function substituteTemplate(template: string, resolve: (key: string) => string | undefined): string {
  return template.replace(/\$\{(\w+)\}/g, (match, key: string) => resolve(key) ?? match);
}

function renderLogLine(notification: RawNotification): string | null {
  if (!notification.log) return null;
  return substituteTemplate(notification.log, (key) => {
    const value = notification.args?.[key];
    return value !== undefined ? String(value) : undefined;
  });
}

// BGA's own human-readable sentence for the current state — templated with
// ${actplayer}/${you} the same way notification logs are templated with
// per-notification args. Uses descriptionmyturn (which addresses the active
// player directly) when it's the viewer's own turn, description otherwise.
function renderStateDescription(
  gamestate: RawGamestate,
  players: Record<string, RawPlayer>,
  viewerPlayerId: string | undefined,
): string | null {
  const isViewerTurn = viewerPlayerId !== undefined && gamestate.active_player === viewerPlayerId;
  const template = isViewerTurn ? gamestate.descriptionmyturn : gamestate.description;
  if (!template) return null;

  const activePlayerName = gamestate.active_player ? players[gamestate.active_player]?.name : undefined;
  return substituteTemplate(template, (key) => {
    if (key === "actplayer") return activePlayerName;
    if (key === "you") return "You";
    return undefined;
  });
}

/**
 * Turns the generic-core slice of `gamedatas` (shared across every BGA game)
 * into a plain-text summary for the LLM prompt. Per-game board/hand content
 * lives in bespoke `gamestate.args` shapes and needs a per-game plugin
 * (a later ticket) — this only covers game name, whose turn it is, the
 * state (name, description, type), legal action names, turn order, players,
 * and the recent notification log.
 */
export function summarizeGenericState(gamedatas: RawGamedatas | null): string | null {
  if (!gamedatas) return null;

  const lines: string[] = [];
  const players = gamedatas.players ?? {};

  if (gamedatas.gameName) lines.push(`Game: ${gamedatas.gameName}`);

  // `viewerPlayerId` (from `gameui.player_id`, a sibling of `gamedatas`) is
  // who's actually asking — distinct from `active_player`, whoever's turn it
  // currently is. Without stating this explicitly, "what's my score?" has no
  // way to resolve to the viewer rather than the active player.
  const viewerPlayerId = gamedatas.viewerPlayerId;
  const viewerName = viewerPlayerId ? players[viewerPlayerId]?.name : undefined;
  if (viewerName) lines.push(`You are playing as: ${viewerName}`);

  const activePlayerId = gamedatas.gamestate?.active_player;
  const activePlayerName = activePlayerId ? players[activePlayerId]?.name : undefined;
  if (activePlayerName) {
    const isViewer = viewerPlayerId !== undefined && activePlayerId === viewerPlayerId;
    lines.push(`Current turn: ${activePlayerName}${isViewer ? " (you)" : ""}`);
  }

  if (gamedatas.gamestate) {
    const description = renderStateDescription(gamedatas.gamestate, players, viewerPlayerId);
    if (description) lines.push(description);
  }

  if (gamedatas.gamestate?.name) lines.push(`Game state: ${gamedatas.gamestate.name}`);

  const stateType = gamedatas.gamestate?.type;
  if (stateType) lines.push(`Turn type: ${STATE_TYPE_LABELS[stateType] ?? stateType}`);

  const actions = gamedatas.gamestate?.possibleactions;
  if (actions?.length) lines.push(`Legal actions: ${actions.join(", ")}`);

  const playerorder = gamedatas.playerorder;
  if (playerorder?.length) {
    const order = playerorder.map((id) => players[String(id)]?.name ?? String(id)).join(", ");
    lines.push(`Turn order: ${order}`);
  }

  const playerList = Object.entries(players)
    .map(([id, player]) => {
      const details = [
        player.score !== undefined ? `score: ${player.score}` : null,
        id === viewerPlayerId ? "you" : null,
      ].filter(Boolean);
      return `${player.name}${details.length ? ` (${details.join(", ")})` : ""}`;
    })
    .join(", ");
  if (playerList) lines.push(`Players: ${playerList}`);

  // Confirmed live against a real Ark Nova table: `gamedatas.notifications`
  // is not a log array in practice — it's `{ last_packet_id, move_nbr }`
  // polling metadata. The actual move/notification log comes from a
  // different BGA endpoint entirely, out of reach of this generic core (a
  // later ticket). Only treat it as a log if it's actually an array, so a
  // shape mismatch degrades to "no log line" instead of throwing.
  const notifications = Array.isArray(gamedatas.notifications) ? gamedatas.notifications : [];
  const recentLog = notifications
    .slice(-MAX_LOG_LINES)
    .map(renderLogLine)
    .filter((line): line is string => Boolean(line));
  if (recentLog.length) lines.push(`Recent log:\n${recentLog.join("\n")}`);

  return lines.length ? lines.join("\n") : null;
}
