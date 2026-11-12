import { useStore } from '@nanostores/react'

import { DisclosureCaret } from '@/components/ui/disclosure-caret'
import { $sidebarFactoriesOpen, setSidebarFactoriesOpen } from '@/store/layout'

/**
 * The dashboard's "Factories" library section, carried to the desktop as its
 * own collapsible block. Nothing on this surface creates a factory yet, so the
 * body is the shared empty state — the section exists so the list has a home
 * and the open/closed choice persists like every other section.
 */
export function SidebarFactoriesSection() {
  const open = useStore($sidebarFactoriesOpen)

  return (
    <div className="shrink-0 pb-1" data-section-open={open ? 'true' : 'false'} data-slot="sidebar-factories">
      <div className="group/section flex items-center justify-between gap-1 pb-1 pt-1.5" data-section-heading="">
        <button
          aria-expanded={open}
          className="flex w-fit min-w-0 items-center gap-1 rounded-sm bg-transparent text-left leading-none text-(--ui-text-secondary) transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset"
          onClick={() => setSidebarFactoriesOpen(!open)}
          type="button"
        >
          <span className="truncate text-[0.6875rem] font-medium">Factories</span>
          <DisclosureCaret
            className="text-(--ui-text-tertiary) opacity-60 transition group-hover/section:opacity-100"
            open={open}
          />
        </button>
      </div>

      {open && (
        <p className="px-1 py-1 text-[0.6875rem] text-(--ui-text-tertiary)">No factories yet</p>
      )}
    </div>
  )
}
