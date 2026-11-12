/**
 * The embedded chat's `/api/events` channel.
 *
 * The dashboard chat is a PTY: `ChatPage` owns the channel id that ties its
 * PTY child to the event fan-out, and nothing in the DOM names it. Dashboard
 * plugins that want the live turn events (`message.start`, `tool.start`,
 * `message.complete`, …) need that id, so it is published here and exposed on
 * the plugin SDK as `chat.channel()` / `chat.subscribe()`. One value at a
 * time: the dashboard mounts exactly one chat host.
 */

let _channel: string | null = null;
const _listeners = new Set<(channel: string | null) => void>();

export function getActiveChatChannel(): string | null {
  return _channel;
}

/** Publish the chat host's channel; a null clears it when the host unmounts. */
export function setActiveChatChannel(channel: string | null): void {
  if (channel === _channel) return;
  _channel = channel;
  for (const fn of _listeners) {
    try {
      fn(channel);
    } catch {
      /* a plugin listener must not break the chat host */
    }
  }
}

export function subscribeActiveChatChannel(
  fn: (channel: string | null) => void,
): () => void {
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
  };
}
