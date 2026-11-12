/**
 * The sidebar's secondary lists: recent conversations, the agent (delegate)
 * runs spun off them, and factories.
 *
 * Each section is an accordion: a caret header whose body animates open and
 * closed (a `0fr`/`1fr` grid row, so the height eases without measuring), and
 * the rows scroll inside the section once there are more of them than fit.
 * Conversations and agents both come from the session store — an agent run is
 * just a session with a parent (see `lib/sidebar-lists`) — and picking a row
 * resumes it in the chat view. Open/closed state is persisted per section.
 */

import { Bot, ChevronRight, Factory, MessageSquare, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router";

import { api, type SessionInfo } from "@/lib/api";
import { sessionLabel, splitSessionLists } from "@/lib/sidebar-lists";
import { cn, timeAgo } from "@/lib/utils";

const OPEN_KEY = "hermes-sidebar-lists-open";
const SESSION_LIMIT = 60;
/** Rows scroll past this height, so a long history never pushes the footer away. */
const LIST_MAX_HEIGHT = "max-h-60";

type SectionKey = "conversations" | "agents" | "factories";

const DEFAULT_OPEN: Record<SectionKey, boolean> = {
  conversations: true,
  agents: true,
  factories: false,
};

function readOpenState(): Record<SectionKey, boolean> {
  try {
    const stored = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}") as Partial<
      Record<SectionKey, unknown>
    >;
    return {
      conversations:
        typeof stored.conversations === "boolean"
          ? stored.conversations
          : DEFAULT_OPEN.conversations,
      agents: typeof stored.agents === "boolean" ? stored.agents : DEFAULT_OPEN.agents,
      factories: typeof stored.factories === "boolean" ? stored.factories : DEFAULT_OPEN.factories,
    };
  } catch {
    return DEFAULT_OPEN;
  }
}

function useOpenSections(): [
  Record<SectionKey, boolean>,
  (key: SectionKey) => void,
] {
  const [open, setOpen] = useState(readOpenState);
  const toggle = useCallback((key: SectionKey) => {
    setOpen((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify(next));
      } catch {
        /* localStorage may be unavailable in private browsing */
      }
      return next;
    });
  }, []);
  return [open, toggle];
}

/** Recent sessions, loaded once the first session-backed section is opened. */
function useRecentSessions(enabled: boolean): {
  sessions: SessionInfo[] | null;
  error: string | null;
} {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || sessions) return;
    let cancelled = false;
    api
      .getSessions(SESSION_LIMIT, 0, "", "recent")
      .then((res) => {
        if (!cancelled) setSessions(res.sessions);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "failed to load sessions");
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, sessions]);

  return { sessions, error };
}

function SidebarListSection({
  count,
  icon: Icon,
  id,
  label,
  onToggle,
  open,
  children,
}: {
  count: number | null;
  icon: LucideIcon;
  id: string;
  label: string;
  onToggle: () => void;
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <button
        aria-controls={id}
        aria-expanded={open}
        className={cn(
          "group flex w-full items-center gap-2 px-5 py-1.5 text-left",
          "text-text-tertiary transition-colors hover:text-midground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-midground",
        )}
        onClick={onToggle}
        type="button"
      >
        <ChevronRight
          aria-hidden
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-90",
          )}
        />
        <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate text-xs">{label}</span>
        {count !== null && count > 0 && (
          <span className="ml-auto text-[10px] tabular-nums text-text-tertiary/70">{count}</span>
        )}
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(LIST_MAX_HEIGHT, "overflow-y-auto overscroll-contain")}
            id={id}
            role="list"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionRow({
  onNavigate,
  session,
}: {
  onNavigate?: () => void;
  session: SessionInfo;
}) {
  return (
    <Link
      className={cn(
        "group/row flex flex-col gap-0.5 px-5 py-1.5",
        "text-text-secondary transition-colors hover:text-midground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-midground",
      )}
      onClick={onNavigate}
      role="listitem"
      to={`/chat?resume=${encodeURIComponent(session.id)}`}
    >
      <span className="truncate text-xs">{sessionLabel(session)}</span>
      <span className="truncate text-[10px] text-text-tertiary/70">
        {timeAgo(session.last_active)}
        {session.model ? ` · ${session.model}` : null}
      </span>
    </Link>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-1.5 text-[11px] text-text-tertiary/70">{children}</p>;
}

export function SidebarLists({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const [open, toggle] = useOpenSections();
  const { sessions, error } = useRecentSessions(
    !collapsed && (open.conversations || open.agents),
  );
  const baseId = useId();
  const { conversations, agents } = useMemo(
    () => splitSessionLists(sessions ?? []),
    [sessions],
  );

  // The icon rail has no room for a second column of lists.
  if (collapsed) return null;

  const loadingRow = <EmptyRow>Loading…</EmptyRow>;
  const sessionRows = (rows: SessionInfo[], empty: string) => {
    if (error) return <EmptyRow>{error}</EmptyRow>;
    if (!sessions) return loadingRow;
    if (rows.length === 0) return <EmptyRow>{empty}</EmptyRow>;
    return rows.map((session) => (
      <SessionRow key={session.id} onNavigate={onNavigate} session={session} />
    ));
  };

  return (
    <div
      aria-label="Library"
      className="mt-1 flex shrink-0 flex-col border-t border-current/10 pt-1"
      role="group"
    >
      <SidebarListSection
        count={sessions ? conversations.length : null}
        icon={MessageSquare}
        id={`${baseId}-conversations`}
        label="Conversations"
        onToggle={() => toggle("conversations")}
        open={open.conversations}
      >
        {sessionRows(conversations, "No conversations yet")}
      </SidebarListSection>

      <SidebarListSection
        count={sessions ? agents.length : null}
        icon={Bot}
        id={`${baseId}-agents`}
        label="Agents"
        onToggle={() => toggle("agents")}
        open={open.agents}
      >
        {sessionRows(agents, "No agent runs yet")}
      </SidebarListSection>

      <SidebarListSection
        count={null}
        icon={Factory}
        id={`${baseId}-factories`}
        label="Factories"
        onToggle={() => toggle("factories")}
        open={open.factories}
      >
        <EmptyRow>No factories yet</EmptyRow>
      </SidebarListSection>
    </div>
  );
}
