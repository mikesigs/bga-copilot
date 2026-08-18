const PREFIX_LENGTH = 3;
const SUFFIX_LENGTH = 4;

/**
 * Masks an API key for display, matching the format providers like OpenAI
 * already show their own users (e.g. "sk-...vaMA") — first few characters,
 * an ellipsis, last four. Never round-trips a full key back for display.
 */
export function maskKey(key: string): string {
  if (key.length < PREFIX_LENGTH + SUFFIX_LENGTH) return key;
  return `${key.slice(0, PREFIX_LENGTH)}...${key.slice(-SUFFIX_LENGTH)}`;
}
