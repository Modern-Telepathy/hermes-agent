import { useStore } from '@nanostores/react'

import { DisclosureCaret } from '@/components/ui/disclosure-caret'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { $sidebarPluginsOpen, $sidebarSectionHeights, setSidebarPluginsOpen } from '@/store/layout'

import type { SidebarNavItem } from '../../types'

import { openDashboardApp } from './open-dashboard-app'
import { SidebarSectionResizeGrip } from './section-resize-grip'

/**
 * The dashboard's "Plugins" nav section, on the desktop: the contributed
 * `sidebar.nav` rows (a plugin pairing a full page with a sidebar entry) get
 * their own group and heading instead of being mixed in with the built-ins.
 * Nothing renders when no plugin contributes a row.
 */
export function SidebarPluginNavSection({
  activePath,
  items,
  onNavigate
}: {
  activePath: string
  items: SidebarNavItem[]
  onNavigate: (item: SidebarNavItem) => void
}) {
  const open = useStore($sidebarPluginsOpen)
  const height = useStore($sidebarSectionHeights).plugins

  if (items.length === 0) {
    return null
  }

  return (
    <nav
      aria-labelledby="sidebar-plugins-heading"
      className="flex shrink-0 flex-col pt-1"
      data-section-open={open ? 'true' : 'false'}
      data-sidebar-section="plugins"
      data-slot="sidebar-plugins"
      // A cap, never a fixed box: a stored plugins height must not leave a blank
      // block under the rows the way a fixed one did (see section-stack.tsx).
      style={open && height !== undefined ? { boxSizing: 'border-box', maxHeight: height, overflow: 'hidden' } : undefined}
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

      <div className="min-h-0 flex-1 overflow-y-auto" data-plugin-nav-scroll="">
      {open && (
        <ul className="flex flex-col gap-px" id="sidebar-plugins-rows">
          {items.map(item => (
            <SidebarMenuItem data-plugin-nav-row={item.id} key={item.id}>
              <SidebarMenuButton
                className={cn(
                  'flex h-7 w-full justify-start gap-2 rounded-md border border-transparent px-[var(--ui-row-px,0.5rem)] text-left text-[0.8125rem] font-medium text-(--ui-text-secondary) transition-colors duration-100 ease-out [-webkit-app-region:no-drag] hover:bg-(--ui-control-hover-background) hover:text-foreground hover:transition-none',
                  // The same active classes the built-in rows use, so the
                  // focused-route test (and anything keyed off the row) reads
                  // plugin and core navigation identically.
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
            </SidebarMenuItem>
          ))}
        </ul>
      )}
      </div>
      <SidebarSectionResizeGrip id="plugins" />
    </nav>
  )
}
