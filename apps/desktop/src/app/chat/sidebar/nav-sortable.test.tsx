import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SortableNavRow } from './nav-sortable'
import { ReorderableList } from './reorderable-list'

// The nav's merge with the desktop sidebar: every row is still a list item with
// its own action, and the row itself is the only drag affordance.
describe('SortableNavRow', () => {
  it('renders one list item per row with no separate grip, leaving the row action intact', () => {
    render(
      <ul>
        <ReorderableList ids={['capabilities', 'cron']} onReorder={vi.fn()}>
          <SortableNavRow id="capabilities">
            <button type="button">Capabilities</button>
          </SortableNavRow>
          <SortableNavRow id="cron">
            <button type="button">Scheduled</button>
          </SortableNavRow>
        </ReorderableList>
      </ul>
    )

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /reorder navigation/i })).toBeNull()
    expect(screen.getByRole('button', { name: 'Capabilities' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Scheduled' })).toBeTruthy()
  })
})
