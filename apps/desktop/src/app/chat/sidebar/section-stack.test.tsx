import { DndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { render } from '@testing-library/react'
import type * as React from 'react'
import { beforeEach, expect, it } from 'vitest'

import { $sidebarSectionHeights } from '@/store/layout'

import { SidebarSection } from './section-stack'

beforeEach(() => $sidebarSectionHeights.set({}))

function renderSection(id: string, children: React.ReactNode = 'rows') {
  const { container } = render(
    <DndContext>
      <SortableContext items={[id]}>
        <SidebarSection id={id}>{children}</SidebarSection>
      </SortableContext>
    </DndContext>
  )

  const section = container.querySelector<HTMLElement>(`[data-sidebar-section="${id}"]`)

  if (!section) {
    throw new Error(`section ${id} did not render`)
  }

  return section
}

// The stored resize height is a CAP. Applied as a fixed height, a section whose
// rows had since shrunk kept the old height as a blank block between its last
// row and the next section — the gap under the Sessions list.
it('caps a resized section at its stored height instead of reserving that space', () => {
  $sidebarSectionHeights.set({ sessions: 420 })

  const section = renderSection('sessions')

  expect(section.style.maxHeight).toBe('420px')
  expect(section.style.height).toBe('')
})

it('leaves an unresized section unbounded', () => {
  const section = renderSection('bots')

  expect(section.style.maxHeight).toBe('')
  expect(section.style.height).toBe('')
})
