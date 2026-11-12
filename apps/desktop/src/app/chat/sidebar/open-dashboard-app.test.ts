import { expect, it } from 'vitest'

import { dashboardAppUrl, dashboardPageUrl } from '@/store/dashboard-apps'

it('joins a dashboard origin and a plugin tab path without doubling slashes', () => {
  expect(dashboardAppUrl('http://127.0.0.1:9220', '/docs')).toBe('http://127.0.0.1:9220/docs')
  expect(dashboardAppUrl('http://127.0.0.1:9220/', 'sheets')).toBe('http://127.0.0.1:9220/sheets')
  expect(dashboardAppUrl('http://127.0.0.1:9220/', '/plugins/office-docs')).toBe(
    'http://127.0.0.1:9220/plugins/office-docs'
  )
})

it('marks an embedded dashboard page without clobbering its query', () => {
  expect(dashboardPageUrl('http://127.0.0.1:9220', '/pairing')).toBe(
    'http://127.0.0.1:9220/pairing?embed=1'
  )
  expect(dashboardPageUrl('http://127.0.0.1:9220/', '/analytics?profile=work')).toBe(
    'http://127.0.0.1:9220/analytics?profile=work&embed=1'
  )
})
