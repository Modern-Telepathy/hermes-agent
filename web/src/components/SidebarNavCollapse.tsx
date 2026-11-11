import { useCallback, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

const NAV_HIDDEN_KEY = "hermes-sidebar-nav-hidden";
/** A released drag inside this band hides the list instead of leaving it squashed. */
const HIDE_THRESHOLD_PX = 48;
/** Below this much vertical travel the pointer counts as a click, not a drag. */
const DRAG_SLOP_PX = 2;

function readStoredHidden(): boolean {
  try {
    return localStorage.getItem(NAV_HIDDEN_KEY) === "true";
  } catch {
    return false;
  }
}

function storeHidden(hidden: boolean) {
  try {
    localStorage.setItem(NAV_HIDDEN_KEY, String(hidden));
  } catch {
    /* localStorage may be unavailable in private browsing */
  }
}

interface SidebarNavCollapseProps {
  children: ReactNode;
  /** Icon rail: the list is icons only, so there is nothing to squish. */
  collapsed: boolean;
  /** Whether another group follows the divider (the plugin section). */
  hasListBelow: boolean;
}

/**
 * A sidebar section that ends in a grippable divider. Dragging the divider up
 * past the threshold hides the list above it, dragging it back down (or
 * clicking / pressing Enter on the grip) restores it.
 *
 * Only the hidden flag is persisted, never a pixel height: a stored height
 * goes stale as soon as a translation or the user's font size changes the
 * content, and then the divider sits somewhere meaningless.
 */
export function SidebarNavCollapse({
  children,
  collapsed,
  hasListBelow,
}: SidebarNavCollapseProps) {
  const { t } = useI18n();
  const contentId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerY: number; height: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [hidden, setHidden] = useState(readStoredHidden);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  const setNavHidden = useCallback((next: boolean) => {
    setHidden(next);
    storeHidden(next);
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const start = hidden ? 0 : (contentRef.current?.offsetHeight ?? 0);
    let latest = start;
    dragRef.current = { pointerY: event.clientY, height: start, moved: false };
    setDragHeight(start);

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const drag = dragRef.current;
      const content = contentRef.current;
      if (!drag || !content) return;
      const delta = moveEvent.clientY - drag.pointerY;
      if (Math.abs(delta) > DRAG_SLOP_PX) drag.moved = true;
      latest = Math.max(0, Math.min(content.scrollHeight, drag.height + delta));
      setDragHeight(latest);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag?.moved) {
        const content = contentRef.current;
        const squashLimit = content
          ? Math.min(HIDE_THRESHOLD_PX, content.scrollHeight / 2)
          : HIDE_THRESHOLD_PX;
        suppressClickRef.current = true;
        setNavHidden(latest <= squashLimit);
      }
      setDragHeight(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setNavHidden(!hidden);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setNavHidden(true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setNavHidden(false);
    }
  };

  const squashed = hidden && dragHeight === null;

  return (
    <div className="flex min-h-0 flex-col">
      <div
        className={cn(
          "min-h-0 overflow-hidden",
          dragHeight === null && "transition-[height] duration-200 ease-out",
        )}
        id={contentId}
        inert={squashed}
        ref={contentRef}
        style={{ height: dragHeight ?? (hidden ? 0 : undefined) }}
      >
        {children}
      </div>

      {hasListBelow && (
        <button
          aria-controls={contentId}
          aria-expanded={!hidden}
          aria-label={`${hidden ? t.common.expand : t.common.collapse} ${t.app.navigation}`}
          className={cn(
            "group flex h-3 w-full shrink-0 cursor-row-resize items-center bg-transparent",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30",
            collapsed && "hidden",
          )}
          onClick={onClick}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          type="button"
        >
          <span
            aria-hidden
            className="block w-full border-t border-current/10 transition-colors group-hover:border-current/40 group-focus-visible:border-current/40 group-active:border-current/60"
          />
        </button>
      )}
    </div>
  );
}
