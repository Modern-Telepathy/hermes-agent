import { atom } from 'nanostores'

/**
 * The local web dashboard's origin. Plugin apps (Docs, Sheets, Kanban, …) are
 * pages of that dashboard — the desktop does not bundle them — so a plugin row
 * opens them in the preview rail rather than in an internal route.
 *
 * Resolution is deliberately lazy and cheap: the desktop's spawn ledger
 * records the dashboard's port, and the two conventional ports are probed as
 * a fallback. The winner is cached for the session.
 */
export const $dashboardBaseUrl = atom<null | string>(null)

const FALLBACK_ORIGINS = ['http://127.0.0.1:9220', 'http://127.0.0.1:9119']
const PROBE_TIMEOUT_MS = 1500

export const dashboardAppUrl = (base: string, path: string): string =>
  `${base.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`

/** A dashboard page opened as an embedded desktop surface: the dashboard
 *  hides its own sidebar/page header for `embed=1` (see preview-pane). */
export const dashboardPageUrl = (base: string, path: string): string => {
  const url = new URL(dashboardAppUrl(base, path))

  url.searchParams.set('embed', '1')

  return url.toString()
}

const bridge = () => (typeof window === 'undefined' ? undefined : window.hermesDesktop)

/** Ports recorded in `spawn-ledger.json` for a dashboard/serve purpose. */
async function ledgerOrigins(): Promise<string[]> {
  const desktop = bridge()

  if (!desktop?.readFileText || !desktop.desktopPluginsRoot) {
    return []
  }

  try {
    const pluginRoot = await desktop.desktopPluginsRoot()
    const home = pluginRoot.replace(/[\\/](desktop-plugins|plugins)[\\/]?$/, '')
    const result = await desktop.readFileText(`${home}/spawn-ledger.json`)

    const raw =
      typeof result === 'string' ? result : ((result as { content?: string; text?: string })?.content ?? (result as { text?: string })?.text ?? '')

    const ledger = JSON.parse(raw) as Record<string, unknown>
    const origins = new Set<string>()

    const walk = (value: unknown) => {
      if (!value || typeof value !== 'object') {
        return
      }

      if (Array.isArray(value)) {
        value.forEach(walk)

        return
      }

      const row = value as Record<string, unknown>
      const purpose = String(row.purpose ?? row.kind ?? row.mode ?? '')
      const port = Number(row.port)

      if (/dashboard|serve/i.test(purpose) && Number.isInteger(port) && port > 0) {
        origins.add(`http://127.0.0.1:${port}`)
      }

      Object.values(row).forEach(walk)
    }

    walk(ledger)

    return [...origins]
  } catch {
    return []
  }
}

async function answers(origin: string): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)

  try {
    // The dashboard sends no CORS headers, so a normal fetch cannot read the
    // response — but `no-cors` still distinguishes "a server answered" from
    // "nothing is listening", which is all this needs to know.
    await fetch(`${origin}/api/dashboard/plugins`, { mode: 'no-cors', signal: controller.signal })

    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** The running dashboard origin, or null when no local dashboard answers. */
export async function resolveDashboardBaseUrl(): Promise<null | string> {
  const cached = $dashboardBaseUrl.get()

  if (cached) {
    return cached
  }

  const candidates = [...new Set([...(await ledgerOrigins()), ...FALLBACK_ORIGINS])]

  for (const origin of candidates) {
    if (await answers(origin)) {
      $dashboardBaseUrl.set(origin)

      return origin
    }
  }

  // The ledger records the port the desktop's dashboard was spawned on; if its
  // liveness check lost a race against a slow boot, still prefer it over
  // silently doing nothing.
  const recorded = candidates[0] ?? null

  if (recorded) {
    $dashboardBaseUrl.set(recorded)
  }

  return recorded
}
