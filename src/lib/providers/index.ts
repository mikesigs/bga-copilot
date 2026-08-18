import type { Provider } from "../settings";
import { sendAnthropicChat, validateAnthropicKey } from "./anthropic";
import { sendOpenAIChat, validateOpenAIKey } from "./openai";
import type { ChatSender, KeyValidator } from "./types";

export const validators: Record<Provider, KeyValidator> = {
  anthropic: validateAnthropicKey,
  openai: validateOpenAIKey,
};

export const chatSenders: Record<Provider, ChatSender> = {
  anthropic: sendAnthropicChat,
  openai: sendOpenAIChat,
};

export type { ChatMessage, ChatResult, ChatSender, KeyValidator, ValidationResult } from "./types";
