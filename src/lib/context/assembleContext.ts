import { summarizeGenericState } from "../gameState/genericSummary";
import type { RawGamedatas } from "../gameState/types";
import type { ChatMessage } from "../providers/types";

const BASE_SYSTEM_PROMPT =
  "You are a helpful assistant for a board game being played on BoardGameArena. Answer questions about the game, its rules, and the player's options.";

export interface AssembleContextInput {
  gamedatas: RawGamedatas | null;
  history: ChatMessage[];
}

/**
 * The one designated automated-test seam for context assembly (per the
 * parent spec): given a gamedatas snapshot and chat history, produce the
 * full message list — system prompt (with live state summary when
 * available) followed by history — that gets sent to the LLM. Always
 * re-derives the summary from whatever `gamedatas` is passed in; callers are
 * responsible for re-extracting fresh state on every message rather than
 * reusing a prior snapshot.
 */
export function assembleContext(input: AssembleContextInput): ChatMessage[] {
  const stateSummary = summarizeGenericState(input.gamedatas);
  const systemPrompt = stateSummary
    ? `${BASE_SYSTEM_PROMPT}\n\nCurrent game state:\n${stateSummary}`
    : `${BASE_SYSTEM_PROMPT}\n\n(No live game-state context is currently available.)`;

  return [{ role: "system", content: systemPrompt }, ...input.history];
}
