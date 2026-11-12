import type { AgentPluginRow, DashboardPluginManifest } from '@/store/agent-plugins'

/** One row of the sidebar's Plugins section, sourced from a Webapp manifest. */
export interface DashboardPluginNavRow {
  id: string
  label: string
  /** The dashboard's own route for the page (`/kanban`); kept for parity/debug. */
  path: string
  plugin: string
}

const manifestRow = (manifest: DashboardPluginManifest | null | undefined): DashboardPluginNavRow | null => {
  if (!manifest) {
    return null
  }

  const name = (manifest.name ?? '').trim()

  if (!name) {
    return null
  }

  // `hidden` = registers slots/components but adds no tab; `override` replaces
  // a built-in dashboard route, so it is not a plugin page of its own.
  if (manifest.tab?.hidden || manifest.tab?.override) {
    return null
  }

  return {
    id: `dashboard-plugin:${name}`,
    label: (manifest.label ?? '').trim() || name,
    path: (manifest.tab?.path ?? '').trim() || `/${name}`,
    plugin: name
  }
}

/**
 * The dashboard's plugin tabs as sidebar rows: each plugin that ships a
 * `dashboard/manifest.json` page, whether or not it also has an agent half.
 * Ordered by label so the list does not reshuffle with disk order.
 */
export function dashboardPluginNavRows(
  plugins: readonly AgentPluginRow[],
  orphans: readonly DashboardPluginManifest[]
): DashboardPluginNavRow[] {
  const seen = new Set<string>()
  const rows: DashboardPluginNavRow[] = []

  for (const manifest of [...plugins.map(plugin => plugin.dashboard_manifest), ...orphans]) {
    const row = manifestRow(manifest)

    if (row && !seen.has(row.plugin)) {
      seen.add(row.plugin)
      rows.push(row)
    }
  }

  return rows.sort((a, b) => a.label.localeCompare(b.label))
}
