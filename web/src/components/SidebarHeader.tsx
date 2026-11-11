import { useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Terminal,
  X,
} from "lucide-react";
import { useChatView } from "@/lib/chat-view";
import { cn } from "@/lib/utils";

interface SidebarHeaderProps {
  collapsed: boolean;
  onCloseMobile: () => void;
  onQueryChange: (query: string) => void;
  onToggleCollapsed: () => void;
  query: string;
}

const ICON_BUTTON =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-current/10 hover:text-midground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30";

/**
 * Sticky top bar of the sidebar: the drawer/collapse control, the Chat / Code
 * switch and the navigation search. It stays pinned while the nav scrolls, so
 * those controls never scroll away with the list.
 */
export function SidebarHeader({
  collapsed,
  onCloseMobile,
  onQueryChange,
  onToggleCollapsed,
  query,
}: SidebarHeaderProps) {
  const [chatView, setChatView] = useChatView();
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const closeSearch = () => {
    setSearchOpen(false);
    onQueryChange("");
  };

  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex shrink-0 flex-col gap-1",
        "border-b border-current/20 bg-background-base px-2 py-1.5",
        collapsed && "lg:items-center lg:px-1",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-1",
          collapsed && "lg:flex-col lg:gap-2",
        )}
      >
        <button
          aria-label="Close navigation"
          className={cn(ICON_BUTTON, "lg:hidden")}
          onClick={onCloseMobile}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>

        <button
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          className={cn(ICON_BUTTON, "hidden lg:inline-flex")}
          onClick={onToggleCollapsed}
          type="button"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>

        <div
          aria-label="Chat view"
          className={cn(
            "inline-flex min-w-0 items-center gap-0.5 rounded-md border border-current/20 p-0.5",
            collapsed && "hidden",
          )}
          role="group"
        >
          <button
            aria-pressed={chatView === "chat"}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors",
              chatView === "chat"
                ? "bg-current/10 text-midground"
                : "text-text-secondary hover:text-midground",
            )}
            onClick={() => setChatView("chat")}
            type="button"
          >
            <MessageSquare className="h-3 w-3" />
            Chat
          </button>
          <button
            aria-pressed={chatView === "terminal"}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors",
              chatView === "terminal"
                ? "bg-current/10 text-midground"
                : "text-text-secondary hover:text-midground",
            )}
            onClick={() => setChatView("terminal")}
            type="button"
          >
            <Terminal className="h-3 w-3" />
            Code
          </button>
        </div>

        {/* Icon rail has no room for the pair, so it gets one flip button. */}
        <button
          aria-label={chatView === "chat" ? "Switch to code view" : "Switch to chat view"}
          className={cn(ICON_BUTTON, "hidden", collapsed && "lg:inline-flex")}
          onClick={() => setChatView(chatView === "chat" ? "terminal" : "chat")}
          type="button"
        >
          {chatView === "chat" ? (
            <MessageSquare className="h-4 w-4" />
          ) : (
            <Terminal className="h-4 w-4" />
          )}
        </button>

        <button
          aria-expanded={searchOpen}
          aria-label="Search navigation"
          className={cn(ICON_BUTTON, "ml-auto", collapsed && "lg:ml-0")}
          onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          type="button"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>

      {searchOpen && (
        <div className="relative flex min-w-0 items-center">
          <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-text-tertiary" />
          <input
            aria-label="Search navigation"
            className="h-8 w-full min-w-0 rounded-md border border-current/20 bg-transparent pl-7 pr-2 text-xs text-midground placeholder:text-text-tertiary focus-visible:border-current/40 focus-visible:outline-none"
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") closeSearch();
            }}
            placeholder="Search navigation…"
            ref={inputRef}
            type="search"
            value={query}
          />
        </div>
      )}
    </div>
  );
}
