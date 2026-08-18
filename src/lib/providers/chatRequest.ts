import type { ChatResult } from "./types";

/**
 * Shared shape behind every provider's chat call: POST a JSON body to a chat
 * endpoint and turn the response into a ChatResult. Only the URL, headers,
 * request body, and how to pull the reply text out of the response body
 * vary per provider.
 */
export async function sendChatViaRequest(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  providerName: string,
  extractText: (responseBody: unknown) => string | undefined,
): Promise<ChatResult> {
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const responseBody = await response.json();

    if (response.status !== 200) {
      const message = responseBody?.error?.message ?? `Unexpected response (status ${response.status}).`;
      return { ok: false, error: message };
    }

    const text = extractText(responseBody);
    if (!text) return { ok: false, error: `${providerName} returned an empty response.` };
    return { ok: true, text };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Could not reach ${providerName}: ${message}` };
  }
}
