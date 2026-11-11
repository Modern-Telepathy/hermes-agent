import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

const NAV_HIDDEN_KEY = "hermes-sidebar-nav-hidden";
/** A released drag below this height hides the list instead of leaving a sliver. */
const HIDE_THRESHOLD_PX = 48;
/** A released drag within this much of the full height snaps back to auto. */
const FULL_SNAP_PX = 8;
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
 * A sidebar section that ends in a grippable divider. Dragging the divider
 * resizes the list above it and the height stays where it was released, so
 * the divider does not spring back under the pointer; past the hide
 * threshold it collapses completely, and near the full height it snaps back
 * to auto. Clicking or pressing Enter toggles; ArrowUp/ArrowDown collapse and
 * expand.
 *
 * Only the hidden flag is persisted, never a pixel height: a stored height
 * goes stale as soon as a translation or the user's font size changes the
 * content. A session-lifetime height is dropped on window resize once it no
 * longer fits.
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
  const [height, setHeight] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const setNavHidden = useCallback((next: boolean) => {
    setHidden(next);
    storeHidden(next);
  }, []);

  useEffect(() => {
    if (height === null) return;
    const onResize = () => {
      const content = contentRef.current;
      if (content && height > content.scrollHeight) setHeight(null);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [height]);

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const start = hidden ? 0 : (contentRef.current?.offsetHeight ?? 0);
    let latest = start;
    dragRef.current = { pointerY: event.clientY, height: start, moved: false };

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const drag = dragRef.current;
      const content = contentRef.current;
      if (!drag || !content) return;
      const delta = moveEvent.clientY - drag.pointerY;
      if (!drag.moved && Math.abs(delta) <= DRAG_SLOP_PX) return;
      drag.moved = true;
      latest = Math.max(0, Math.min(content.scrollHeight, drag.height + delta));
      setDragging(true);
      setHeight(latest);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const drag = dragRef.current;
      dragRef.current = null;
      setDragging(false);
      if (!drag?.moved) {
        // A plain click: leave the layout to the toggle handler.
        setHeight(null);
        return;
      }
      const full = contentRef.current?.scrollHeight ?? 0;
      suppressClickRef.current = true;
      if (latest <= Math.min(HIDE_THRESHOLD_PX, full / 2)) {
        setHeight(null);
        setNavHidden(true);
      } else if (latest >= full - FULL_SNAP_PX) {
        setHeight(null);
        setNavHidden(false);
      } else {
        // Keep the height the pointer was released at.
        setNavHidden(false);
        setHeight(latest);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setHeight(null);
    setNavHidden(!hidden);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHeight(null);
      setNavHidden(true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setHeight(null);
      setNavHidden(false);
    }
  };

  const squashed = hidden && height === null;

  return (
    <div className="flex min-h-0 flex-col">
      <div
        className={cn(
          "min-h-0 overflow-hidden",
          !dragging && "transition-[height] duration-200 ease-out",
        )}
        id={contentId}
        inert={squashed}
        ref={contentRef}
        style={{ height: height ?? (hidden ? 0 : undefined) }}
      >
        {children}
      </div>

      {hasListBelow && (
        <button
          aria-controls={contentId}
          aria-expanded={!hidden && height === null ? true : !squashed}
          aria-label={`${squashed ? t.common.expand : t.common.collapse} ${t.app.navigation}`}
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
