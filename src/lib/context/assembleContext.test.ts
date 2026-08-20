import { describe, expect, it } from "vitest";
import { assembleContext } from "./assembleContext";
import type { RawGamedatas } from "../gameState/types";
import liveArkNovaGamedatas from "../gameState/plugins/arkNova/fixtures/liveGamedatas.json";

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

  it("drops the oldest history messages first once the token budget is exceeded", () => {
    // A long-running game's chat log, growing turn by turn; the earliest
    // turns should fall off once history grows past a reasonable budget,
    // while recent turns and the newest message survive.
    const rulesDiscussion =
      "Can you remind me what happens if I land on that space again? I want to make sure I'm not missing a scoring opportunity here. ".repeat(
        3,
      );
    const oldTurns = Array.from({ length: 2000 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `Turn ${i}: ${rulesDiscussion}`,
    }));
    const recentMessage = { role: "assistant" as const, content: "a small recent reply" };
    const newestMessage = { role: "user" as const, content: "what's my move?" };

    const result = assembleContext({
      gamedatas: null,
      history: [...oldTurns, recentMessage, newestMessage],
    });

    expect(result).not.toContainEqual(oldTurns[0]);
    expect(result).toContainEqual(recentMessage);
    expect(result[result.length - 1]).toEqual(newestMessage);
  });

  it("never drops the newest message, even if it alone exceeds the budget", () => {
    const rulesDiscussion =
      "Can you remind me what happens if I land on that space again? I want to make sure I'm not missing a scoring opportunity here. ";
    const oversizedNewest = { role: "user" as const, content: rulesDiscussion.repeat(10_000) };

    const result = assembleContext({ gamedatas: null, history: [oversizedNewest] });

    expect(result[result.length - 1]).toEqual(oversizedNewest);
  });

  it("keeps history untrimmed when it fits comfortably within the budget", () => {
    const history = [
      { role: "user" as const, content: "hello" },
      { role: "assistant" as const, content: "hi there" },
      { role: "user" as const, content: "what now?" },
    ];

    const result = assembleContext({ gamedatas: null, history });

    expect(result.slice(1)).toEqual(history);
  });

  it("includes the per-game plugin's summary alongside the generic-core summary, when a plugin is registered for the game's slug", () => {
    const fixture = liveArkNovaGamedatas as unknown as RawGamedatas;

    const result = assembleContext({ gamedatas: fixture, history: [] });

    expect(result[0]!.content).toContain("Current turn:");
    expect(result[0]!.content).toContain("Your hand (6 cards)");
    expect(result[0]!.content).toContain("Cheetah (animal, cost 17, appeal 6)");
  });

  it("still works with only the generic-core summary, for a game with no registered plugin", () => {
    const noPluginGamedatas: RawGamedatas = { ...gamedatas, gameSlug: "someUnregisteredGame" };

    const result = assembleContext({ gamedatas: noPluginGamedatas, history: [] });

    expect(result[0]!.content).toContain("Current turn: Alice");
  });

  it("degrades to the generic-core summary alone when the per-game plugin throws on malformed data", () => {
    const malformedGamedatas = {
      ...(liveArkNovaGamedatas as unknown as RawGamedatas),
      // Corrupt the shape the Ark Nova plugin expects to iterate over.
      cards: "not an array" as unknown,
    } as RawGamedatas;

    const result = assembleContext({ gamedatas: malformedGamedatas, history: [] });

    expect(result[0]!.content).toContain("Current turn:");
    expect(result[0]!.content).not.toContain("Your hand");
  });

  it("leaves the caller's history array untouched when trimming", () => {
    const rulesDiscussion = "A recap of the last few turns, for context. ";
    const oldTurns = Array.from({ length: 2000 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `Turn ${i}: ${rulesDiscussion.repeat(20)}`,
    }));
    const history = [...oldTurns, { role: "user" as const, content: "what's my move?" }];
    const historyCopy = history.map((m) => ({ ...m }));

    assembleContext({ gamedatas: null, history });

    expect(history).toEqual(historyCopy);
  });
});
