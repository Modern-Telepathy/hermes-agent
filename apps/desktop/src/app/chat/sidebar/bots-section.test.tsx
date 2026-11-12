import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'

import { $sidebarBotOrder, $sidebarBotsOpen } from '@/store/layout'
import { $profiles } from '@/store/profile'
import type { ProfileInfo } from '@/types/hermes'

import { SidebarBotsSection } from './bots-section'
import { dragBy, stackRects } from './reorder-test-events'

const profile = (name: string): ProfileInfo => ({
  has_env: false,
  is_default: name === 'default',
  model: null,
  name,
  path: `/tmp/${name}`,
  provider: null,
  skill_count: 0
})

function Host() {
  // The sidebar's row sensors (index.tsx dndSensors): a 6px drag, so a click
  // still switches bots.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  return <SidebarBotsSection sensors={sensors} />
}

const rowIds = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-bots-row]')].map(row => row.getAttribute('data-bots-row'))

beforeEach(() => {
  $sidebarBotsOpen.set(true)
  $sidebarBotOrder.set([])
  $profiles.set([])
})

afterEach(cleanup)

it("renders the section's own saved order, falling back to the backend order when empty", () => {
  $profiles.set([profile('default'), profile('omar')])

  // No saved order yet: the backend's own list order, untouched.
  const first = render(<SidebarBotsSection />)

  expect(rowIds(first.container)).toEqual(['default', 'omar'])

  first.unmount()
  $sidebarBotOrder.set(['omar', 'default'])

  const second = render(<SidebarBotsSection />)

  expect(rowIds(second.container)).toEqual(['omar', 'default'])
})

it('persists the dragged order when a bot row is dropped onto another', () => {
  $profiles.set([profile('default'), profile('omar')])

  const { container } = render(<Host />)

  stackRects(container, '[data-bots-row]')
  dragBy(container.querySelector<HTMLElement>('[data-bots-row="default"]')!, 40)

  expect($sidebarBotOrder.get()).toEqual(['omar', 'default'])
})
