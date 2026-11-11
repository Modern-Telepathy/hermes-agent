/**
 * Hold-and-drag reordering for the left nav.
 *
 * Listeners are native and attached to the nav element rather than React props: a drag needs the
 * window for the release (the pointer usually leaves the row it started on), and it must not fight
 * the anchor's own click handling. A row is simply `data-nav-path` inside a `data-nav-group`.
 *
 * The drag arms only after the pointer is held for `holdMs`, so an ordinary click that wanders a
 * pixel still navigates. Keyboard equivalent: Alt+Arrow on the focused row.
 */

import { useEffect, useRef, useState } from "react";

const DEFAULT_HOLD_MS = 250;
/** Pixels a pointer must travel before a press becomes a drag instead of a click. */
const DRAG_THRESHOLD_PX = 6;

export interface SidebarDrag {
  /** Path of the row being dragged, for styling, or null. */
  dragging: string | null;
  /** Attach to the element that contains the rows. */
  navRef: React.RefObject<HTMLElement | null>;
}

export function useSidebarDrag({
  onMove,
  holdMs = DEFAULT_HOLD_MS,
}: {
  onMove: (from: string, to: string, group: string) => void;
  holdMs?: number;
}): SidebarDrag {
  const [dragging, setDragging] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  // The effect owns the listeners for its whole life, so the callback is read through a ref
  // instead of re-subscribing on every render of the page.
  const onMoveRef = useRef(onMove);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    let timer: number | null = null;
    let source: string | null = null;
    let armed = false;
    let suppressClick = false;
    let startX = 0;
    let startY = 0;

    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const row = rowAt(event.target);
      if (!row) return;
      suppressClick = false;
      source = row.path;
      startX = event.clientX;
      startY = event.clientY;
      clearTimer();
      timer = window.setTimeout(() => {
        if (!source) return;
        armed = true;
        setDragging(source);
      }, holdMs);
    };

    const move = (event: PointerEvent) => {
      if (!source) return;
      if (!armed) {
        // Arm on a real drag as well as on the hold: a pointer that travels past a few pixels was
        // never a click, and waiting out the timer would feel like lag. Below that threshold the
        // gesture stays a click, so links still navigate.
        if (Math.hypot(event.clientX - startX, event.clientY - startY) < DRAG_THRESHOLD_PX) return;
        clearTimer();
        armed = true;
        setDragging(source);
      }
      const row = rowAt(document.elementFromPoint(event.clientX, event.clientY));
      if (!row || row.path === source) return;
      const from = source;
      onMoveRef.current(from, row.path, row.group);
      source = row.path;
    };

    const release = () => {
      clearTimer();
      if (armed && source) suppressClick = true;
      armed = false;
      source = null;
      setDragging(null);
    };

    // A drag that ends over a row must not also follow that row's link.
    const click = (event: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    };

    const key = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
      if (!step) return;
      const row = rowAt(event.target);
      if (!row) return;
      const rows = rowsInGroup(row.group);
      const target = rows[rows.indexOf(row.path) + step];
      if (!target) return;
      event.preventDefault();
      onMoveRef.current(row.path, target, row.group);
    };

    nav.addEventListener("pointerdown", down);
    nav.addEventListener("pointermove", move);
    nav.addEventListener("keydown", key);
    nav.addEventListener("click", click, true);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      clearTimer();
      nav.removeEventListener("pointerdown", down);
      nav.removeEventListener("pointermove", move);
      nav.removeEventListener("keydown", key);
      nav.removeEventListener("click", click, true);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [holdMs]);

  return { dragging, navRef };
}

function rowAt(target: EventTarget | null): { path: string; group: string } | null {
  const row = target instanceof Element ? target.closest("[data-nav-path]") : null;
  const path = row?.getAttribute("data-nav-path");
  if (!row || !path) return null;
  return {
    path,
    group: row.closest("[data-nav-group]")?.getAttribute("data-nav-group") ?? "",
  };
}

/** Paths in the order they are rendered inside one group. */
export function rowsInGroup(group: string): string[] {
  const container = group ? document.querySelector(`[data-nav-group="${group}"]`) : null;
  if (!container) return [];
  return Array.from(
    container.querySelectorAll("[data-nav-path]"),
    (el) => el.getAttribute("data-nav-path") ?? "",
  );
}
