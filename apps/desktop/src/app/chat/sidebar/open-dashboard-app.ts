import { findGroupOfPane } from '@/components/pane-shell/tree/model'
import { $layoutTree, moveTreePanes, revealTreePane } from '@/components/pane-shell/tree/store'
import { dashboardPageUrl, resolveDashboardBaseUrl, sameDashboardUrl } from '@/store/dashboard-apps'
import { $rightRailActiveTabId, selectRightRailTab } from '@/store/layout'
import { PREVIEW_TILE_PREFIX } from '@/store/preview-explicit'
import { $activeProfile } from '@/store/profile'

import type { SidebarNavItem } from '../../types'

/**
 * A dashboard plugin is a page served by the local web dashboard, so it cannot
 * be an internal desktop route. It opens as a Browser preview tab — the one
 * embedded surface that can render it — and then moves into the main workspace
 * group so the app fills the content area instead of sitting in the 22rem
 * right-hand drawer previews dock into by default.
 *
 * The move is a no-op when the tab already lives in that group (a second click
 * on the same app just fronts it).
 */
function promoteToWorkspace(tabId: string): void {
  const paneId = `${PREVIEW_TILE_PREFIX}:${tabId}`
  const tree = $layoutTree.get()
  const workspace = tree ? findGroupOfPane(tree, 'workspace') : null

  if (!workspace) {
    return
  }

  if (!workspace.panes.includes(paneId)) {
    moveTreePanes([paneId], { groupId: workspace.id, pos: 'center' }, paneId)
  }

  revealTreePane(paneId)
}

/**
 * Open any dashboard page as a full-workspace embedded app. Dashboard plugin
 * apps and the dashboard's own web-only views (Analytics, Pairing, Docs) all
 * travel this one path. Returns false when no dashboard answers or the preview
 * never adopted the tab, so the caller can surface the failure.
 */
export async function openDashboardPage(
  label: string,
  path: string,
  profile: null | string = $activeProfile.get()
): Promise<boolean> {
  const base = await resolveDashboardBaseUrl()

  if (!base) {
    return false
  }

  const url = dashboardPageUrl(base, path, profile)
  const { $previewTabs, newBrowserTab, openPreview } = await import('@/store/preview')

  const existing = $previewTabs
    .get()
    .find(tab => tab.target.kind === 'url' && sameDashboardUrl(tab.target.url, url))

  if (existing) {
    selectRightRailTab(existing.id)
  } else {
    // A dashboard view is a workspace surface of its own. Mint the blank tab
    // first: openPreview adopts the active blank browser instead of reusing
    // whichever dashboard page happened to be open before.
    newBrowserTab()
    openPreview({ kind: 'url', label, source: url, url })
  }

  const tabId = $rightRailActiveTabId.get()

  if (!tabId) {
    return false
  }

  // The pane mirror adopts the freshly opened tab synchronously on the
  // $previewTabs change, so the move can happen right away; the frame below
  // covers adoption that lands one render later.
  promoteToWorkspace(tabId)
  requestAnimationFrame(() => promoteToWorkspace(tabId))

  return true
}

/**
 * Open a dashboard plugin's page as a full-workspace embedded app. Returns
 * false when no dashboard answers, so the caller can fall back to the plugin's
 * settings row.
 */
export async function openDashboardApp(item: SidebarNavItem): Promise<boolean> {
  return item.dashboardPath ? openDashboardPage(item.label, item.dashboardPath) : false
}
