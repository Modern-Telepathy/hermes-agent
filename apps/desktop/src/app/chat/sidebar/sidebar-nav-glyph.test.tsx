import { describe, expect, it } from 'vitest'

import { navIconForeground } from './sidebar-nav-glyph'

describe('navIconForeground', () => {
  it('uses dark ink on light fills and white ink on dark fills', () => {
    expect(navIconForeground('#ffffff')).toBe('#111827')
    expect(navIconForeground('#111111')).toBe('#ffffff')
  })
})
