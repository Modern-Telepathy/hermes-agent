import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import { Codicon } from '@/components/ui/codicon'
import { DisclosureCaret } from '@/components/ui/disclosure-caret'
import { cn } from '@/lib/utils'
import { $sidebarBotsOpen, setSidebarBotsOpen } from '@/store/layout'
import { $activeProfile, $profiles, profileLabel, refreshProfiles, switchProfile } from '@/store/profile'

/**
 * The dashboard's "Bots" list, on the desktop: every profile (a bot in Bot
 * Mode) is one row here, with the active one marked. Selecting a row makes
 * that bot active — the same switch the profile pickers perform.
 */
export function SidebarBotsSection() {
  const open = useStore($sidebarBotsOpen)
  const profiles = useStore($profiles)
  const active = useStore($activeProfile)

  useEffect(() => {
    if (profiles.length === 0) {
      void refreshProfiles().catch(() => undefined)
    }
  }, [profiles.length])

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
            {profiles.map(profile => (
              <li key={profile.name}>
                <button
                  className={cn(
                    'flex h-7 w-full items-center gap-2 rounded-md border border-transparent px-[var(--ui-row-px,0.5rem)] text-left text-[0.8125rem] font-medium text-(--ui-text-secondary) transition-colors hover:bg-(--ui-control-hover-background) hover:text-foreground',
                    profile.name === active &&
                      'border-(--ui-stroke-tertiary) bg-(--ui-control-active-background) text-foreground'
                  )}
                  onClick={() => void switchProfile(profile.name).catch(() => undefined)}
                  type="button"
                >
                  <Codicon className="size-4 shrink-0" name="robot" />
                  <span className="min-w-0 truncate">{profileLabel(profile)}</span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </nav>
  )
}
