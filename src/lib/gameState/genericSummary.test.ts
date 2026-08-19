import { describe, expect, it } from "vitest";
import { summarizeGenericState } from "./genericSummary";
import type { RawGamedatas } from "./types";

// Two structurally different fixtures — one with a simple flat gamestate and
// no notification args, one with a richer state and templated log lines —
// standing in for "at least two structurally different games" per #24's
// acceptance criteria (a live-BGA-session check is out of reach here; this
// is a fixture-based unit test of the pure summarizer per the parent spec's
// documented testing seam).
const flatGameFixture: RawGamedatas = {
  gamestate: { name: "playerTurn", active_player: "2343201", possibleactions: ["playCard", "pass"] },
  players: {
    "2343201": { id: "2343201", name: "Alice", score: 12 },
    "2343202": { id: "2343202", name: "Bob", score: 9 },
  },
  notifications: [{ log: "${player_name} drew a card.", args: { player_name: "Alice" } }],
};

const richGameFixture: RawGamedatas = {
  gamestate: { name: "chooseAction", active_player: "9001", possibleactions: ["buildAnimal", "reserveWorker"] },
  players: {
    "9001": { id: "9001", name: "Priya", score: "34" },
    "9002": { id: "9002", name: "Sam", score: "31" },
    "9003": { id: "9003", name: "Jo", score: "0" },
  },
  notifications: [
    { log: "${player_name} played ${card_name}.", args: { player_name: "Priya", card_name: "Fennec Fox" } },
    { log: "${player_name} passed." }, // args omitted — template left as-is if a key is missing
  ],
};

