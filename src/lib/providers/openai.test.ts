import { describe, expect, it, vi } from "vitest";
import { validateOpenAIKey } from "./openai";

function fakeFetch(response: { status: number }) {
  return vi.fn().mockResolvedValue({ status: response.status } as Response);
}

describe("validateOpenAIKey", () => {
  it("calls the models endpoint with a bearer auth header", async () => {
    const fetchImpl = fakeFetch({ status: 200 });
    await validateOpenAIKey("sk-oai-abc", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.openai.com/v1/models",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer sk-oai-abc",
        }),
      }),
    );
  });

  it("reports ok on a 200 response", async () => {
    const result = await validateOpenAIKey("sk-oai-abc", fakeFetch({ status: 200 }));
    expect(result).toEqual({ ok: true });
  });

  it("reports an error on a 401 response", async () => {
    const result = await validateOpenAIKey("sk-oai-bad", fakeFetch({ status: 401 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/invalid/i);
  });

  it("reports an error when the network call throws", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await validateOpenAIKey("sk-oai-abc", fetchImpl);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/network down/i);
  });
});
