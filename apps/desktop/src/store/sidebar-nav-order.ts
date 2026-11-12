import { Codecs, persistentAtom } from '@/lib/persisted'

// The user's own order for the sidebar's top nav rows, ported from the
// dashboard's `sidebar-order`. Stored as ids rather than indices: contributed
// rows come and go between loads, and an index-based order would silently
// shuffle everything when one appears.
//
// `sidebarNav.prefs` contributions still arbitrate first (they may hide a row
// or place one ahead of the rest); this order only arranges what is left.
const STORAGE_KEY = 'hermes.desktop.sidebarNavOrder.v1'

export const $sidebarNavOrder = persistentAtom<string[]>(STORAGE_KEY, [], Codecs.stringArray)

export function setSidebarNavOrder(ids: string[]): void {
  $sidebarNavOrder.set(ids)
}

/** Saved ids first in their saved order, then anything the order does not
 *  mention keeps its shipped position. */
export function applyNavOrder<T extends { id: string }>(items: readonly T[], order: readonly string[]): T[] {
  if (order.length === 0) {
    return [...items]
  }

  const rank = new Map(order.map((id, index) => [id, index]))

  const known = items
    .filter(item => rank.has(item.id))
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))

  const unknown = items.filter(item => !rank.has(item.id))

  return [...known, ...unknown]
}

/** The new order after moving `from` to `to`, or the same array when the move
 *  is a no-op or out of range. */
export function moveNavId(ids: readonly string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) {
    return [...ids]
  }

  const next = [...ids]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)

  return next
}
