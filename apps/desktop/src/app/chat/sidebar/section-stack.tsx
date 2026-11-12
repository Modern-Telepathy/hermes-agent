import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useStore } from '@nanostores/react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { $sidebarSectionHeights, $sidebarSectionOrder, setSidebarSectionOrder } from '@/store/layout'

import { ReorderableList, useSortableBindings } from './reorderable-list'
import { SidebarSectionResizeGrip } from './section-resize-grip'

/**
 * The sidebar's main sections are reorderable as whole blocks. The order is
 * persisted, and a section is dragged by holding its header: the wrapper only
 * arms a drag when the press started inside `[data-section-heading]`, so
 * collapsing a section and dragging its rows stay their own gestures.
 */
export function SidebarSectionStack({ children }: { children: React.ReactNode }) {
  const stored = useStore($sidebarSectionOrder)
  const byId = new Map<string, React.ReactElement>()

  for (const child of React.Children.toArray(children)) {
    if (React.isValidElement<{ id?: string }>(child) && child.props.id) {
      byId.set(child.props.id, child)
    }
  }

  const ids = [...stored.filter(id => byId.has(id)), ...[...byId.keys()].filter(id => !stored.includes(id))]

  const sensors = useSensors(
    // Hold, don't jiggle: the header is also the collapse toggle, so a plain
    // click must still toggle and only a ~200ms press starts a section drag.
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  return (
    <ReorderableList ids={ids} onReorder={setSidebarSectionOrder} sensors={sensors}>
      {ids.map(id => byId.get(id))}
    </ReorderableList>
  )
}

export function SidebarSection({
  children,
  className,
  id
}: {
  children: React.ReactNode
  className?: string
  id: string
}) {
  const { dragging, dragHandleProps, ref, style } = useSortableBindings(id)
  const height = useStore($sidebarSectionHeights)[id]

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    const target = event.target

    if (!(target instanceof Element) || !target.closest('[data-section-heading]')) {
      return
    }

    dragHandleProps.onPointerDown?.(event as React.PointerEvent<HTMLElement>)
  }

  return (
    <div
      className={cn(className, dragging && 'z-10 rounded-md bg-(--ui-control-active-background)')}
      data-sidebar-section={id}
      onPointerDown={handlePointerDown}
      ref={ref}
      style={{
        ...style,
        // A stored height CAPS the section, it never reserves the space: a
        // fixed height left the rows' leftover as a blank block between the
        // last row and the next section (Sessions, whose body is `flex-1`,
        // stretched into whatever height the grip last recorded). The section
        // still scrolls on its own once its content outgrows the cap.
        ...(height === undefined
          ? null
          : { boxSizing: 'border-box' as const, flex: '0 0 auto', maxHeight: height, overflowY: 'auto' as const })
      }}
    >
      {children}
      <SidebarSectionResizeGrip id={id} />
    </div>
  )
}
