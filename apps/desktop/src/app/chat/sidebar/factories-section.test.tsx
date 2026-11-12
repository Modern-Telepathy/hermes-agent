import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'

import { $sidebarFactoriesOpen } from '@/store/layout'

import { SidebarFactoriesSection } from './factories-section'

beforeEach(() => {
  $sidebarFactoriesOpen.set(false)
})

afterEach(cleanup)

it('starts collapsed and reveals the empty list on toggle', () => {
  render(<SidebarFactoriesSection />)

  const toggle = screen.getByRole('button', { name: /factories/i })

  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByText('No factories yet')).toBeNull()

  fireEvent.click(toggle)

  expect($sidebarFactoriesOpen.get()).toBe(true)
  expect(screen.getByText('No factories yet')).toBeTruthy()
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
})
