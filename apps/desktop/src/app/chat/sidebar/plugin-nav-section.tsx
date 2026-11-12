import type { useSensors } from '@dnd-kit/core'
import { useStore } from '@nanostores/react'
import type { ReactNode } from 'react'

import { DisclosureCaret } from '@/components/ui/disclosure-caret'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { $sidebarPluginsOpen, $sidebarSectionHeights, setSidebarPluginsOpen } from '@/store/layout'

import type { SidebarNavItem } from '../../types'

import { openDashboardApp } from './open-dashboard-app'
import { ReorderableList, useSortableBindings } from './reorderable-list'
import { SidebarSectionResizeGrip } from './section-resize-grip'

/**
 * The dashboard's "Plugins" nav section, on the desktop: the contributed
 * `sidebar.nav` rows (a plugin pairing a full page with a sidebar entry) get
 * their own group and heading instead of being mixed in with the built-ins.
 * Nothing renders when no plugin contributes a row.
 *
 * Rows drag-reorder like the built-ins do, but through their own list: the two
 * groups are rendered apart, so a drag can only ever rearrange this section
 * (a plugin row dropped among the first-party pages would read as one). The
 * order they write is the shared nav order, so both groups persist together.
 */
function SortablePluginRow({ children, id }: { children: ReactNode; id: string }) {
  const { dragging, dragHandleProps, ref, style } = useSortableBindings(id)

  return (
    <SidebarMenuItem
      className={cn(dragging && 'z-10 rounded-md bg-(--ui-control-active-background)')}
      data-plugin-nav-row={id}
      onPointerDown={dragHandleProps.onPointerDown}
      ref={ref}
      style={style}
    >
      {children}
    </SidebarMenuItem>
  )
}

export function SidebarPluginNavSection({
  activePath,
  items,
  onNavigate,
  onReorder,
  sensors
}: {
  activePath: string
  items: SidebarNavItem[]
  onNavigate: (item: SidebarNavItem) => void
  onReorder?: (ids: string[]) => void
  sensors?: ReturnType<typeof useSensors>
}) {
  const open = useStore($sidebarPluginsOpen)
  const height = useStore($sidebarSectionHeights).plugins

  if (items.length === 0) {
    return null
  }

  const row = (item: SidebarNavItem) => (
    <SidebarMenuButton
      className={cn(
        'flex h-7 w-full justify-start gap-2 rounded-md border border-transparent px-[var(--ui-row-px,0.5rem)] text-left text-[0.8125rem] font-medium text-(--ui-text-secondary) transition-colors duration-100 ease-out [-webkit-app-region:no-drag] hover:bg-(--ui-control-hover-background) hover:text-foreground hover:transition-none',
        // The same active classes the built-in rows use, so the focused-route
        // test (and anything keyed off the row) reads plugin and core
        // navigation identically.
        activePath === item.route &&
          'border-(--ui-stroke-tertiary) bg-(--ui-control-active-background) text-foreground shadow-none hover:border-(--ui-stroke-tertiary)!'
      )}
      onClick={() => {
        if (item.dashboardPath) {
          void openDashboardApp(item).then(opened => {
            if (!opened) {
              onNavigate(item)
            }
          })

          return
        }

        onNavigate(item)
      }}
      tooltip={item.label}
      type="button"
    >
      <item.icon className="size-4 shrink-0 text-[color-mix(in_srgb,currentColor_72%,transparent)]" />
      <span className="min-w-0 truncate" data-tour={`sidebar-nav-${item.id}`}>
        {item.label}
      </span>
    </SidebarMenuButton>
  )

  const reorderable = Boolean(onReorder) && items.length > 1

  return (
    <nav
      aria-labelledby="sidebar-plugins-heading"
      // `pr-2` mirrors the sessions scroller's `[scrollbar-gutter:stable]`, which
      // reserves that 8px inside the stack below. Without it this section — the
      // one group rendered outside that scroller — is 8px wider than every
      // other, so its rows sit off-grid and its resize grip centres 4px right
      // of all the rest.
      className="flex shrink-0 flex-col pr-2 pt-1"
      data-section-open={open ? 'true' : 'false'}
      data-sidebar-section="plugins"
      data-slot="sidebar-plugins"
    >
      <div className="group/section flex shrink-0 items-center justify-between gap-1 pb-1" data-section-heading="">
        <button
          aria-controls="sidebar-plugins-rows"
          aria-expanded={open}
          className="flex w-fit min-w-0 items-center gap-1 rounded-sm bg-transparent text-left leading-none text-(--ui-text-secondary) transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset"
          onClick={() => setSidebarPluginsOpen(!open)}
          type="button"
        >
          <span className="truncate text-[0.6875rem] font-medium" id="sidebar-plugins-heading">
            Plugins
          </span>
          <DisclosureCaret
            className="text-(--ui-text-tertiary) opacity-60 transition group-hover/section:opacity-100"
            open={open}
          />
        </button>
      </div>

      {/* The cap rides the scroller, never the nav: capping the nav put the grip
          inside the clipped area, so a resized Plugins section lost its grip.
          A closed section takes no cap at all — its body is empty. */}
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        data-plugin-nav-scroll=""
        data-section-body=""
        style={open && height !== undefined ? { maxHeight: height } : undefined}
      >
        {open && (
          <ul className="flex flex-col gap-px" id="sidebar-plugins-rows">
            {reorderable && onReorder ? (
              <ReorderableList ids={items.map(item => item.id)} onReorder={onReorder} sensors={sensors}>
                {items.map(item => (
                  <SortablePluginRow id={item.id} key={item.id}>
                    {row(item)}
                  </SortablePluginRow>
                ))}
              </ReorderableList>
            ) : (
              items.map(item => (
                <SidebarMenuItem data-plugin-nav-row={item.id} key={item.id}>
                  {row(item)}
                </SidebarMenuItem>
              ))
            )}
          </ul>
        )}
      </div>
      <SidebarSectionResizeGrip id="plugins" />
    </nav>
  )
}
