import { describe, expect, it } from "vitest";
import { maskKey } from "./maskKey";

describe("maskKey", () => {
  it("shows the first 3 characters, an ellipsis, and the last 4 — matching OpenAI's own display format", () => {
    expect(maskKey("sk-proj-abcxyzvaMA")).toBe("sk-...vaMA");
  });

  it("works the same regardless of provider-specific prefix length", () => {
    // Anthropic keys look like sk-ant-api03-...; only the leading "sk-" is shown either way.
    expect(maskKey("sk-ant-api03-1234567890abcd")).toBe("sk-...abcd");
  });

  it("falls back to showing the key in full when it's too short to meaningfully mask", () => {
    expect(maskKey("sk-ab")).toBe("sk-ab");
  });
});
