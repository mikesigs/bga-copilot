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
});
