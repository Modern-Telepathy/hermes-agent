import type { SessionInfo } from "@/lib/api";

/**
 * Splitting for the sidebar's secondary lists. A subagent (delegate) run is
 * still a session — it just has a parent or a source that names the delegation
 * path — so the store gives us both lists for free and no second endpoint is
 * needed.
 */
const AGENT_SOURCE = /sub-?agent|delegat/i;

export function isAgentRun(session: SessionInfo): boolean {
  if (session.parent_session_id) return true;
  return AGENT_SOURCE.test(session.source ?? "");
}

export function splitSessionLists(sessions: SessionInfo[]): {
  conversations: SessionInfo[];
  agents: SessionInfo[];
} {
  const conversations: SessionInfo[] = [];
  const agents: SessionInfo[] = [];
  for (const session of sessions) {
    (isAgentRun(session) ? agents : conversations).push(session);
  }
  return { conversations, agents };
}

/** Row text: the title, else the first message preview, else a placeholder. */
export function sessionLabel(session: SessionInfo, fallback = "Untitled"): string {
  const title = session.title?.trim();
  if (title && title !== "Untitled") return title;
  const preview = session.preview?.trim();
  return preview || fallback;
}
