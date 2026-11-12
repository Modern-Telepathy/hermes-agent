import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { Codicon } from '@/components/ui/codicon'
import { SidebarProvider } from '@/components/ui/sidebar'
import { $sidebarPluginsOpen } from '@/store/layout'

import type { SidebarNavItem } from '../../types'

import { SidebarPluginNavSection } from './plugin-nav-section'

const ITEMS: SidebarNavItem[] = [
  { id: 'kanban', label: 'Kanban', icon: props => <Codicon name="project" {...props} />, route: '/kanban' }
]

const renderSection = (onNavigate: (item: SidebarNavItem) => void = () => {}, items = ITEMS) =>
  render(
    <SidebarProvider>
      <SidebarPluginNavSection activePath="/" items={items} onNavigate={onNavigate} />
    </SidebarProvider>
  )

beforeEach(() => {
  $sidebarPluginsOpen.set(true)
})

afterEach(cleanup)

it('renders contributed rows under a Plugins heading', () => {
  renderSection()

  expect(screen.getByText('Plugins')).toBeTruthy()
  expect(screen.getByText('Kanban')).toBeTruthy()
})

it('collapses the rows and persists the choice', () => {
  renderSection()

  fireEvent.click(screen.getByRole('button', { name: /plugins/i }))

  expect($sidebarPluginsOpen.get()).toBe(false)
  expect(screen.queryByText('Kanban')).toBeNull()
})

it('renders nothing when no plugin contributes a row', () => {
  const { container } = render(
    <SidebarProvider>
      <SidebarPluginNavSection activePath="/" items={[]} onNavigate={() => {}} />
    </SidebarProvider>
  )

  expect(container.querySelector('[data-slot=sidebar-plugins]')).toBeNull()
})

it('routes a click through the shared nav handler', () => {
  const onNavigate = vi.fn()
  renderSection(onNavigate)

  fireEvent.click(screen.getByText('Kanban'))

  expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ id: 'kanban' }))
})
