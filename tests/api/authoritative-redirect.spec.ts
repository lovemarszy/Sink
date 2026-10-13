import { env } from 'cloudflare:workers'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { deleteStoredLinks, fetch, postJson, putJson, setLinkStoreD1Mode } from '../utils'

const slugs: string[] = []
beforeAll(setLinkStoreD1Mode)
afterEach(async () => {
  env.NUXT_AUTHORITATIVE_REDIRECTS = 'false'
  await deleteStoredLinks(slugs.splice(0))
})

describe('opt-in authoritative redirects', () => {
  it('ignores stale KV destinations and deleted cache entries', async () => {
    env.NUXT_AUTHORITATIVE_REDIRECTS = 'true'
    const slug = `authoritative-${crypto.randomUUID()}`
    slugs.push(slug)
    const created = await postJson('/api/link/create', { slug, url: 'https://example.com/old' })
    expect(created.status).toBe(201)
    const { link } = await created.json() as { link: Record<string, unknown> }
    expect((await putJson('/api/link/edit', { slug, url: 'https://example.com/current' })).status).toBe(201)
    // Simulate an edge location still seeing the previous KV version.
    await env.KV.put(`link:${slug}`, JSON.stringify(link))
    expect((await fetch(`/${slug}`, { redirect: 'manual' })).headers.get('location')).toBe('https://example.com/current')
    expect((await postJson('/api/link/delete', { slug })).status).toBe(204)
    await env.KV.put(`link:${slug}`, JSON.stringify(link))
    expect((await fetch(`/${slug}`, { redirect: 'manual' })).status).toBe(404)
  })

  it('enforces newly added link passwords despite stale unprotected cache entries', async () => {
    env.NUXT_AUTHORITATIVE_REDIRECTS = 'true'
    const slug = `authoritative-password-${crypto.randomUUID()}`
    slugs.push(slug)
    const created = await postJson('/api/link/create', { slug, url: 'https://example.com' })
    const { link } = await created.json() as { link: Record<string, unknown> }
    expect((await putJson('/api/link/edit', { slug, url: 'https://example.com', password: 'test-protected-password' })).status).toBe(201)
    await env.KV.put(`link:${slug}`, JSON.stringify(link))
    const response = await fetch(`/${slug}`, { redirect: 'manual' })
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(await response.text()).toContain('password')
  })
})
