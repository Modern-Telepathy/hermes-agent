import { beforeEach, describe, expect, it } from 'vitest'

import {
  applyThemeCorners,
  clampCornerRadius,
  DEFAULT_THEME_CORNERS,
  MAX_CORNER_RADIUS,
  MIN_CORNER_RADIUS,
  sanitizeThemeCorners
} from './theme-corners'

describe('clampCornerRadius', () => {
  it('rounds to whole pixels', () => {
    expect(clampCornerRadius(7.6)).toBe(8)
  })

  it('keeps values inside the supported range', () => {
    expect(clampCornerRadius(-4)).toBe(MIN_CORNER_RADIUS)
    expect(clampCornerRadius(999)).toBe(MAX_CORNER_RADIUS)
  })
})

describe('sanitizeThemeCorners', () => {
  it('falls back to "follow the theme" for a missing or malformed record', () => {
    expect(sanitizeThemeCorners(null)).toEqual(DEFAULT_THEME_CORNERS)
    expect(sanitizeThemeCorners('nope')).toEqual(DEFAULT_THEME_CORNERS)
    expect(sanitizeThemeCorners({})).toEqual(DEFAULT_THEME_CORNERS)
  })

  it('keeps each knob independent and clamps what it keeps', () => {
    expect(sanitizeThemeCorners({ button: 6, container: 40 })).toEqual({
      button: 6,
      container: MAX_CORNER_RADIUS
    })
  })

  it('drops a non-numeric knob instead of coercing it', () => {
    expect(sanitizeThemeCorners({ button: '6', container: 10 })).toEqual({ button: null, container: 10 })
  })
})

describe('applyThemeCorners', () => {
  beforeEach(() => {
    document.documentElement.style.cssText = ''
  })

  it('writes both overrides as px root vars', () => {
    applyThemeCorners({ button: 4, container: 12 })

    expect(document.documentElement.style.getPropertyValue('--theme-radius-button')).toBe('4px')
    expect(document.documentElement.style.getPropertyValue('--theme-radius-container')).toBe('12px')
  })

  it('removes the var when a knob returns to the theme default', () => {
    applyThemeCorners({ button: 4, container: 12 })
    applyThemeCorners({ button: null, container: 12 })

    expect(document.documentElement.style.getPropertyValue('--theme-radius-button')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--theme-radius-container')).toBe('12px')
  })
})
