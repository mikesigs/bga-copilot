import type { ValidationResult } from "./types";

export async function validateOpenAIKey(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ValidationResult> {
  try {
    const response = await fetchImpl("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.status === 200) return { ok: true };
    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: "Invalid API key." };
    }
    return { ok: false, error: `Unexpected response (status ${response.status}).` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Could not reach OpenAI: ${message}` };
  }
}
