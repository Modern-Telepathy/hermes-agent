import { Codecs, persistentAtom } from '@/lib/persisted'

/**
 * Horizontal padding for the sidebar rows (nav, plugin, bot rows), in px.
 * `null`-free shape: the toggle turns the override on and off, and the number
 * is what it paints while on. The shipped padding stays the default, so an
 * existing user sees no change until they opt in.
 */
export interface ThemePadding {
  enabled: boolean
  px: number
}

export const THEME_PADDING_MIN = 0
export const THEME_PADDING_MAX = 24
export const DEFAULT_THEME_PADDING: ThemePadding = { enabled: false, px: 8 }

export function clampThemePadding(px: number): number {
  return Math.min(THEME_PADDING_MAX, Math.max(THEME_PADDING_MIN, Math.round(px)))
}

export function sanitizeThemePadding(raw: unknown): ThemePadding {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_THEME_PADDING
  }

  const source = raw as Partial<Record<keyof ThemePadding, unknown>>

  return {
    enabled: source.enabled === true,
    px: typeof source.px === 'number' && Number.isFinite(source.px) ? clampThemePadding(source.px) : DEFAULT_THEME_PADDING.px
  }
}

export const $themePadding = persistentAtom<ThemePadding>(
  'hermes.desktop.themePadding.v1',
  DEFAULT_THEME_PADDING,
  Codecs.json(sanitizeThemePadding)
)

/** Paint the override as `--ui-row-px`; off removes it, restoring the theme's own padding. */
export function applyThemePadding(value: ThemePadding): void {
  if (typeof document === 'undefined') {
    return
  }

  if (value.enabled) {
    document.documentElement.style.setProperty('--ui-row-px', `${clampThemePadding(value.px)}px`)
  } else {
    document.documentElement.style.removeProperty('--ui-row-px')
  }
}

export function setThemePadding(patch: Partial<ThemePadding>): void {
  const next = { ...$themePadding.get(), ...patch }

  $themePadding.set({ enabled: next.enabled, px: clampThemePadding(next.px) })
}

export function resetThemePadding(): void {
  $themePadding.set(DEFAULT_THEME_PADDING)
}

applyThemePadding($themePadding.get())
$themePadding.subscribe(applyThemePadding)
