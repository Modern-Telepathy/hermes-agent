/** Guest chrome stripped from a dashboard page opened with `embed=1`. Keep the
 *  selector list here so the embed contract has one testable home. */
export const EMBEDDED_DASHBOARD_CSS =
  '#app-sidebar,[data-dashboard-chrome],[data-dashboard-page-header],header[role="banner"],[data-testid="memory-pressure-banner"]{display:none!important}'

/** Dashboard pages ask for the chromeless surface with `embed=1`; every load
 *  of that document must re-apply the CSS (a new guest document loses it). */
export const isEmbeddedDashboardUrl = (url: string): boolean => /[?&]embed=1(?:&|$)/.test(url)
