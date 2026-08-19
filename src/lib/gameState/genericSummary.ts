import type { RawGamedatas, RawNotification } from "./types";

const MAX_LOG_LINES = 10;

function renderLogLine(notification: RawNotification): string | null {
  if (!notification.log) return null;
  return notification.log.replace(/\$\{(\w+)\}/g, (match, key: string) => {
    const value = notification.args?.[key];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Turns the generic-core slice of `gamedatas` (shared across every BGA game)
 * into a plain-text summary for the LLM prompt. Per-game board/hand content
 * lives in bespoke `gamestate.args` shapes and needs a per-game plugin
 * (a later ticket) — this only covers whose turn it is, the state name,
 * legal action names, players, and the recent notification log.
 */
export function summarizeGenericState(gamedatas: RawGamedatas | null): string | null {
  if (!gamedatas) return null;

  const lines: string[] = [];
  const players = gamedatas.players ?? {};

  const activePlayerId = gamedatas.gamestate?.active_player;
  const activePlayerName = activePlayerId ? players[activePlayerId]?.name : undefined;
  if (activePlayerName) lines.push(`Current turn: ${activePlayerName}`);

  if (gamedatas.gamestate?.name) lines.push(`Game state: ${gamedatas.gamestate.name}`);

  const actions = gamedatas.gamestate?.possibleactions;
  if (actions?.length) lines.push(`Legal actions: ${actions.join(", ")}`);

  const playerList = Object.values(players)
    .map((player) => `${player.name}${player.score !== undefined ? ` (score: ${player.score})` : ""}`)
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
