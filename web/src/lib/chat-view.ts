import { useSyncExternalStore } from "react";

/**
 * Which surface the Chat tab renders: the streaming chat view or the raw
 * terminal ("code"). It lives outside the page so the sidebar header can flip
 * it from anywhere, and it is persisted because it is a durable preference
 * rather than page state.
 */
export type ChatView = "chat" | "terminal";

const CHAT_VIEW_KEY = "hermes-chat-view";
const listeners = new Set<() => void>();

function readChatView(): ChatView {
  try {
    return localStorage.getItem(CHAT_VIEW_KEY) === "terminal" ? "terminal" : "chat";
  } catch {
    return "chat";
  }
}

export function subscribeChatView(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getChatView(): ChatView {
  return readChatView();
}

export function setChatView(next: ChatView) {
  if (readChatView() === next) return;
  try {
    localStorage.setItem(CHAT_VIEW_KEY, next);
  } catch {
    /* localStorage may be unavailable in private browsing */
  }
  for (const listener of listeners) listener();
}

/** Shared Chat / Code preference, kept in sync across the sidebar and the page. */
export function useChatView(): [ChatView, (next: ChatView) => void] {
  const view = useSyncExternalStore(subscribeChatView, getChatView, getChatView);
  return [view, setChatView];
}
