import { Codecs, persistentAtom } from '@/lib/persisted'

export type NavIconKind = 'emoji' | 'icon'

/** A user's replacement for one sidebar nav glyph. The background is optional:
 *  without one the emoji/icon paints directly on the row. `radius` is a
 *  percentage of the square's size, so the same value round-trips to any size. */
export interface NavIconOverride {
  background: null | string
  kind: NavIconKind
  radius: number
  value: string
}

const STORAGE_KEY = 'hermes.desktop.sidebarNavIcons.v1'
const MAX_ENTRIES = 128
const MAX_RADIUS = 50
const MAX_EMOJI_LENGTH = 32
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i
const ICON_NAME = /^[a-z0-9-]+$/
const NAV_ID = /^[a-z0-9:_-]+$/i

function normalizeColor(value: unknown): null | string {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value !== 'string' || !HEX_COLOR.test(value.trim())) {
    return null
  }

  const raw = value.trim().toLowerCase()

  return raw.length === 4
    ? `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`
    : raw
}

/** Accepts only a complete, safe glyph value. Persisted data and the editor
 *  both pass through here, so a malformed localStorage entry cannot inject a
 *  class name or an oversized string into the row. */
export function normalizeNavIconOverride(value: unknown): NavIconOverride | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const candidate = value as Partial<NavIconOverride>

  if (candidate.kind !== 'emoji' && candidate.kind !== 'icon') {
    return null
  }

  const text = typeof candidate.value === 'string' ? candidate.value.trim() : ''

  if (!text || text.length > MAX_EMOJI_LENGTH) {
    return null
  }

  if (candidate.kind === 'icon' && (text.length > 64 || !ICON_NAME.test(text))) {
    return null
  }

  const radius =
    typeof candidate.radius === 'number' && Number.isFinite(candidate.radius)
      ? Math.min(MAX_RADIUS, Math.max(0, Math.round(candidate.radius)))
      : 24

  return {
    background: normalizeColor(candidate.background),
    kind: candidate.kind,
    radius,
    value: text
  }
}

export function sanitizeNavIconOverrides(raw: unknown): Record<string, NavIconOverride> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }

  const next: Record<string, NavIconOverride> = {}

  for (const [id, value] of Object.entries(raw).slice(0, MAX_ENTRIES)) {
    if (id === '__proto__' || id.length > 160 || !NAV_ID.test(id)) {
      continue
    }

    const icon = normalizeNavIconOverride(value)

    if (icon) {
      next[id] = icon
    }
  }

  return next
}

export const $sidebarNavIcons = persistentAtom<Record<string, NavIconOverride>>(
  STORAGE_KEY,
  {},
  Codecs.json(sanitizeNavIconOverrides)
)

export function setSidebarNavIcon(id: string, value: NavIconOverride | null): void {
  if (!id || id.length > 160 || !NAV_ID.test(id)) {
    return
  }

  const current = $sidebarNavIcons.get()
  const icon = value ? normalizeNavIconOverride(value) : null

  if (!icon) {
    if (!(id in current)) {
      return
    }

    const next = { ...current }

    delete next[id]
    $sidebarNavIcons.set(next)

    return
  }

  $sidebarNavIcons.set({ ...current, [id]: icon })
}
