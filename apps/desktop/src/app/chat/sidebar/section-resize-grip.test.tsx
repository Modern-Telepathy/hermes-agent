import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it } from 'vitest'

import { $sidebarSectionHeights, setSidebarSectionHeight } from '@/store/layout'

import { SidebarSectionResizeGrip } from './section-resize-grip'

beforeEach(() => $sidebarSectionHeights.set({}))

it('moves its section height from the keyboard', () => {
  $sidebarSectionHeights.set({ pins: 200 })
  render(
    <div>
      <SidebarSectionResizeGrip id="pins" />
    </div>
  )

  fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowDown' })
  expect($sidebarSectionHeights.get().pins).toBe(216)

  fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowUp' })
  expect($sidebarSectionHeights.get().pins).toBe(200)
})

it('clamps stored heights to the section floor and ceiling', () => {
  setSidebarSectionHeight('pins', -40)
  expect($sidebarSectionHeights.get().pins).toBe(24)

  setSidebarSectionHeight('pins', 99_999)
  expect($sidebarSectionHeights.get().pins).toBe(720)
})
