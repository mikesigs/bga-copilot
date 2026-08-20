import { describe, expect, it } from "vitest";
import { getPlugin } from "./registry";
import { arkNovaPlugin } from "./arkNova/arkNovaPlugin";

describe("getPlugin", () => {
  it("selects the Ark Nova plugin for the arknova slug", () => {
    expect(getPlugin("arknova")).toBe(arkNovaPlugin);
  });

  it("falls back to the no-op plugin for an unregistered slug", () => {
    const plugin = getPlugin("someUnknownGame");
    expect(plugin.summarizeState({}, undefined)).toBeNull();
  });

  it("falls back to the no-op plugin when no slug is given", () => {
    const plugin = getPlugin(undefined);
    expect(plugin.summarizeState({}, undefined)).toBeNull();
  });
});
