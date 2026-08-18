import { sendChatViaRequest } from "./chatRequest";
import { checkKeyViaRequest } from "./httpKeyCheck";
import type { ChatMessage, ChatResult, ValidationResult } from "./types";

const CHAT_MODEL = "gpt-4o-mini";

function authHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` };
}

export function validateOpenAIKey(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ValidationResult> {
  return checkKeyViaRequest(fetchImpl, "https://api.openai.com/v1/models", authHeaders(apiKey), "OpenAI");
}

function extractText(responseBody: unknown): string | undefined {
  const choices = (responseBody as { choices?: { message?: { content?: string } }[] }).choices;
  return choices?.[0]?.message?.content;
}

export function sendOpenAIChat(
  apiKey: string,
  messages: ChatMessage[],
  fetchImpl: typeof fetch = fetch,
): Promise<ChatResult> {
  return sendChatViaRequest(
    fetchImpl,
    "https://api.openai.com/v1/chat/completions",
    authHeaders(apiKey),
    { model: CHAT_MODEL, messages },
    "OpenAI",
    extractText,
  );
}
