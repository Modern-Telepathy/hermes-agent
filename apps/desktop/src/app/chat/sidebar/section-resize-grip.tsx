import { useStore } from '@nanostores/react'
import type * as React from 'react'
import { useRef } from 'react'

import { $sidebarSectionHeights, setSidebarSectionHeight } from '@/store/layout'

/** A section that measures 0 and has no stored cap starts here when the grip
 *  is first pulled (jsdom measures 0, and a collapsed flex child measures 0
 *  too). */
const DEFAULT_SECTION_HEIGHT = 240
const KEYBOARD_STEP = 16

/**
 * The drag line at the bottom of a sidebar section: pull it to set that
 * section's height, double the affordance of the divider without drawing a
 * permanent border. The section above scrolls once its content no longer fits.
 *
 * Arrow Up/Down move it from the keyboard, so the height is reachable without
 * a pointer. The height is clamped by the store and persisted per section id.
 */
export function SidebarSectionResizeGrip({ id }: { id: string }) {
  const heights = useStore($sidebarSectionHeights)
  const dragRef = useRef<{ height: number; y: number } | null>(null)

  // Grab where the grip IS, not where the stored cap is: a section renders its
  // content up to the cap, so a cap recorded when the section was taller would
  // make the first drag jump by the difference. The cap is only the fallback.
  //
  // Measure the section's BODY — the box the cap actually rides — so the first
  // drag moves by exactly the pixels dragged rather than by the header's (and
  // gripper's) height on top of it.
  const currentHeight = (element: HTMLElement | null): number => {
    const body = element?.querySelector<HTMLElement>(':scope > [data-section-body]')
    const measured = (body ?? element)?.getBoundingClientRect().height ?? 0

    return measured > 0 ? measured : (heights[id] ?? DEFAULT_SECTION_HEIGHT)
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }

    dragRef.current = { height: currentHeight(event.currentTarget.parentElement), y: event.clientY }
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current

    if (drag) {
      setSidebarSectionHeight(id, drag.height + event.clientY - drag.y)
    }
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === 'ArrowDown' ? KEYBOARD_STEP : event.key === 'ArrowUp' ? -KEYBOARD_STEP : 0

    if (delta === 0) {
      return
    }

    event.preventDefault()
    setSidebarSectionHeight(id, currentHeight(event.currentTarget.parentElement) + delta)
  }

  return (
    <div
      aria-label={`Resize ${id}`}
      aria-orientation="horizontal"
      className="group/resize relative flex h-2 w-full shrink-0 cursor-ns-resize touch-none items-center justify-center [-webkit-app-region:no-drag]"
      data-section-resize={id}
      onKeyDown={handleKeyDown}
      onPointerCancel={endDrag}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      role="separator"
      tabIndex={0}
    >
      {/* The band is the hit area, the mark is the affordance: it only paints
          while the pointer or the keyboard is on the grip, so five resting
          dividers never read as five lines drawn under the rows. */}
      <span className="h-px w-8 rounded-full bg-(--ui-stroke-tertiary) opacity-0 transition-opacity group-focus-visible/resize:opacity-100 group-hover/resize:opacity-100" />
    </div>
  )
}
