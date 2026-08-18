import type { Provider } from "../settings";
import { validateAnthropicKey } from "./anthropic";
import { validateOpenAIKey } from "./openai";
import type { KeyValidator } from "./types";

export const validators: Record<Provider, KeyValidator> = {
  anthropic: validateAnthropicKey,
  openai: validateOpenAIKey,
};

export type { KeyValidator, ValidationResult } from "./types";
