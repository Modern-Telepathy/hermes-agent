/**
 * Grip-driven reordering for the left nav.
 *
 * Drags start from the row's grip (`[data-nav-grip]`), not from the whole row, so clicking a link
 * never turns into a reorder: the grip is a separate non-anchor control, and its pointerdown is the
 * only thing that arms a drag. Listeners are native and attached to the nav element rather than
 * React props because a drag needs the window for the release (the pointer usually leaves the row
 * it started on) and must not fight the anchor's own click handling.
 *
 * A row is `data-nav-path` inside a `data-nav-group`. Every reorder runs through a FLIP pass so the
 * rows slide to their new positions instead of jumping. Keyboard equivalent: Alt+Arrow on the
 * focused row (or on the focused grip).
 */

import { useEffect, useRef, useState } from "react";

/** Pixels a grip must travel before it counts as a drag rather than a nudge. */
const DRAG_THRESHOLD_PX = 3;
const FLIP_MS = 180;
const FLIP_EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const DRAGGING_CLASS = "nav-row-dragging";
const GRABBING_CLASS = "nav-dragging-active";

export function useSidebarDrag({
  navRef,
  onMove,
}: {
  /** The element that contains the rows; the caller owns it so the JSX keeps a plain ref. */
  navRef: React.RefObject<HTMLElement | null>;
  onMove: (from: string, to: string, group: string) => void;
}): { dragging: string | null } {
  const [dragging, setDragging] = useState<string | null>(null);
  // The effect owns the listeners for its whole life, so the callback is read through a ref
  // instead of re-subscribing on every render of the page.
  const onMoveRef = useRef(onMove);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    let source: string | null = null;
    let group = "";
    let rowElement: HTMLElement | null = null;
    let armed = false;
    let startX = 0;
    let startY = 0;

    const endDrag = () => {
      rowElement?.classList.remove(DRAGGING_CLASS);
      document.body.classList.remove(GRABBING_CLASS);
      source = null;
      group = "";
      rowElement = null;
      armed = false;
      setDragging(null);
    };

    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("[data-nav-grip]")) return;
      const row = rowAt(target);
      if (!row) return;
      // The grip is the drag affordance: no hold timer, no text selection, no native drag.
      event.preventDefault();
      source = row.path;
      group = row.group;
      rowElement = target.closest<HTMLElement>("[data-nav-path]");
      startX = event.clientX;
      startY = event.clientY;
      armed = false;
      setDragging(row.path);
    };

    const move = (event: PointerEvent) => {
      if (!source) return;
      if (!armed) {
        if (Math.hypot(event.clientX - startX, event.clientY - startY) < DRAG_THRESHOLD_PX) return;
        armed = true;
        rowElement?.classList.add(DRAGGING_CLASS);
        document.body.classList.add(GRABBING_CLASS);
      }
      const row = rowAt(document.elementFromPoint(event.clientX, event.clientY));
      if (!row || row.path === source || row.group !== group) return;
      const from = source;
      reorderWithFlip(row.group, () => onMoveRef.current(from, row.path, row.group));
      source = row.path;
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
      reorderWithFlip(row.group, () => onMoveRef.current(row.path, target, row.group));
    };

    nav.addEventListener("pointerdown", down);
    nav.addEventListener("pointermove", move);
    nav.addEventListener("keydown", key);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      endDrag();
      nav.removeEventListener("pointerdown", down);
      nav.removeEventListener("pointermove", move);
      nav.removeEventListener("keydown", key);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [navRef]);

  return { dragging };
}

/**
 * Apply a reorder and animate the rows into their new slots. Rows are measured before the mutation
 * and again on the next frame; the difference becomes the first keyframe of a WAAPI animation, so
 * the DOM reorder is instant while the movement is visible and nothing is left behind in inline
 * styles (a stuck `transform` would offset a row that later becomes sticky).
 */
function reorderWithFlip(group: string, mutate: () => void) {
  const container = document.querySelector(`[data-nav-group="${group}"]`);
  if (!container) {
    mutate();
    return;
  }
  const rows = Array.from(container.querySelectorAll<HTMLElement>("[data-nav-path]"));
  const before = new Map(rows.map((row) => [row, row.getBoundingClientRect().top]));
  mutate();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  requestAnimationFrame(() => {
    for (const row of container.querySelectorAll<HTMLElement>("[data-nav-path]")) {
      const from = before.get(row);
      if (from === undefined) continue;
      const delta = from - row.getBoundingClientRect().top;
      if (Math.abs(delta) < 1) continue;
      row.animate(
        [{ transform: `translateY(${delta}px)` }, { transform: "none" }],
        { duration: FLIP_MS, easing: FLIP_EASING },
      );
    }
  });
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
