/**
 * ChatStreamView — the Chat tab as a normal transcript instead of a TUI in xterm.
 *
 * The PTY stays exactly as it was: this view listens to the same turn events the gateway broadcasts
 * for that channel (`EventsFeedClient` over `/api/events`) and sends through the parent's PTY
 * socket, so the agent, its tools and slash commands are unchanged. Only the drawing is different —
 * markdown, a streaming caret, tool rows, and a composer that behaves like a chat box.
 */

import { Button } from "@nous-research/ui/ui/components/button";
import { useEffect, useMemo, useRef, useState } from "react";

import { Markdown } from "@/components/Markdown";
import { api } from "@/lib/api";
import {
  CHAT_STREAM_EVENTS,
  appendUserTurn,
  applyChatEvent,
  emptyChatStream,
  type ChatStreamState,
} from "@/lib/chat-stream";
import { EventsFeedClient, type GatewayEvent } from "@/lib/eventsFeedClient";
import { cn } from "@/lib/utils";

export interface ChatStreamViewProps {
  /** PTY channel id — the same one the terminal pane subscribes to. */
  channel: string;
  /** Session being resumed, used to backfill the transcript; a fresh chat has none. */
  sessionId?: string | null;
  /** Writes one line into the PTY (the terminal's own send path). */
  onSend: (text: string) => void;
  /** The PTY is not open yet, so the composer would drop input. */
  disabled?: boolean;
}

export function ChatStreamView({
  channel,
  sessionId,
  onSend,
  disabled,
}: ChatStreamViewProps) {
  const [state, setState] = useState<ChatStreamState>(emptyChatStream);
  const [draft, setDraft] = useState("");
  const [historyNote, setHistoryNote] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const feed = useMemo(() => new EventsFeedClient(), []);

  // Live turns: one subscription per folded event name on this channel.
  useEffect(() => {
    let cancelled = false;
    const offs = CHAT_STREAM_EVENTS.map((name) =>
      feed.on(name, (event: GatewayEvent) => {
        if (cancelled) return;
        setState((prev) =>
          applyChatEvent(prev, name, (event as { payload?: unknown }).payload),
        );
      }),
    );
    feed.connect(channel).catch(() => {
      if (!cancelled) setHistoryNote("Live updates are offline; what you send still runs.");
    });
    return () => {
      cancelled = true;
      for (const off of offs) off();
      feed.close();
    };
  }, [channel, feed]);

  // Backfill a resumed session so the view is not empty until the next turn.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    api
      .getSessionMessages(sessionId)
      .then((resp) => {
        if (cancelled) return;
        const messages = (resp?.messages ?? []) as Array<{
          role?: string;
          content?: unknown;
        }>;
        for (const message of messages) {
          const text = typeof message.content === "string" ? message.content : "";
          if (!text) continue;
          if (message.role === "user") {
            setState((prev) => appendUserTurn(prev, text));
          } else if (message.role === "assistant") {
            setState((prev) =>
              applyChatEvent(prev, "message.complete", { text }),
            );
          }
        }
      })
      .catch(() => {
        if (!cancelled) setHistoryNote("Earlier messages could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [state.turns]);

  const submit = () => {
    const text = draft.trim();
    if (!text || disabled) return;
    setState((prev) => appendUserTurn(prev, text));
    onSend(text);
    setDraft("");
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background-base">
      <div
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5"
      >
        {state.turns.length === 0 && (
          <p className="text-sm text-text-tertiary">
            Send a message to start. The agent runs in the same session as the terminal.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {state.turns.map((turn) => {
            if (turn.kind === "user") {
              return (
                <div key={turn.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm whitespace-pre-wrap">
                    {turn.text}
                  </div>
                </div>
              );
            }

            if (turn.kind === "assistant") {
              return (
                <div key={turn.id} className="max-w-[95%]">
                  <Markdown content={turn.text} streaming={turn.streaming} />
                </div>
              );
            }

            if (turn.kind === "reasoning") {
              return (
                <div
                  key={turn.id}
                  className="max-w-[95%] border-l-2 border-border pl-3 text-xs italic text-text-tertiary whitespace-pre-wrap"
                >
                  {turn.text}
                </div>
              );
            }

            if (turn.kind === "tool") {
              return (
                <div
                  key={turn.id}
                  className="flex items-center gap-2 font-mono text-xs text-text-secondary"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      turn.running ? "animate-pulse bg-warning" : "bg-success",
                    )}
                  />
                  <span className="font-semibold">{turn.name}</span>
                  {turn.text && (
                    <span className="truncate text-text-tertiary">{turn.text}</span>
                  )}
                </div>
              );
            }

            return (
              <p
                key={turn.id}
                className={cn(
                  "text-xs",
                  turn.tone === "error" ? "text-destructive" : "text-text-tertiary",
                )}
              >
                {turn.text}
              </p>
            );
          })}
          <div ref={endRef} />
        </div>
      </div>

      {historyNote && (
        <p className="px-3 pb-1 text-xs text-text-tertiary">{historyNote}</p>
      )}

      <div className="flex items-end gap-2 border-t border-border p-2 sm:p-3">
        <textarea
          aria-label="Message"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={
            disabled ? "Waiting for the session to open…" : "Message Techno…"
          }
          className="min-h-0 flex-1 resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-midground"
        />
        <Button size="sm" onClick={submit} disabled={disabled || !draft.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
