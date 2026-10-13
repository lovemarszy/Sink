import { env, exports } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetch } from '../utils'

beforeEach(() => {
  env.NUXT_RESOURCE_GUARDS_ENABLED = 'true'
})
afterEach(() => {
  env.NUXT_RESOURCE_GUARDS_ENABLED = 'false'
  env.NUXT_REQUIRE_HTTPS = 'false'
  vi.restoreAllMocks()
})

describe('resource guards before link resolution and authentication', () => {
  it.each(['GLOBAL_RATE_LIMITER', 'REQUEST_RATE_LIMITER'] as const)('rejects %s exhaustion before KV/D1 work', async (binding) => {
    vi.spyOn(env[binding], 'limit').mockResolvedValue({ success: false })
    const kv = vi.spyOn(env.KV, 'getWithMetadata')
    const d1 = vi.spyOn(env.DB, 'prepare')
    const response = await fetch('/random-abuse-slug')
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(kv).not.toHaveBeenCalled()
    expect(d1).not.toHaveBeenCalled()
  })

  it('limits login before its database attempt counter', async () => {
    vi.spyOn(env.LOGIN_RATE_LIMITER, 'limit').mockResolvedValue({ success: false })
    const d1 = vi.spyOn(env.DB, 'prepare')
    const response = await fetch('/hub-login', {
      method: 'POST',
      headers: { 'Origin': 'http://localhost', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: 'guess' }),
    })
    expect(response.status).toBe(429)
    expect(d1).not.toHaveBeenCalled()
  })

  it('fails closed when protection is unavailable', async () => {
    vi.spyOn(env.GLOBAL_RATE_LIMITER, 'limit').mockRejectedValue(new Error('Binding unavailable'))
    expect((await fetch('/api/verify')).status).toBe(503)
  })

  it('leaves the existing management authentication boundary intact', async () => {
    expect((await fetch('/api/verify')).status).toBe(401)
  })

  it('upgrades HTTP before rendering login and applies HSTS to HTTPS', async () => {
    env.NUXT_REQUIRE_HTTPS = 'true'
    const http = await fetch('/?q=hello', { redirect: 'manual' })
    expect(http.status).toBe(308)
    expect(http.headers.get('location')).toBe('https://localhost/?q=hello')
    const https = await exports.default.fetch(new Request('https://localhost/api/verify', { redirect: 'manual' }))
    expect(https.status).toBe(401)
    expect(https.headers.get('strict-transport-security')).toBe('max-age=31536000')
  })

  it('rejects a declared oversized login before rate counter work', async () => {
    const limiter = vi.spyOn(env.GLOBAL_RATE_LIMITER, 'limit')
    const response = await fetch('/hub-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': '5000' },
      body: `password=${'a'.repeat(4991)}`,
    })
    expect(response.status).toBe(413)
    expect(limiter).not.toHaveBeenCalled()
  })
})
