import type { ValidationResult } from "./types";

// Anthropic requires this header to allow the CORS preflight on calls made
// directly from a browser/extension context, rather than a trusted backend.
const ANTHROPIC_VERSION = "2023-06-01";

export async function validateAnthropicKey(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ValidationResult> {
  try {
    const response = await fetchImpl("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
      },
    });

    if (response.status === 200) return { ok: true };
    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: "Invalid API key." };
    }
    return { ok: false, error: `Unexpected response (status ${response.status}).` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Could not reach Anthropic: ${message}` };
  }
}
