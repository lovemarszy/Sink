import { describe, expect, it } from 'vitest'
import { readSessionAuthToken } from '../../app/utils/auth-token'

function storage(values: Record<string, string>) {
  const entries = new Map(Object.entries(values))
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    removeItem: (key: string) => {
      entries.delete(key)
    },
  }
}

describe('management browser session', () => {
  it('returns the token before its fixed deadline without refreshing the deadline', () => {
    const tab = storage({ SinkSiteToken: 'test-only-token', SinkSiteTokenExpires: '901000' })
    expect(readSessionAuthToken(tab, 900999)).toBe('test-only-token')
    expect(tab.getItem('SinkSiteTokenExpires')).toBe('901000')
  })

  it.each(['901000', 'invalid', ''])('clears stale or invalid session material: %s', (deadline) => {
    const tab = storage({ SinkSiteToken: 'test-only-token', SinkSiteTokenExpires: deadline })
    expect(readSessionAuthToken(tab, 901000)).toBeNull()
    expect(tab.getItem('SinkSiteToken')).toBeNull()
    expect(tab.getItem('SinkSiteTokenExpires')).toBeNull()
  })
})
