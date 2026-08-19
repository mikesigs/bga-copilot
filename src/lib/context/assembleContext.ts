import { summarizeGenericState } from "../gameState/genericSummary";
import type { RawGamedatas } from "../gameState/types";
import type { ChatMessage } from "../providers/types";

const BASE_SYSTEM_PROMPT =
  "You are a helpful assistant for a board game being played on BoardGameArena. Answer questions about the game, its rules, and the player's options.";

// First-pass token budget from the parent spec (#1): ~100k overall ceiling,
// minus ~1-2k for the system prompt + state summary and ~15k reserved for
// rulebook context (not yet implemented, but budgeted for so this doesn't
// need retuning when it lands). Expected to need tuning once real usage
// data exists.
const HISTORY_TOKEN_BUDGET = 83_000;
const CHARS_PER_TOKEN_ESTIMATE = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

/**
 * FIFO-trims chat history to fit within a token budget: oldest messages are
 * dropped first. The newest message (the just-sent user message, always the
 * last entry) is never dropped, even if it alone exceeds the budget.
 */
function trimHistoryToBudget(history: ChatMessage[], maxTokens: number): ChatMessage[] {
  if (history.length === 0) return history;

  const newest = history[history.length - 1]!;
  const older = history.slice(0, -1);

  let total = estimateTokens(newest.content);
  const kept: ChatMessage[] = [];
  for (let i = older.length - 1; i >= 0; i--) {
    const msg = older[i]!;
    const tokens = estimateTokens(msg.content);
    if (total + tokens > maxTokens) break;
    kept.unshift(msg);
    total += tokens;
  }

  return [...kept, newest];
}

export interface AssembleContextInput {
  gamedatas: RawGamedatas | null;
  history: ChatMessage[];
}

/**
 * The one designated automated-test seam for context assembly (per the
 * parent spec): given a gamedatas snapshot and chat history, produce the
 * full message list — system prompt (with live state summary when
 * available) followed by FIFO-trimmed history — that gets sent to the LLM.
 * Always re-derives the summary from whatever `gamedatas` is passed in;
 * callers are responsible for re-extracting fresh state on every message
 * rather than reusing a prior snapshot. Trimming only affects what's
 * returned here, not the persisted history callers pass in.
 */
export function assembleContext(input: AssembleContextInput): ChatMessage[] {
  const stateSummary = summarizeGenericState(input.gamedatas);
  const systemPrompt = stateSummary
    ? `${BASE_SYSTEM_PROMPT}\n\nCurrent game state:\n${stateSummary}`
    : `${BASE_SYSTEM_PROMPT}\n\n(No live game-state context is currently available.)`;

  const trimmedHistory = trimHistoryToBudget(input.history, HISTORY_TOKEN_BUDGET);

  return [{ role: "system", content: systemPrompt }, ...trimmedHistory];
}
