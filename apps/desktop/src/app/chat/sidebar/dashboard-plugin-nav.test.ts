import { expect, it } from 'vitest'

import type { AgentPluginRow } from '@/store/agent-plugins'

import { dashboardPluginNavRows } from './dashboard-plugin-nav'

const plugin = (name: string, manifest: AgentPluginRow['dashboard_manifest']): AgentPluginRow => ({
  description: '',
  name,
  source: 'bundled',
  status: 'enabled',
  version: '1',
  dashboard_manifest: manifest
})

it('lists dashboard tabs by label, skipping hidden and override manifests', () => {
  const rows = dashboardPluginNavRows(
    [
      plugin('kanban', { name: 'kanban', label: 'Kanban', tab: { path: '/kanban' } }),
      plugin('slots-only', { name: 'slots-only', label: 'Slots', tab: { hidden: true } }),
      plugin('override', { name: 'override', label: 'Override', tab: { override: '/chat' } })
    ],
    []
  )

  expect(rows.map(row => row.label)).toEqual(['Kanban'])
  expect(rows[0]).toMatchObject({ plugin: 'kanban', path: '/kanban', id: 'dashboard-plugin:kanban' })
})

it('falls back to the plugin name and /name when the manifest omits them', () => {
  const [row] = dashboardPluginNavRows([plugin('notes', { name: 'notes' })], [])

  expect(row).toMatchObject({ label: 'notes', path: '/notes' })
})

it('includes dashboard-only manifests and de-dupes by plugin name', () => {
  const rows = dashboardPluginNavRows(
    [plugin('docs', { name: 'docs', label: 'Docs' })],
    [
      { name: 'docs', label: 'Docs (orphan)' },
      { name: 'sheets', label: 'Sheets' }
    ]
  )

  expect(rows.map(row => row.label)).toEqual(['Docs', 'Sheets'])
})

it('sorts case-insensitively by label', () => {
  const rows = dashboardPluginNavRows(
    [plugin('zed', { name: 'zed', label: 'zed' }), plugin('alpha', { name: 'alpha', label: 'Alpha' })],
    []
  )

  expect(rows.map(row => row.label)).toEqual(['Alpha', 'zed'])
})
