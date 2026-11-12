import { beforeEach, expect, it } from 'vitest'

import { $themePadding, applyThemePadding, clampThemePadding, resetThemePadding, setThemePadding } from './theme-padding'

beforeEach(() => resetThemePadding())

it('clamps the padding to the supported range', () => {
  expect(clampThemePadding(-5)).toBe(0)
  expect(clampThemePadding(999)).toBe(24)
  expect(clampThemePadding(9.6)).toBe(10)
})

it('paints --ui-row-px only while the override is on', () => {
  setThemePadding({ enabled: true, px: 14 })
  expect($themePadding.get()).toEqual({ enabled: true, px: 14 })
  expect(document.documentElement.style.getPropertyValue('--ui-row-px')).toBe('14px')

  setThemePadding({ enabled: false })
  expect(document.documentElement.style.getPropertyValue('--ui-row-px')).toBe('')

  applyThemePadding({ enabled: true, px: 6 })
  expect(document.documentElement.style.getPropertyValue('--ui-row-px')).toBe('6px')
})
