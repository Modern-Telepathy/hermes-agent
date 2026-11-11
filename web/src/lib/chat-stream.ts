/**
 * Transcript state for the chat text view.
 *
 * The Chat tab draws the TUI in xterm, but every turn is also broadcast as structured events on
 * `/api/events` (see `contracts/events.py`): `message.start`, `message.delta`, `message.complete`,
 * `reasoning.delta`, `tool.start` / `tool.complete`, `status.update`, `error`. Folding those into
 * turns gives a normal streaming transcript without touching the PTY bridge.
 */

export type ChatStreamTurn =
  | { id: number; kind: "user"; text: string }
  | { id: number; kind: "assistant"; text: string; streaming: boolean }
  | { id: number; kind: "reasoning"; text: string }
  | { id: number; kind: "tool"; name: string; text: string; running: boolean }
  | { id: number; kind: "notice"; text: string; tone: "info" | "error" };

export interface ChatStreamState {
  nextId: number;
  turns: ChatStreamTurn[];
}

/** Events the text view folds; anything else on the channel is ignored. */
export const CHAT_STREAM_EVENTS = [
  "message.start",
  "message.delta",
  "message.interim",
  "message.complete",
  "reasoning.delta",
  "thinking.delta",
  "tool.start",
  "tool.complete",
  "status.update",
  "error",
] as const;

/** A long session would otherwise grow without bound in the DOM. */
const MAX_TURNS = 400;

type TurnDraft =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string; streaming: boolean }
  | { kind: "reasoning"; text: string }
  | { kind: "tool"; name: string; text: string; running: boolean }
  | { kind: "notice"; text: string; tone: "info" | "error" };

export function emptyChatStream(): ChatStreamState {
  return { nextId: 1, turns: [] };
}

/** A message the user just sent, shown immediately instead of waiting for the echo. */
export function appendUserTurn(
  state: ChatStreamState,
  text: string,
): ChatStreamState {
  const body = text.trim();
  if (!body) return state;
  return add(sealAssistant(state), [{ kind: "user", text: body }]);
}

export function applyChatEvent(
  state: ChatStreamState,
  name: string,
  payload: unknown,
): ChatStreamState {
  const body = payloadText(payload);

  switch (name) {
    case "message.start":
      return add(sealAssistant(state), [
        { kind: "assistant", text: "", streaming: true },
      ]);

    case "message.delta":
    case "message.interim":
      // A null delta is the segment boundary between reply parts, not text.
      if (!body) return state;
      return appendProse(state, "assistant", body);

    case "message.complete":
      return completeAssistant(state, body);

    case "reasoning.delta":
    case "thinking.delta":
      if (!body) return state;
      return appendProse(state, "reasoning", body);

    case "tool.start": {
      const name = payloadString(payload, "name") || "tool";
      const detail =
        payloadString(payload, "preview") ||
        payloadString(payload, "command") ||
        payloadString(payload, "summary");
      return add(state, [
        { kind: "tool", name, text: detail, running: true },
      ]);
    }

    case "tool.complete":
      return finishTool(state, payloadString(payload, "name"));

    case "status.update": {
      if (!body) return state;
      const last = state.turns[state.turns.length - 1];
      if (last && last.kind === "notice" && last.text === body) return state;
      return add(state, [{ kind: "notice", text: body, tone: "info" }]);
    }

    case "error": {
      const message = payloadString(payload, "message") || body;
      if (!message) return state;
      return add(state, [{ kind: "notice", text: message, tone: "error" }]);
    }

    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/*  Turn bookkeeping                                                   */
/* ------------------------------------------------------------------ */

function add(state: ChatStreamState, drafts: TurnDraft[]): ChatStreamState {
  if (drafts.length === 0) return state;
  let nextId = state.nextId;
  const added = drafts.map(
    (draft) => ({ ...draft, id: nextId++ }) as ChatStreamTurn,
  );
  const turns = [...state.turns, ...added];
  return {
    nextId,
    turns: turns.length > MAX_TURNS ? turns.slice(turns.length - MAX_TURNS) : turns,
  };
}

/** Append a streamed chunk to the open turn of that kind, opening one when there is none. */
function appendProse(
  state: ChatStreamState,
  kind: "assistant" | "reasoning",
  chunk: string,
): ChatStreamState {
  const turns = state.turns.slice();
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (kind === "reasoning") {
      // Reasoning only extends the row it started, so a reply after it stays separate.
      if (turn.kind === "reasoning") {
        turns[i] = { ...turn, text: turn.text + chunk };
        return { ...state, turns };
      }
      break;
    }
    // Assistant text keeps growing its own open turn even when reasoning rows landed since.
    if (turn.kind === "assistant" && turn.streaming) {
      turns[i] = { ...turn, text: turn.text + chunk };
      return { ...state, turns };
    }
    if (turn.kind === "user" || turn.kind === "notice") break;
  }
  return add(state, [
    kind === "assistant"
      ? { kind: "assistant", text: chunk, streaming: true }
      : { kind: "reasoning", text: chunk },
  ]);
}

function completeAssistant(
  state: ChatStreamState,
  finalText: string,
): ChatStreamState {
  const turns = state.turns.slice();
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (turn.kind !== "assistant" || !turn.streaming) continue;
    // The complete frame carries the settled text; trust it over the accumulated deltas.
    turns[i] = { ...turn, text: finalText || turn.text, streaming: false };
    return { ...state, turns };
  }
  if (!finalText) return state;
  return add(state, [
    { kind: "assistant", text: finalText, streaming: false },
  ]);
}

function sealAssistant(state: ChatStreamState): ChatStreamState {
  const turns = state.turns.slice();
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (turn.kind === "assistant" && turn.streaming) {
      turns[i] = { ...turn, streaming: false };
      return { ...state, turns };
    }
  }
  return state;
}

function finishTool(state: ChatStreamState, name: string): ChatStreamState {
  const turns = state.turns.slice();
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (turn.kind !== "tool" || !turn.running) continue;
    if (name && turn.name !== name) continue;
    turns[i] = { ...turn, running: false };
    return { ...state, turns };
  }
  return state;
}

/* ------------------------------------------------------------------ */
/*  Payload narrowing                                                  */
/* ------------------------------------------------------------------ */

function payloadText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const value = (payload as { text?: unknown }).text;
  return typeof value === "string" ? value : "";
}

function payloadString(payload: unknown, key: string): string {
  if (!payload || typeof payload !== "object") return "";
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}
