/**
 * Persisted left-nav order.
 *
 * Stored as paths rather than indices: plugin tabs come and go between loads, and an index-based
 * order would silently shuffle everything when one appears. Unknown paths are ignored and items
 * missing from the saved order keep their manifest position at the end.
 */

export interface SidebarOrder {
  core: string[];
  plugins: string[];
}

export const SIDEBAR_ORDER_KEY = "hermes-sidebar-order";

export function emptySidebarOrder(): SidebarOrder {
  return { core: [], plugins: [] };
}

function parseOrder(raw: string | null): SidebarOrder {
  if (!raw) return emptySidebarOrder();
  try {
    const value = JSON.parse(raw) as Partial<SidebarOrder>;
    const paths = (input: unknown): string[] =>
      Array.isArray(input) ? input.filter((p): p is string => typeof p === "string") : [];
    return { core: paths(value.core), plugins: paths(value.plugins) };
  } catch {
    return emptySidebarOrder();
  }
}

function storageOf(storage?: Storage): Storage | undefined {
  if (storage) return storage;
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function readStoredSidebarOrder(storage?: Storage): SidebarOrder {
  try {
    const store = storageOf(storage);
    return parseOrder(store ? store.getItem(SIDEBAR_ORDER_KEY) : null);
  } catch {
    return emptySidebarOrder();
  }
}

export function writeStoredSidebarOrder(order: SidebarOrder, storage?: Storage): void {
  try {
    storageOf(storage)?.setItem(SIDEBAR_ORDER_KEY, JSON.stringify(order));
  } catch {
    /* private browsing or a full quota: the order stays for this session only */
  }
}

/** Saved paths first in their saved order, then anything the order does not mention. */
export function applySidebarOrder<T extends { path: string }>(
  items: T[],
  order: string[],
): T[] {
  if (order.length === 0) return items;
  const rank = new Map(order.map((path, index) => [path, index]));
  const known = items
    .filter((item) => rank.has(item.path))
    .sort((a, b) => (rank.get(a.path) ?? 0) - (rank.get(b.path) ?? 0));
  const unknown = items.filter((item) => !rank.has(item.path));
  return [...known, ...unknown];
}

export function orderPaths<T extends { path: string }>(items: T[]): string[] {
  return items.map((item) => item.path);
}

export function movePath(paths: string[], from: number, to: number): string[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= paths.length ||
    to >= paths.length
  ) {
    return paths;
  }
  const next = paths.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
