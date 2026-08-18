import type { ValidationResult } from "./types";

/**
 * Shared shape behind every provider's key-validation call: hit an
 * authenticated, side-effect-free endpoint and classify the response.
 * Only the URL, headers, and provider label vary per provider.
 */
export async function checkKeyViaRequest(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
  providerName: string,
): Promise<ValidationResult> {
  try {
    const response = await fetchImpl(url, { method: "GET", headers });

    if (response.status === 200) return { ok: true };
    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: "Invalid API key." };
    }
    return { ok: false, error: `Unexpected response (status ${response.status}).` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Could not reach ${providerName}: ${message}` };
  }
}
