import { checkKeyViaRequest } from "./httpKeyCheck";
import type { ValidationResult } from "./types";

// Anthropic requires this header to allow the CORS preflight on calls made
// directly from a browser/extension context, rather than a trusted backend.
const ANTHROPIC_VERSION = "2023-06-01";

export function validateAnthropicKey(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ValidationResult> {
  return checkKeyViaRequest(
    fetchImpl,
    "https://api.anthropic.com/v1/models",
    {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    "Anthropic",
  );
}
