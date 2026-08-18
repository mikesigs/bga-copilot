import { sendChatViaRequest } from "./chatRequest";
import { checkKeyViaRequest } from "./httpKeyCheck";
import type { ChatMessage, ChatResult, ValidationResult } from "./types";

// Anthropic requires this header to allow the CORS preflight on calls made
// directly from a browser/extension context, rather than a trusted backend.
const ANTHROPIC_VERSION = "2023-06-01";
const CHAT_MODEL = "claude-3-5-sonnet-20241022";
const MAX_TOKENS = 1024;

function authHeaders(apiKey: string): Record<string, string> {
  return {
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
    "anthropic-dangerous-direct-browser-access": "true",
  };
}

export function validateAnthropicKey(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ValidationResult> {
  return checkKeyViaRequest(fetchImpl, "https://api.anthropic.com/v1/models", authHeaders(apiKey), "Anthropic");
}

function extractText(responseBody: unknown): string | undefined {
  const content = (responseBody as { content?: { type: string; text: string }[] }).content;
  return content
    ?.filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

export function sendAnthropicChat(
  apiKey: string,
  messages: ChatMessage[],
  fetchImpl: typeof fetch = fetch,
): Promise<ChatResult> {
  return sendChatViaRequest(
    fetchImpl,
    "https://api.anthropic.com/v1/messages",
    authHeaders(apiKey),
    { model: CHAT_MODEL, max_tokens: MAX_TOKENS, messages },
    "Anthropic",
    extractText,
  );
}
