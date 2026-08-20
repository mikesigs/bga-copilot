import { describe, expect, it } from "vitest";
import { arkNovaPlugin } from "./arkNovaPlugin";
import type { RawGamedatas } from "../../types";
import liveGamedatas from "./fixtures/liveGamedatas.json";

// Captured live from a real Ark Nova table (2026-08-20) via
// `copy(JSON.stringify(gameui.gamedatas))` plus the sibling fields
// `extractGameState` bundles in (`viewerPlayerId`, `gameSlug`, etc.) — see
// `fixtures/liveGamedatas.json`.
const fixture = liveGamedatas as unknown as RawGamedatas;

describe("arkNovaPlugin", () => {
  it("declares the arknova slug", () => {
    expect(arkNovaPlugin.gameSlug).toBe("arknova");
  });

  it("summarizes the viewer's hand by name and type, answering 'what's in my hand?'", () => {
    const summary = arkNovaPlugin.summarizeState(fixture, fixture.gamestate);

    expect(summary).toContain("Your hand (6 cards)");
    expect(summary).toContain("Cheetah (animal, cost 17, appeal 6)");
    expect(summary).toContain("Waza Small Animal Program (sponsor, level 5)");
    expect(summary).toContain("Golden Snub-nosed Monkey (animal, cost 18, appeal 6)");
    expect(summary).toContain("Leopard (animal, cost 20, appeal 7)");
    expect(summary).toContain("Sea Cave (conservation project)");
    expect(summary).toContain("Malayan Tapir (animal, cost 17, appeal 5)");
  });

  it("summarizes the viewer's zoo (animals and sponsors in play) and buildings", () => {
    const summary = arkNovaPlugin.summarizeState(fixture, fixture.gamestate);

    expect(summary).toContain("Animals in your zoo (5): Longcomb Sawfish, Barn Owl");
    expect(summary).toContain("Sponsors in play:");
    expect(summary).toContain("Publications");
    expect(summary).toContain("Buildings:");
    expect(summary).toContain("4 kiosk");
  });

  it("summarizes the viewer's action cards with level and strength", () => {
    const summary = arkNovaPlugin.summarizeState(fixture, fixture.gamestate);

    expect(summary).toContain("Your action cards:");
    expect(summary).toContain("- Build: level 1, strength 1");
    expect(summary).toContain("- Sponsors: level 1, strength 5");
  });

  it("summarizes viewer stats", () => {
    const summary = arkNovaPlugin.summarizeState(fixture, fixture.gamestate);

    expect(summary).toContain("money 21");
    expect(summary).toContain("reputation 6");
    expect(summary).toContain("appeal 27");
    expect(summary).toContain("conservation 10");
  });

  it("translates the current state and legal actions using codeLookups", () => {
    const summary = arkNovaPlugin.summarizeState(fixture, fixture.gamestate);

    expect(summary).toContain("Current action needed: Discard a final scoring card");
    expect(summary).toContain("Available actions: Discard a final scoring card");
  });

  it("returns null when there's no viewer player id to resolve 'you' against", () => {
    const noViewer: RawGamedatas = { ...fixture, viewerPlayerId: undefined };

    expect(arkNovaPlugin.summarizeState(noViewer, noViewer.gamestate)).toBeNull();
  });
});
