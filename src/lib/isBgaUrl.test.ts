import { describe, expect, it } from "vitest";
import { isBgaUrl } from "./isBgaUrl";

describe("isBgaUrl", () => {
  it("accepts the bare apex domain over https", () => {
    expect(isBgaUrl("https://boardgamearena.com/gamepanel?game=arknova")).toBe(true);
  });

  it("accepts locale subdomains over https", () => {
    expect(isBgaUrl("https://en.boardgamearena.com/tableview?table=123")).toBe(true);
  });

  it("rejects unrelated domains", () => {
    expect(isBgaUrl("https://example.com")).toBe(false);
  });

  it("rejects lookalike domains that merely contain the string", () => {
    expect(isBgaUrl("https://notboardgamearena.com")).toBe(false);
    expect(isBgaUrl("https://boardgamearena.com.evil.example/")).toBe(false);
  });

  it("rejects http (BGA and our host_permissions are https-only)", () => {
    expect(isBgaUrl("http://boardgamearena.com/")).toBe(false);
  });

  it("rejects undefined, empty, and unparseable input without throwing", () => {
    expect(isBgaUrl(undefined)).toBe(false);
    expect(isBgaUrl("")).toBe(false);
    expect(isBgaUrl("not a url")).toBe(false);
  });
});
