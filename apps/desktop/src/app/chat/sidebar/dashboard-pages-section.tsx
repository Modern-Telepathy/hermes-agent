import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { useGatewayRequest } from '@/app/gateway/hooks/use-gateway-request'
import { Codicon } from '@/components/ui/codicon'
import { DisclosureCaret } from '@/components/ui/disclosure-caret'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { $sidebarDashboardOpen, setSidebarDashboardOpen } from '@/store/layout'
import { notifyError } from '@/store/notifications'
import { $activeProfile } from '@/store/profile'

import { openDashboardPage } from './open-dashboard-app'

/** Dashboard pages with no native desktop equivalent. They open as embedded
 *  pages in the workspace, chromeless, the same surface plugin apps use. */
const DASHBOARD_PAGES = [
  { icon: 'graph', label: 'Analytics', path: '/analytics', requiresTokenAnalytics: true },
  { icon: 'shield', label: 'Pairing', path: '/pairing' },
  // Trailing slash avoids the gateway's FastAPI Swagger UI, which owns `/docs`.
  { icon: 'book', label: 'Documentation', path: '/docs/' },
  { icon: 'person-add', label: 'Profile builder', path: '/profiles/new' }
] as const

export function SidebarDashboardPagesSection() {
  const open = useStore($sidebarDashboardOpen)
  const profile = useStore($activeProfile)
  const { gateway, requestGateway } = useGatewayRequest()
  const [showTokenAnalytics, setShowTokenAnalytics] = useState(false)

  useEffect(() => {
    let cancelled = false

    void requestGateway('config.get', { key: 'dashboard.show_token_analytics', profile })
      .then(result => {
        if (!cancelled) {
          setShowTokenAnalytics((result as { value?: unknown } | null)?.value === true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setShowTokenAnalytics(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [gateway, profile, requestGateway])

  const pages = DASHBOARD_PAGES.filter(page => !('requiresTokenAnalytics' in page) || showTokenAnalytics)

  return (
    <nav
      aria-labelledby="sidebar-dashboard-heading"
      className="shrink-0 pb-1"
      data-section-open={open ? 'true' : 'false'}
      data-slot="sidebar-dashboard-pages"
    >
      <div className="group/section flex items-center justify-between gap-1 pb-1 pt-1.5" data-section-heading="">
        <button
          aria-controls="sidebar-dashboard-rows"
          aria-expanded={open}
          className="flex w-fit min-w-0 items-center gap-1 rounded-sm bg-transparent text-left leading-none text-(--ui-text-secondary) transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset"
          onClick={() => setSidebarDashboardOpen(!open)}
          type="button"
        >
          <span className="truncate text-[0.6875rem] font-medium" id="sidebar-dashboard-heading">
            Dashboard
          </span>
          <DisclosureCaret
            className="text-(--ui-text-tertiary) opacity-60 transition group-hover/section:opacity-100"
            open={open}
          />
        </button>
      </div>

      {open && (
        <ul className="flex flex-col gap-px" id="sidebar-dashboard-rows">
          {pages.map(page => (
            <SidebarMenuItem key={page.path}>
              <SidebarMenuButton
                className={cn(
                  'flex h-7 w-full items-center gap-2 rounded-md border border-transparent px-[var(--ui-row-px,0.5rem)] text-left text-[0.8125rem] font-medium text-(--ui-text-secondary) transition-colors hover:bg-(--ui-control-hover-background) hover:text-foreground'
                )}
                onClick={() => {
                  void openDashboardPage(page.label, page.path).then(opened => {
                    if (!opened) {
                      notifyError(new Error('No local dashboard answered.'), `Could not open ${page.label}`)
                    }
                  })
                }}
                tooltip={page.label}
                type="button"
              >
                <Codicon className="size-4 shrink-0" name={page.icon} />
                <span className="min-w-0 truncate">{page.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </ul>
      )}
    </nav>
  )
}
