/**
 * The sidebar's reorder gesture, end to end: a real press → move → release on a
 * row must make ReorderableList report the new id order.
 *
 * Every reorderable surface (sections, nav rows, sessions, projects, gateway
 * groups, plugins, bots) is `useSortableBindings(id)` inside one
 * `ReorderableList`, so this one gesture covers the machinery they share. The
 * component tests next to each surface assert the bindings and the gates; none
 * of them presses and moves the pointer, which is where dnd-kit either arms or
 * silently declines (it refuses a press whose native event is already
 * `defaultPrevented`, and a row that starts another pointer gesture on the same
 * press must not eat it).
 */

import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { dragBy, reorderPointer, stackRects } from './reorder-test-events'
import { ReorderableList, useSortableBindings } from './reorderable-list'

function Row({ id, label }: { id: string; label: string }) {
  const { dragHandleProps, ref, style } = useSortableBindings(id)

  return (
    <div data-row={id} onPointerDown={dragHandleProps.onPointerDown} ref={ref} style={style}>
      <span data-reorder-handle {...dragHandleProps}>
        {label}
      </span>
    </div>
  )
}

function Harness({ ids, onReorder }: { ids: string[]; onReorder: (ids: string[]) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  return (
    <ReorderableList ids={ids} onReorder={onReorder} sensors={sensors}>
      {ids.map(id => (
        <Row id={id} key={id} label={id} />
      ))}
    </ReorderableList>
  )
}

describe('sidebar reorder gesture', () => {
  it('reports the new order when a row is pressed and dragged 6px past the threshold', () => {
    const onReorder = vi.fn()

    const { container } = render(<Harness ids={['a', 'b', 'c']} onReorder={onReorder} />)

    stackRects(container, '[data-row]')
    dragBy(container.querySelector<HTMLElement>('[data-row="a"]')!, 40)

    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(onReorder.mock.calls[0][0]).toEqual(['b', 'a', 'c'])
  })

  it('leaves a press that never passes the threshold alone, so the row still clicks', () => {
    const onReorder = vi.fn()

    const { container } = render(<Harness ids={['a', 'b']} onReorder={onReorder} />)
    const row = container.querySelector<HTMLElement>('[data-row="a"]')!

    reorderPointer(row, 'pointerdown', 20, 20)
    reorderPointer(globalThis.document, 'pointerup', 20, 22)

    expect(onReorder).not.toHaveBeenCalled()
  })
})
