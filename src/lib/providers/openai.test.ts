import { describe, expect, it, vi } from "vitest";
import { sendOpenAIChat, validateOpenAIKey } from "./openai";

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

describe("sendOpenAIChat", () => {
  function fakeChatFetch(body: unknown, status = 200) {
    return vi.fn().mockResolvedValue({
      status,
      json: () => Promise.resolve(body),
    } as unknown as Response);
  }

  it("posts the message history to the chat completions endpoint with a bearer auth header", async () => {
    const fetchImpl = fakeChatFetch({ choices: [{ message: { content: "hi there" } }] });

    await sendOpenAIChat("sk-oai-abc", [{ role: "user", content: "hello" }], fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-oai-abc",
          "content-type": "application/json",
        }),
      }),
    );
    const body = JSON.parse(fetchImpl.mock.calls[0]![1]!.body as string);
    expect(body.messages).toEqual([{ role: "user", content: "hello" }]);
  });

  it("extracts the assistant's text from the first choice", async () => {
    const fetchImpl = fakeChatFetch({ choices: [{ message: { content: "42" } }] });
    const result = await sendOpenAIChat("sk-oai-abc", [{ role: "user", content: "?" }], fetchImpl);
    expect(result).toEqual({ ok: true, text: "42" });
  });

  it("reports an error on a 401 response", async () => {
    const fetchImpl = fakeChatFetch({ error: { message: "Incorrect API key provided" } }, 401);
    const result = await sendOpenAIChat("sk-oai-bad", [{ role: "user", content: "?" }], fetchImpl);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/incorrect api key/i);
  });

  it("reports an error when the network call throws", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await sendOpenAIChat("sk-oai-abc", [{ role: "user", content: "?" }], fetchImpl);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/network down/i);
  });
});
