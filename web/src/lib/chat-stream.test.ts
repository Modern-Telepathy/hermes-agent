import { describe, expect, it } from "vitest";

import {
  appendUserTurn,
  applyChatEvent,
  emptyChatStream,
  type ChatStreamState,
} from "./chat-stream";

const fold = (
  initial: ChatStreamState,
  events: Array<[string, unknown]>,
): ChatStreamState => events.reduce((state, [name, payload]) => applyChatEvent(state, name, payload), initial);

describe("chat stream reducer", () => {
  it("grows one assistant turn from streamed deltas and seals it on complete", () => {
    const state = fold(emptyChatStream(), [
      ["message.start", {}],
      ["message.delta", { text: "Hello" }],
      ["message.delta", { text: ", world" }],
    ]);

    expect(state.turns).toHaveLength(1);
    expect(state.turns[0]).toMatchObject({ kind: "assistant", text: "Hello, world", streaming: true });

    const done = applyChatEvent(state, "message.complete", { text: "Hello, world." });
    expect(done.turns[0]).toMatchObject({ kind: "assistant", text: "Hello, world.", streaming: false });
  });

  it("treats a null delta as a segment boundary rather than text", () => {
    const state = fold(emptyChatStream(), [
      ["message.start", {}],
      ["message.delta", { text: "first" }],
      ["message.delta", { text: null }],
      ["message.delta", { text: " second" }],
    ]);

    expect(state.turns).toHaveLength(1);
    expect(state.turns[0]).toMatchObject({ text: "first second" });
  });

  it("keeps the open reply when reasoning arrives between deltas", () => {
    const state = fold(emptyChatStream(), [
      ["message.start", {}],
      ["message.delta", { text: "Looking" }],
      ["reasoning.delta", { text: "thinking about it" }],
      ["message.delta", { text: " into it" }],
    ]);

    expect(state.turns.map((t) => t.kind)).toEqual(["assistant", "reasoning"]);
    expect(state.turns[0]).toMatchObject({ text: "Looking into it" });
    expect(state.turns[1]).toMatchObject({ text: "thinking about it" });
  });

  it("seals the open reply when the user sends another message", () => {
    const state = fold(emptyChatStream(), [
      ["message.start", {}],
      ["message.delta", { text: "partial" }],
    ]);
    const next = appendUserTurn(state, "and another thing");

    expect(next.turns.map((t) => t.kind)).toEqual(["assistant", "user"]);
    expect(next.turns[0]).toMatchObject({ streaming: false });
    expect(next.turns[1]).toMatchObject({ kind: "user", text: "and another thing" });
  });

  it("opens a tool row on start and settles it on complete", () => {
    const started = applyChatEvent(emptyChatStream(), "tool.start", {
      name: "bash",
      command: "ls",
    });
    expect(started.turns[0]).toMatchObject({ kind: "tool", name: "bash", text: "ls", running: true });

    const finished = applyChatEvent(started, "tool.complete", { name: "bash" });
    expect(finished.turns[0]).toMatchObject({ running: false });
  });

  it("shows an error payload as an error notice", () => {
    const state = applyChatEvent(emptyChatStream(), "error", { message: "model unavailable" });
    expect(state.turns[0]).toMatchObject({ kind: "notice", tone: "error", text: "model unavailable" });
  });

  it("does not stack identical consecutive status notices", () => {
    const once = applyChatEvent(emptyChatStream(), "status.update", { text: "Starting…" });
    const twice = applyChatEvent(once, "status.update", { text: "Starting…" });
    expect(twice).toBe(once);
  });

  it("ignores events it does not fold", () => {
    const state = emptyChatStream();
    expect(applyChatEvent(state, "session.usage", { text: "ignored" })).toBe(state);
  });

  it("ignores an empty user message", () => {
    const state = emptyChatStream();
    expect(appendUserTurn(state, "   ")).toBe(state);
  });
});
