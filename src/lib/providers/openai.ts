import { checkKeyViaRequest } from "./httpKeyCheck";
import type { ValidationResult } from "./types";

export function validateOpenAIKey(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ValidationResult> {
  return checkKeyViaRequest(
    fetchImpl,
    "https://api.openai.com/v1/models",
    { Authorization: `Bearer ${apiKey}` },
    "OpenAI",
  );
}
