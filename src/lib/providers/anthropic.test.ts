import { describe, expect, it, vi } from "vitest";
import { validateAnthropicKey } from "./anthropic";

function fakeFetch(response: { status: number }) {
  return vi.fn().mockResolvedValue({ status: response.status } as Response);
}

describe("validateAnthropicKey", () => {
  it("calls the models endpoint with the browser-direct-access header and the key", async () => {
    const fetchImpl = fakeFetch({ status: 200 });
    await validateAnthropicKey("sk-ant-abc", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/models",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-api-key": "sk-ant-abc",
          "anthropic-dangerous-direct-browser-access": "true",
        }),
      }),
    );
  });

  it("reports ok on a 200 response", async () => {
    const result = await validateAnthropicKey("sk-ant-abc", fakeFetch({ status: 200 }));
    expect(result).toEqual({ ok: true });
  });

  it("reports an error on a 401 response", async () => {
    const result = await validateAnthropicKey("sk-ant-bad", fakeFetch({ status: 401 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/invalid/i);
  });

  it("reports an error when the network call throws", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await validateAnthropicKey("sk-ant-abc", fetchImpl);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/network down/i);
  });
});
