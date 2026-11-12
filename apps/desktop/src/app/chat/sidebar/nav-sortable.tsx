import type * as React from 'react'

import { Codicon } from '@/components/ui/codicon'
import { SidebarMenuItem } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

import { ARTIFACTS_ROUTE, CAPABILITIES_ROUTE, CRON_ROUTE, MESSAGING_ROUTE } from '../../routes'
import type { SidebarNavItem } from '../../types'

import { useSortableBindings } from './reorderable-list'

// A row's `tier` is the one mode it belongs to (Simple keeps the setup rows,
// Advanced adds the readouts); the list filters once, nothing is passed down.
export const SIDEBAR_NAV: SidebarNavItem[] = [
  {
    id: 'new-session',
    iconName: 'add',
    label: '',
    icon: props => <Codicon name="add" {...props} />,
    action: 'new-session',
    keybindActionId: 'session.new'
  },
  {
    id: 'capabilities',
    iconName: 'tools',
    label: '',
    icon: props => <Codicon name="tools" {...props} />,
    route: CAPABILITIES_ROUTE,
    keybindActionId: 'nav.capabilities'
  },
  {
    id: 'plugins',
    iconName: 'extensions',
    label: 'Plugins',
    icon: props => <Codicon name="extensions" {...props} />,
    route: `${CAPABILITIES_ROUTE}?tab=plugins`
  },
  {
    id: 'messaging',
    iconName: 'comment',
    label: '',
    icon: props => <Codicon name="comment" {...props} />,
    route: MESSAGING_ROUTE,
    keybindActionId: 'nav.messaging'
  },
  // Artifacts and Automations are outputs of running Hermes the developer
  // way; Toolkit and Messaging are how anyone sets it up.
  {
    id: 'artifacts',
    iconName: 'files',
    label: '',
    icon: props => <Codicon name="files" {...props} />,
    route: ARTIFACTS_ROUTE,
    keybindActionId: 'nav.artifacts',
    tier: 'advanced'
  },
  {
    id: 'cron',
    iconName: 'clock',
    label: '',
    icon: props => <Codicon name="clock" {...props} />,
    route: CRON_ROUTE,
    keybindActionId: 'nav.cron',
    tier: 'advanced'
  }
]

/**
 * One sortable row of the sidebar's top nav.
 *
 * The whole row is the drag handle — no grip mark, no extra control: press and
 * hold anywhere on the row to lift it, release to drop. The nav's sensor uses a
 * delay (not a distance), so an ordinary click still navigates and only a held
 * press reorders. The keyboard activator stays off the row: dnd-kit's keyboard
 * attributes on a container would swallow Space for the row's own button.
 *
 * Rendered as the `<li>` itself (not a wrapper <div>) so the sidebar menu stays
 * a valid list.
 */
export function SortableNavRow({ children, id }: { children: React.ReactNode; id: string }) {
  const { dragging, dragHandleProps, ref, style } = useSortableBindings(id)

  return (
    <SidebarMenuItem
      className={cn(dragging && 'z-10 rounded-md bg-(--ui-control-active-background)')}
      data-nav-row={id}
      onPointerDown={dragHandleProps.onPointerDown}
      ref={ref}
      style={style}
    >
      {children}
    </SidebarMenuItem>
  )
}
