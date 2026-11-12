import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DrawerTabStrip } from './index'

afterEach(cleanup)

describe('DrawerTabStrip', () => {
  it('renders the six standing drawer tabs in order', () => {
    render(<DrawerTabStrip active="files" onSelect={vi.fn()} />)

    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Console',
      'Browser',
      'Folders',
      'Changes',
      'Usage',
      'Document'
    ])
  })

  it('marks the active tab selected and keeps one tab stop', () => {
    render(<DrawerTabStrip active="changes" onSelect={vi.fn()} />)

    const tabs = screen.getAllByRole('tab')

    expect(tabs.map(tab => tab.getAttribute('aria-selected'))).toEqual([
      'false',
      'false',
      'false',
      'true',
      'false',
      'false'
    ])
    expect(tabs.map(tab => tab.getAttribute('tabindex'))).toEqual(['-1', '-1', '-1', '0', '-1', '-1'])
  })

  it('moves the selection with the arrow keys and wraps', () => {
    const onSelect = vi.fn()

    render(<DrawerTabStrip active="files" onSelect={onSelect} />)

    const folders = screen.getAllByRole('tab')[2]

    fireEvent.keyDown(folders, { key: 'ArrowRight' })
    expect(onSelect).toHaveBeenLastCalledWith('changes')

    fireEvent.keyDown(folders, { key: 'ArrowLeft' })
    expect(onSelect).toHaveBeenLastCalledWith('browser')

    fireEvent.keyDown(folders, { key: 'Home' })
    expect(onSelect).toHaveBeenLastCalledWith('console')

    fireEvent.keyDown(folders, { key: 'End' })
    expect(onSelect).toHaveBeenLastCalledWith('document')
  })

  it('selects a tab on click', () => {
    const onSelect = vi.fn()

    render(<DrawerTabStrip active="files" onSelect={onSelect} />)

    fireEvent.click(screen.getAllByRole('tab')[4])
    expect(onSelect).toHaveBeenLastCalledWith('usage')
  })
})