describe("summarizeGenericState", () => {
  it("returns null when there is no live game state", () => {
    expect(summarizeGenericState(null)).toBeNull();
  });

  it("reports whose turn it is by resolving active_player against the player list", () => {
    expect(summarizeGenericState(flatGameFixture)).toContain("Current turn: Alice");
    expect(summarizeGenericState(richGameFixture)).toContain("Current turn: Priya");
  });

  it("reports the current state name", () => {
    expect(summarizeGenericState(flatGameFixture)).toContain("Game state: playerTurn");
    expect(summarizeGenericState(richGameFixture)).toContain("Game state: chooseAction");
  });

  it("reports the legal action names", () => {
    expect(summarizeGenericState(flatGameFixture)).toContain("Legal actions: playCard, pass");
    expect(summarizeGenericState(richGameFixture)).toContain("Legal actions: buildAnimal, reserveWorker");
  });

  it("lists all players with their scores", () => {
    const summary = summarizeGenericState(flatGameFixture)!;
    expect(summary).toContain("Alice (score: 12)");
    expect(summary).toContain("Bob (score: 9)");
  });

  it("renders the notification log, substituting templated args", () => {
    expect(summarizeGenericState(flatGameFixture)).toContain("Alice drew a card.");
    const richSummary = summarizeGenericState(richGameFixture)!;
    expect(richSummary).toContain("Priya played Fennec Fox.");
    expect(richSummary).toContain("${player_name} passed.");
  });

  it("degrades gracefully when fields are missing, without throwing", () => {
    expect(() => summarizeGenericState({})).not.toThrow();
    expect(summarizeGenericState({})).toBeNull();
  });

  // Regression: confirmed live against a real Ark Nova table (2026-08-18)
  // that `notifications` is actually `{ last_packet_id, move_nbr }` polling
  // metadata, not a log array — the array-only assumption above crashed on
  // this real shape (`.slice is not a function`) before this fix.
  it("does not throw when notifications is real-world polling metadata rather than a log array", () => {
    const liveShapedFixture: RawGamedatas = {
      gamestate: { name: "chooseActionCard", active_player: "88257314", possibleactions: ["actChooseActionCard"] },
      players: { "88257314": { id: "88257314", name: "Sigzy", score: 21 } },
      notifications: { last_packet_id: "1234", move_nbr: "316" },
    };

    expect(() => summarizeGenericState(liveShapedFixture)).not.toThrow();
    const summary = summarizeGenericState(liveShapedFixture)!;
    expect(summary).toContain("Current turn: Sigzy");
    expect(summary).not.toContain("Recent log");
  });

  // Regression: confirmed live (Ticket to Ride, 2026-08-19) that asking
  // "what's my score?" got the *active player's* score back, not the
  // viewer's own — the summary had no way to say which player is "you" as
  // distinct from whoever's turn it currently is. `viewerPlayerId` (sourced
  // from `gameui.player_id`, a sibling of `gamedatas`) fixes that.
  describe("viewer identification", () => {
    it("states plainly which player is the viewer, distinct from whoever's turn it is", () => {
      const summary = summarizeGenericState({ ...flatGameFixture, viewerPlayerId: "2343202" })!;
      expect(summary).toContain("You are playing as: Bob");
    });

    it("marks the viewer's own entry in the player list", () => {
      const summary = summarizeGenericState({ ...flatGameFixture, viewerPlayerId: "2343202" })!;
      expect(summary).toContain("Bob (score: 9, you)");
      expect(summary).not.toContain("Alice (score: 12, you)");
    });

    it("marks the turn line when it's the viewer's own turn", () => {
      const summary = summarizeGenericState({ ...flatGameFixture, viewerPlayerId: "2343201" })!;
      expect(summary).toContain("Current turn: Alice (you)");
    });

    it("does not mark the turn line when it's someone else's turn", () => {
      const summary = summarizeGenericState({ ...flatGameFixture, viewerPlayerId: "2343202" })!;
      expect(summary).toContain("Current turn: Alice");
      expect(summary).not.toContain("Current turn: Alice (you)");
    });

    it("omits viewer identification entirely when viewerPlayerId is absent, without throwing", () => {
      expect(() => summarizeGenericState(flatGameFixture)).not.toThrow();
      const summary = summarizeGenericState(flatGameFixture)!;
      expect(summary).not.toContain("You are playing as");
      expect(summary).not.toContain(", you)");
    });
  });

  // New fields confirmed live on both Ark Nova and Ticket to Ride
  // (2026-08-19) — game display name, state description text (templated the
  // same way notification logs are), state type, and seating/turn order.
  describe("additional generic-core fields", () => {
    it("reports the game's display name", () => {
      const summary = summarizeGenericState({ ...flatGameFixture, gameName: "Ark Nova" })!;
      expect(summary).toContain("Game: Ark Nova");
    });

    it("omits the game name line when it's absent", () => {
      const summary = summarizeGenericState(flatGameFixture)!;
      expect(summary).not.toContain("Game:");
    });

    it("renders descriptionmyturn (substituting ${you}) when it's the viewer's own turn", () => {
      const fixture: RawGamedatas = {
        ...flatGameFixture,
        viewerPlayerId: "2343201",
        gamestate: {
          ...flatGameFixture.gamestate,
          description: "${actplayer} must choose an action card",
          descriptionmyturn: "${you} must choose an action card",
        },
      };
      const summary = summarizeGenericState(fixture)!;
      expect(summary).toContain("You must choose an action card");
      expect(summary).not.toContain("Alice must choose an action card");
    });

    it("renders description (substituting ${actplayer}) when it's someone else's turn", () => {
      const fixture: RawGamedatas = {
        ...flatGameFixture,
        viewerPlayerId: "2343202",
        gamestate: {
          ...flatGameFixture.gamestate,
          description: "${actplayer} must choose an action card",
          descriptionmyturn: "${you} must choose an action card",
        },
      };
      const summary = summarizeGenericState(fixture)!;
      expect(summary).toContain("Alice must choose an action card");
    });

    it("omits the description line entirely when it's an empty string", () => {
      const fixture: RawGamedatas = {
        ...flatGameFixture,
        gamestate: { ...flatGameFixture.gamestate, description: "", descriptionmyturn: "" },
      };
      expect(() => summarizeGenericState(fixture)).not.toThrow();
    });

    it("reports the state type using a friendly label, falling back to the raw value for an unrecognized one", () => {
      const multi = summarizeGenericState({
        ...flatGameFixture,
        gamestate: { ...flatGameFixture.gamestate, type: "multipleactiveplayer" },
      })!;
      expect(multi).toContain("Turn type: multiple players acting simultaneously");

      const unknown = summarizeGenericState({
        ...flatGameFixture,
        gamestate: { ...flatGameFixture.gamestate, type: "someFutureType" },
      })!;
      expect(unknown).toContain("Turn type: someFutureType");
    });

    it("reports seating/turn order by resolving playerorder ids against the player list", () => {
      const summary = summarizeGenericState({ ...flatGameFixture, playerorder: ["2343201", "2343202"] })!;
      expect(summary).toContain("Turn order: Alice, Bob");
    });

    it("falls back to the raw id in turn order when a player can't be resolved, without throwing", () => {
      const summary = summarizeGenericState({ ...flatGameFixture, playerorder: ["2343201", "9999999"] })!;
      expect(summary).toContain("Turn order: Alice, 9999999");
    });
  });
});
