import { describe, expect, it } from 'vitest'

import { normalizeNavIconOverride, sanitizeNavIconOverrides } from './sidebar-nav-icons'

describe('sidebar nav icon overrides', () => {
  it('normalizes colors and clamps the radius', () => {
    expect(
      normalizeNavIconOverride({ background: '#ABC', kind: 'emoji', radius: 92, value: '✨' })
    ).toEqual({ background: '#aabbcc', kind: 'emoji', radius: 50, value: '✨' })
  })

  it('rejects unsafe values and keeps valid entries', () => {
    expect(normalizeNavIconOverride({ kind: 'icon', value: '"><script>' })).toBeNull()
    expect(normalizeNavIconOverride({ kind: 'emoji', value: '' })).toBeNull()

    expect(
      sanitizeNavIconOverrides({
        __proto__: { kind: 'emoji', value: 'x' },
        artifacts: { kind: 'icon', value: 'files', background: null, radius: 12 },
        bad: { kind: 'emoji', value: 'x'.repeat(40) }
      })
    ).toEqual({ artifacts: { background: null, kind: 'icon', radius: 12, value: 'files' } })
  })
})
