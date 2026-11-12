import { useSyncExternalStore } from "react";

/**
 * Runtime corner-radius overrides, independent of the active theme.
 *
 * The theme still owns its base radius (`layout.radius`); these two knobs let
 * the user round buttons and containers/modals separately, which is a real
 * design choice (a pill button over a square panel) rather than a single
 * scale factor. Values are px; `null` means "follow the theme".
 */
const STORAGE_KEY = "hermes-theme-corners";
export const MIN_CORNER_RADIUS = 0;
export const MAX_CORNER_RADIUS = 24;

export type CornerKind = "button" | "container";

export interface CornerOverrides {
  button: number | null;
  container: number | null;
}

const CSS_VARS: Record<CornerKind, string> = {
  button: "--theme-radius-button",
  container: "--theme-radius-container",
};

const NO_OVERRIDES: CornerOverrides = { button: null, container: null };
const listeners = new Set<() => void>();
let snapshot: CornerOverrides | null = null;

function clampRadius(value: number): number {
  return Math.min(MAX_CORNER_RADIUS, Math.max(MIN_CORNER_RADIUS, Math.round(value)));
}

function normalize(raw: unknown): CornerOverrides {
  if (!raw || typeof raw !== "object") return NO_OVERRIDES;
  const source = raw as Partial<Record<CornerKind, unknown>>;
  const pick = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? clampRadius(value) : null;
  return { button: pick(source.button), container: pick(source.container) };
}

function readStored(): CornerOverrides {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    return stored ? normalize(JSON.parse(stored)) : NO_OVERRIDES;
  } catch {
    return NO_OVERRIDES;
  }
}

/** Stable snapshot for `useSyncExternalStore` (a fresh object each call would loop). */
export function getCornerOverrides(): CornerOverrides {
  snapshot ??= readStored();
  return snapshot;
}

export function subscribeCornerOverrides(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function apply(corners: CornerOverrides) {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  for (const kind of Object.keys(CSS_VARS) as CornerKind[]) {
    const cssVar = CSS_VARS[kind];
    const value = corners[kind];
    if (value === null) root.style.removeProperty(cssVar);
    else root.style.setProperty(cssVar, `${value}px`);
  }
}

export function setCornerOverride(kind: CornerKind, value: number | null) {
  const next: CornerOverrides = {
    ...getCornerOverrides(),
    [kind]: value === null ? null : clampRadius(value),
  };
  snapshot = next;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* localStorage may be unavailable in private browsing */
  }
  apply(next);
  for (const listener of listeners) listener();
}

/** Re-assert the overrides on `:root` (theme application rewrites the base radius). */
export function applyCornerOverrides() {
  apply(getCornerOverrides());
}

export function useThemeCorners(): CornerOverrides {
  return useSyncExternalStore(
    subscribeCornerOverrides,
    getCornerOverrides,
    getCornerOverrides,
  );
}
