import { describe, expect, it } from 'vitest'

import { normalizeAddress } from './browser'

describe('normalizeAddress', () => {
  it('keeps a scheme the user typed', () => {
    expect(normalizeAddress('http://example.com/a?b=1')).toBe('http://example.com/a?b=1')
    expect(normalizeAddress('file:///tmp/x.html')).toBe('file:///tmp/x.html')
  })

  it('upgrades a bare host to https', () => {
    expect(normalizeAddress('example.com')).toBe('https://example.com')
  })

  it('uses http for loopback so local dev servers work', () => {
    expect(normalizeAddress('localhost:3000')).toBe('http://localhost:3000')
    expect(normalizeAddress('127.0.0.1:8080/x')).toBe('http://127.0.0.1:8080/x')
  })

  it('treats blank input as no navigation', () => {
    expect(normalizeAddress('   ')).toBeNull()
  })
})
