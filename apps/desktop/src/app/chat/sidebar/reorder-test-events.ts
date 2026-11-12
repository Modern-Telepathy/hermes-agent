/**
 * Synthetic pointer gestures for the sidebar reorder tests.
 *
 * jsdom ships no `PointerEvent`, so the fields dnd-kit's PointerSensor reads
 * (`isPrimary`, `button`, the coordinates) are defined onto a plain Event. The
 * activator declines anything that is not a primary button-0 press, which is
 * why a `MouseEvent` alone silently does nothing.
 */
import { fireEvent } from '@testing-library/react'

export function reorderPointer(
  target: Document | Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  x: number,
  y: number
): void {
  const event = new Event(type, { bubbles: true, cancelable: true })

  Object.defineProperties(event, {
    button: { value: 0 },
    buttons: { value: 1 },
    clientX: { value: x },
    clientY: { value: y },
    isPrimary: { value: true },
    pointerId: { value: 1 },
    pointerType: { value: 'mouse' }
  })

  fireEvent(target, event)
}

/** jsdom reports every rect as 0×0, so dnd-kit has nothing to collide against.
 *  Stack `selector`'s elements 40px apart, in DOM order. */
export function stackRects(container: HTMLElement, selector: string, height = 40): void {
  for (const [index, element] of [...container.querySelectorAll<HTMLElement>(selector)].entries()) {
    element.getBoundingClientRect = () =>
      ({
        bottom: index * height + height,
        height,
        left: 0,
        right: 200,
        top: index * height,
        width: 200,
        x: 0,
        y: index * height,
        toJSON: () => ({})
      }) as DOMRect
  }
}

/** Press the element at its center, drag `dy` pixels, release. */
export function dragBy(element: Element, dy: number, y = 20): void {
  reorderPointer(element, 'pointerdown', 20, y)
  reorderPointer(globalThis.document, 'pointermove', 20, y + Math.abs(dy) / 2)
  reorderPointer(globalThis.document, 'pointermove', 20, y + Math.abs(dy))
  reorderPointer(globalThis.document, 'pointerup', 20, y + Math.abs(dy))
}
