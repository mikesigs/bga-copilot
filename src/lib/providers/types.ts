export type ValidationResult = { ok: true } | { ok: false; error: string };

export type KeyValidator = (apiKey: string, fetchImpl?: typeof fetch) => Promise<ValidationResult>;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type ChatResult = { ok: true; text: string } | { ok: false; error: string };

export type ChatSender = (
  apiKey: string,
  messages: ChatMessage[],
  fetchImpl?: typeof fetch,
) => Promise<ChatResult>;
