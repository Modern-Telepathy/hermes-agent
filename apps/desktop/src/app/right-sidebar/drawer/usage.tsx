import { compactNumber } from '@hermes/shared'
import { useStore } from '@nanostores/react'

import { ContextUsagePanel } from '@/app/shell/context-usage-panel'
import { useContextBreakdown } from '@/app/shell/hooks/use-context-breakdown'
import { useI18n } from '@/i18n'
import { requestGatewayForActiveRoute } from '@/store/active-route-request'
import { $activeGatewayProfile } from '@/store/profile'
import { $activeSessionId, $busy, $currentUsage } from '@/store/session'

import { EmptyState } from '../index'

/**
 * The drawer's Usage tab: the same context breakdown the statusbar gauge
 * opens, given room to stay open — plus the session's running totals. The
 * breakdown RPC is the read-only chars/4 estimate; it never spends a provider
 * call or touches the prompt cache (see `useContextBreakdown`).
 */
export function UsageTab() {
  const { t } = useI18n()
  const r = t.rightSidebar.drawer
  const usage = useStore($currentUsage)
  const busy = useStore($busy)
  const sessionId = useStore($activeSessionId)
  const profile = useStore($activeGatewayProfile)

  const { breakdown, loading } = useContextBreakdown({
    busy,
    enabled: Boolean(sessionId),
    requestGateway: (method, params) => requestGatewayForActiveRoute(profile, method, params),
    sessionId
  })

  if (!sessionId) {
    return <EmptyState body={r.usageNoSession} title={r.usageEmptyTitle} />
  }

  const rows: [string, string][] = [
    [r.usageInput, compactNumber(usage.input)],
    [r.usageOutput, compactNumber(usage.output)]
  ]

  if (usage.cache_hit_pct !== undefined) {
    rows.push([r.usageCacheHit, `${Math.round(usage.cache_hit_pct)}%`])
  }

  if (usage.avg_tps) {
    rows.push([r.usageThroughput, usage.avg_tps.toFixed(1)])
  }

  if (usage.cost_usd) {
    rows.push([r.usageCost, `$${usage.cost_usd.toFixed(2)}`])
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <ContextUsagePanel breakdown={breakdown} loading={loading} usage={usage} />

      <dl className="flex flex-col gap-1 px-3 pb-3 text-[0.68rem]">
        {rows.map(([label, value]) => (
          <div className="flex items-center justify-between gap-2" key={label}>
            <dt className="text-(--ui-text-quaternary)">{label}</dt>
            <dd className="tabular-nums text-(--ui-text-secondary)">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
