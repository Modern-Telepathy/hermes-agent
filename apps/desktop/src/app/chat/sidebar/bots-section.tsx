import type { useSensors } from '@dnd-kit/core'
import { useStore } from '@nanostores/react'
import { type ReactNode, useEffect, useMemo } from 'react'

import { Codicon } from '@/components/ui/codicon'
import { DisclosureCaret } from '@/components/ui/disclosure-caret'
import { cn } from '@/lib/utils'
import { $sidebarBotOrder, $sidebarBotsOpen, setSidebarBotOrder, setSidebarBotsOpen } from '@/store/layout'
import {
  $activeProfile,
  $profiles,
  profileLabel,
  refreshProfiles,
  sortByProfileOrder,
  switchProfile
} from '@/store/profile'

import { ReorderableList, useSortableBindings } from './reorderable-list'

/**
 * The dashboard's "Bots" list, on the desktop: every profile (a bot in Bot
 * Mode) is one row here, with the active one marked. Selecting a row makes
 * that bot active — the same switch the profile pickers perform.
 *
 * Rows drag-reorder like every other sidebar list. The order is the section's
 * own (`$sidebarBotOrder`), not the profile rail's: the rail lists named
 * profiles only, so sharing its order would push the default bot to the tail
 * the first time someone dragged the rail.
 */
function BotsRowButton({ active, name, onSelect }: { active: boolean; name: string; onSelect: () => void }) {
  return (
    <button
      className={cn(
        'flex h-7 w-full items-center gap-2 rounded-md border border-transparent px-[var(--ui-row-px,0.5rem)] text-left text-[0.8125rem] font-medium text-(--ui-text-secondary) transition-colors hover:bg-(--ui-control-hover-background) hover:text-foreground',
        active && 'border-(--ui-stroke-tertiary) bg-(--ui-control-active-background) text-foreground'
      )}
      onClick={onSelect}
      type="button"
    >
      <Codicon className="size-4 shrink-0" name="robot" />
      <span className="min-w-0 truncate">{name}</span>
    </button>
  )
}

function SortableBotRow({ children, id }: { children: ReactNode; id: string }) {
  const { dragging, dragHandleProps, ref, style } = useSortableBindings(id)

  return (
    <li
      className={cn('rounded-md', dragging && 'z-10 bg-(--ui-control-active-background)')}
      data-bots-row={id}
      onPointerDown={dragHandleProps.onPointerDown}
      ref={ref}
      style={style}
    >
      {children}
    </li>
  )
}

export function SidebarBotsSection({ sensors }: { sensors?: ReturnType<typeof useSensors> }) {
  const open = useStore($sidebarBotsOpen)
  const profiles = useStore($profiles)
  const active = useStore($activeProfile)
  const order = useStore($sidebarBotOrder)

  useEffect(() => {
    if (profiles.length === 0) {
      void refreshProfiles().catch(() => undefined)
    }
  }, [profiles.length])

  // A saved order only arranges what it names: anything new keeps its shipped
  // position (see sortByProfileOrder), so a bot created elsewhere still shows
  // up without the section being dragged first.
  const rows = useMemo(() => (order.length > 0 ? sortByProfileOrder(profiles, order) : profiles), [order, profiles])

  const row = (profile: (typeof rows)[number]) => (
    <BotsRowButton
      active={profile.name === active}
      name={profileLabel(profile)}
      onSelect={() => void switchProfile(profile.name).catch(() => undefined)}
    />
  )

  return (
    <nav
      aria-labelledby="sidebar-bots-heading"
      className="shrink-0 pb-1"
      data-section-open={open ? 'true' : 'false'}
      data-slot="sidebar-bots"
    >
      <div className="group/section flex items-center justify-between gap-1 pb-1 pt-1.5" data-section-heading="">
        <button
          aria-controls="sidebar-bots-rows"
          aria-expanded={open}
          className="flex w-fit min-w-0 items-center gap-1 rounded-sm bg-transparent text-left leading-none text-(--ui-text-secondary) transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset"
          onClick={() => setSidebarBotsOpen(!open)}
          type="button"
        >
          <span className="truncate text-[0.6875rem] font-medium" id="sidebar-bots-heading">
            Bots
          </span>
          <DisclosureCaret
            className="text-(--ui-text-tertiary) opacity-60 transition group-hover/section:opacity-100"
            open={open}
          />
        </button>
      </div>

      {open &&
        (profiles.length === 0 ? (
          <p className="px-1 py-1 text-[0.6875rem] text-(--ui-text-tertiary)">No bots yet</p>
        ) : (
          <ul className="flex flex-col gap-px" id="sidebar-bots-rows">
            {rows.length > 1 ? (
              <ReorderableList ids={rows.map(profile => profile.name)} onReorder={setSidebarBotOrder} sensors={sensors}>
                {rows.map(profile => (
                  <SortableBotRow id={profile.name} key={profile.name}>
                    {row(profile)}
                  </SortableBotRow>
                ))}
              </ReorderableList>
            ) : (
              rows.map(profile => <li key={profile.name}>{row(profile)}</li>)
            )}
          </ul>
        ))}
    </nav>
  )
}
