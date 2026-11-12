import { describe, expect, it } from 'vitest'

import { EMBEDDED_DASHBOARD_CSS, isEmbeddedDashboardUrl } from './preview-embed'

describe('embedded dashboard contract', () => {
  it('recognises the embed flag in any query position', () => {
    expect(isEmbeddedDashboardUrl('http://127.0.0.1:9220/pairing?embed=1&profile=work')).toBe(true)
    expect(isEmbeddedDashboardUrl('http://127.0.0.1:9220/docs/?profile=work&embed=1')).toBe(true)
    expect(isEmbeddedDashboardUrl('http://127.0.0.1:9220/pairing?profile=work')).toBe(false)
    expect(isEmbeddedDashboardUrl('http://127.0.0.1:9220/pairing?embed=10')).toBe(false)
  })

  it('hides dashboard chrome and resource banners', () => {
    expect(EMBEDDED_DASHBOARD_CSS).toContain('#app-sidebar')
    expect(EMBEDDED_DASHBOARD_CSS).toContain('[data-dashboard-page-header]')
    expect(EMBEDDED_DASHBOARD_CSS).toContain('[data-testid="memory-pressure-banner"]')
  })
})
