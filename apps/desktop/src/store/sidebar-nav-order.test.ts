import { describe, expect, it } from 'vitest'

import { applyNavOrder, moveNavId } from './sidebar-nav-order'

const rows = [{ id: 'new-session' }, { id: 'capabilities' }, { id: 'messaging' }, { id: 'cron' }]

describe('applyNavOrder', () => {
  it('leaves the shipped order alone when nothing was saved', () => {
    expect(applyNavOrder(rows, []).map(row => row.id)).toEqual([
      'new-session',
      'capabilities',
      'messaging',
      'cron'
    ])
  })

  it('places saved ids first, in their saved order', () => {
    expect(applyNavOrder(rows, ['cron', 'capabilities']).map(row => row.id)).toEqual([
      'cron',
      'capabilities',
      'new-session',
      'messaging'
    ])
  })

  it('ignores saved ids that no longer exist and keeps unmentioned rows at the end', () => {
    expect(applyNavOrder(rows, ['retired-row', 'messaging']).map(row => row.id)).toEqual([
      'messaging',
      'new-session',
      'capabilities',
      'cron'
    ])
  })
})

describe('moveNavId', () => {
  it('moves an id to the new slot without mutating the input', () => {
    const ids = ['a', 'b', 'c']
    const next = moveNavId(ids, 0, 2)

    expect(next).toEqual(['b', 'c', 'a'])
    expect(ids).toEqual(['a', 'b', 'c'])
  })

  it('reports the same order for a no-op or out-of-range move', () => {
    expect(moveNavId(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
    expect(moveNavId(['a', 'b'], -1, 3)).toEqual(['a', 'b'])
  })
})
