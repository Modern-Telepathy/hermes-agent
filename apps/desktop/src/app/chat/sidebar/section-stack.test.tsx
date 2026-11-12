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

// The stored resize height is a CAP on the body. Applied to the section itself
// it both reserved space the rows did not fill and put the grip inside that
// scroll box, so the grip scrolled out of sight on a long list instead of
// sitting on the boundary with the next section.
it('caps the section body so the grip stays on the section boundary', () => {
  $sidebarSectionHeights.set({ sessions: 420 })

  const section = renderSection('sessions')
  const body = section.querySelector<HTMLElement>('[data-section-body]')

  expect(body?.style.maxHeight).toBe('420px')
  expect(section.style.maxHeight).toBe('')

  // The grip must sit beside the scroller, never inside it.
  expect(body?.querySelector('[data-section-resize]')).toBeNull()
  expect(section.querySelector(':scope > [data-section-resize]')).not.toBeNull()
})

it('leaves an unresized section body unbounded', () => {
  const section = renderSection('bots')

  expect(section.querySelector<HTMLElement>(':scope > [data-section-body]')?.style.maxHeight).toBe('')
  expect(section.style.maxHeight).toBe('')
  expect(section.style.height).toBe('')
})
