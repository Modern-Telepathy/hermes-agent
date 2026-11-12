import { Codecs, persistentAtom } from '@/lib/persisted'

// Two independent corner radii, ported from the dashboard's `theme-corners`.
//
// The theme owns its base radius; these knobs let a person round buttons and
// containers/modals separately, which is a real design choice (a pill button
// over a square panel) rather than one scale factor. Values are px; `null`
// means "follow the theme", so the shipped look survives a reset.
const STORAGE_KEY = 'hermes.desktop.themeCorners.v1'

export const MIN_CORNER_RADIUS = 0
export const MAX_CORNER_RADIUS = 24

export type CornerKind = 'button' | 'container'

export interface ThemeCorners {
  button: null | number
  container: null | number
}

export const DEFAULT_THEME_CORNERS: ThemeCorners = { button: null, container: null }

const CSS_VARS: Record<CornerKind, string> = {
  button: '--theme-radius-button',
  container: '--theme-radius-container'
}

export function clampCornerRadius(value: number): number {
  return Math.min(MAX_CORNER_RADIUS, Math.max(MIN_CORNER_RADIUS, Math.round(value)))
}

/** Persisted shapes are untrusted: keep only finite numbers, clamped. */
export function sanitizeThemeCorners(raw: unknown): ThemeCorners {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_THEME_CORNERS
  }

  const source = raw as Partial<Record<CornerKind, unknown>>

  const pick = (value: unknown): null | number =>
    typeof value === 'number' && Number.isFinite(value) ? clampCornerRadius(value) : null

  return { button: pick(source.button), container: pick(source.container) }
}

export const $themeCorners = persistentAtom<ThemeCorners>(
  STORAGE_KEY,
  DEFAULT_THEME_CORNERS,
  Codecs.json(sanitizeThemeCorners)
)

/** Paint the overrides as root CSS vars; `null` removes the var so the
 *  stylesheet's theme-derived default applies again. */
export function applyThemeCorners(corners: ThemeCorners): void {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement

  for (const kind of ['button', 'container'] as const) {
    const value = corners[kind]

    if (value === null) {
      root.style.removeProperty(CSS_VARS[kind])
    } else {
      root.style.setProperty(CSS_VARS[kind], `${value}px`)
    }
  }
}

export function setThemeCorner(kind: CornerKind, value: null | number): void {
  $themeCorners.set({
    ...$themeCorners.get(),
    [kind]: value === null ? null : clampCornerRadius(value)
  })
}

export function resetThemeCorners(): void {
  $themeCorners.set(DEFAULT_THEME_CORNERS)
}

/** Apply now (before first paint) and on every later change. */
export function installThemeCorners(): void {
  applyThemeCorners($themeCorners.get())
  $themeCorners.subscribe(applyThemeCorners)
}

installThemeCorners()
