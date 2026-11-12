import { describe, expect, it } from "vitest";
import type { SessionInfo } from "./api";
import { isAgentRun, sessionLabel, splitSessionLists } from "./sidebar-lists";

function session(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    id: "s1",
    source: null,
    model: "test-model",
    title: "Title",
    started_at: 0,
    ended_at: null,
    last_active: 0,
    is_active: false,
    message_count: 2,
    tool_call_count: 0,
    input_tokens: 0,
    output_tokens: 0,
    preview: null,
    ...overrides,
  };
}

describe("sidebar list splitting", () => {
  it("keeps root sessions in conversations", () => {
    const root = session({ id: "root", source: "cli" });
    expect(isAgentRun(root)).toBe(false);
    expect(splitSessionLists([root]).conversations).toHaveLength(1);
  });

  it("routes subagent runs to agents by parent link or source", () => {
    const child = session({ id: "child", parent_session_id: "root" });
    const delegated = session({ id: "delegated", source: "delegate:review" });
    const subagent = session({ id: "sub", source: "subagent" });

    const split = splitSessionLists([child, delegated, subagent]);
    expect(split.agents.map((row) => row.id)).toEqual(["child", "delegated", "sub"]);
    expect(split.conversations).toEqual([]);
  });

  it("does not treat an ordinary source as an agent run", () => {
    expect(isAgentRun(session({ source: "dashboard" }))).toBe(false);
    expect(isAgentRun(session({ source: null }))).toBe(false);
  });

  it("falls back from an Untitled title to the preview", () => {
    expect(sessionLabel(session({ title: null, preview: "hello there" }))).toBe("hello there");
    expect(sessionLabel(session({ title: "Untitled", preview: null }))).toBe("Untitled");
  });
});
