import { describe, expect, it } from "vitest";
import { assembleContext } from "./assembleContext";
import type { RawGamedatas } from "../gameState/types";

const gamedatas: RawGamedatas = {
  gamestate: { name: "playerTurn", active_player: "1", possibleactions: ["playCard"] },
  players: { "1": { name: "Alice", score: 12 } },
};

describe("assembleContext", () => {
  it("prepends a system message containing the live state summary, ahead of chat history", () => {
    const history = [{ role: "user" as const, content: "whose turn is it?" }];

    const result = assembleContext({ gamedatas, history });

    expect(result[0]).toEqual({
      role: "system",
      content: expect.stringContaining("Current turn: Alice"),
    });
    expect(result.slice(1)).toEqual(history);
  });

  it("re-derives the summary fresh from whatever gamedatas is passed in, never caching a prior call's result", () => {
    const first = assembleContext({ gamedatas, history: [] });
    const updated: RawGamedatas = {
      ...gamedatas,
      gamestate: { ...gamedatas.gamestate, active_player: undefined },
    };
    const second = assembleContext({ gamedatas: updated, history: [] });

    expect(first[0]!.content).toContain("Current turn: Alice");
    expect(second[0]!.content).not.toContain("Current turn: Alice");
  });

  it("still produces a usable system message noting no game context, when gamedatas is null", () => {
    const result = assembleContext({ gamedatas: null, history: [{ role: "user", content: "hi" }] });

    expect(result[0]!.role).toBe("system");
    expect(result[0]!.content).toMatch(/no live game.state/i);
    expect(result[1]).toEqual({ role: "user", content: "hi" });
  });
});
