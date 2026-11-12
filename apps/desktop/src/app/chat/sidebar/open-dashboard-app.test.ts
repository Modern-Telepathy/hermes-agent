import { expect, it } from 'vitest'

import { dashboardAppUrl, dashboardPageUrl, sameDashboardUrl } from '@/store/dashboard-apps'

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

it('binds the embedded page to the profile on screen', () => {
  expect(dashboardPageUrl('http://127.0.0.1:9220', '/pairing', 'personal')).toBe(
    'http://127.0.0.1:9220/pairing?profile=personal&embed=1'
  )
  // The explicit desktop scope wins over a stale link scope.
  expect(dashboardPageUrl('http://127.0.0.1:9220', '/pairing?profile=old', 'personal')).toBe(
    'http://127.0.0.1:9220/pairing?profile=personal&embed=1'
  )
})

it('matches a dashboard tab regardless of query order', () => {
  expect(
    sameDashboardUrl(
      'http://127.0.0.1:9220/profiles/new?embed=1&profile=default',
      'http://127.0.0.1:9220/profiles/new?profile=default&embed=1'
    )
  ).toBe(true)
  expect(
    sameDashboardUrl(
      'http://127.0.0.1:9220/pairing?profile=default&embed=1',
      'http://127.0.0.1:9220/pairing?profile=work&embed=1'
    )
  ).toBe(false)
})
