import { describe, expect, it } from "vitest";
import { appendMessage, createChatRecord, markFinishedIfGameEnd } from "./chatRecord";

describe("createChatRecord", () => {
  it("starts active, empty, with createdAt and lastActiveAt set to the given time", () => {
    const record = createChatRecord("12345", "arknova", 1000);
    expect(record).toEqual({
      tableId: "12345",
      gameSlug: "arknova",
      status: "active",
      createdAt: 1000,
      lastActiveAt: 1000,
      messages: [],
      cachedRulebookExcerpt: null,
    });
  });

  it("allows an unknown gameSlug", () => {
    const record = createChatRecord("12345", undefined, 1000);
    expect(record.gameSlug).toBeUndefined();
  });
});

describe("appendMessage", () => {
  it("appends the message and bumps lastActiveAt, without mutating the original record", () => {
    const record = createChatRecord("12345", "arknova", 1000);

    const updated = appendMessage(record, { role: "user", content: "hello" }, 2000);

    expect(updated.messages).toEqual([{ role: "user", content: "hello", timestamp: 2000 }]);
    expect(updated.lastActiveAt).toBe(2000);
    expect(record.messages).toEqual([]);
  });

  it("preserves prior messages in order", () => {
    let record = createChatRecord("12345", "arknova", 1000);
    record = appendMessage(record, { role: "user", content: "hi" }, 1001);
    record = appendMessage(record, { role: "assistant", content: "hello!" }, 1002);

    expect(record.messages.map((m) => m.content)).toEqual(["hi", "hello!"]);
  });
});

describe("markFinishedIfGameEnd", () => {
  it("marks the record finished when the state name is gameEnd", () => {
    const record = createChatRecord("12345", "arknova", 1000);
    const updated = markFinishedIfGameEnd(record, "gameEnd");
    expect(updated.status).toBe("finished");
  });

  it("leaves the record active for any other state name", () => {
    const record = createChatRecord("12345", "arknova", 1000);
    expect(markFinishedIfGameEnd(record, "playerTurn").status).toBe("active");
  });

  it("leaves the record active when no state name is available", () => {
    const record = createChatRecord("12345", "arknova", 1000);
    expect(markFinishedIfGameEnd(record, undefined).status).toBe("active");
  });

  it("does not un-finish an already-finished record even if a stale non-gameEnd state comes through", () => {
    const record = markFinishedIfGameEnd(createChatRecord("12345", "arknova", 1000), "gameEnd");
    expect(markFinishedIfGameEnd(record, "playerTurn").status).toBe("finished");
  });
});
