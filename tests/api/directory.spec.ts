import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { directoryLoginAttempts, directorySessions, links } from '../../server/database/schema'
import { DIRECTORY_COOKIE } from '../../server/utils/directory-auth'
import { db, deleteStoredLinks, fetch, getD1Link, postJson, putJson, setLinkStoreD1Mode } from '../utils'

const password = 'local-test-directory-password'
const runtimeEnv = env as unknown as Record<string, unknown>
const slugs: string[] = []

beforeAll(setLinkStoreD1Mode)
beforeEach(() => {
  runtimeEnv.NUXT_DIRECTORY_PASSWORD = password
})
afterEach(async () => {
  runtimeEnv.NUXT_DIRECTORY_PASSWORD = password
  await deleteStoredLinks(slugs.splice(0))
  await db.delete(directorySessions)
  await db.delete(directoryLoginAttempts)
})

async function login(input = password, headers: Record<string, string> = {}) {
  return await fetch('/hub-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': 'http://localhost', ...headers },
    body: new URLSearchParams({ password: input }),
    redirect: 'manual',
  })
}

async function session() {
  const response = await login()
  expect(response.status).toBe(303)
  const cookie = response.headers.get('set-cookie')?.split(';')[0]
  expect(cookie).toBeDefined()
  return cookie!
}

async function create(extra: Record<string, unknown> = {}) {
  const slug = `hub-${crypto.randomUUID()}`
  slugs.push(slug)
  const response = await postJson('/api/link/create', { slug, url: 'https://example.com/secret-document', ...extra })
  expect(response.status).toBe(201)
  return slug
}

describe('directory identity boundary', () => {
  it('renders a native password form and never lists resources anonymously', async () => {
    const slug = await create({ listed: true, title: 'Confidential directory title' })
    const response = await fetch('/')
    const html = await response.text()
    expect(response.status).toBe(200)
    expect(html).toContain('action="/hub-login"')
    expect(html).not.toContain(slug)
    expect(html).not.toContain('Confidential directory title')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(response.headers.get('content-security-policy')).toContain('form-action \'self\'')
    expect((await fetch('/api/hub/directory')).status).toBe(401)
  })

  it('accepts the native form, uses a session cookie, and rejects incorrect passwords', async () => {
    expect((await login('incorrect')).status).toBe(401)
    const response = await login()
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/')
    const cookie = response.headers.get('set-cookie')!
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Strict')
    expect(cookie).not.toContain('Max-Age')
    expect(cookie).not.toContain(password)
    expect((await fetch('/api/hub/directory', { headers: { Cookie: cookie.split(';')[0]! } })).status).toBe(200)
  })

  it('does not grant directory visitors management permissions', async () => {
    const cookie = await session()
    for (const [path, method] of [
      ['/api/link/list', 'GET'],
      ['/api/link/create', 'POST'],
      ['/api/link/edit', 'PUT'],
      ['/api/link/delete', 'POST'],
      ['/api/hub/directory', 'POST'],
      ['/api/hub/directory/other', 'GET'],
      ['/api/hub/directory', 'PATCH'],
      ['/api/hub/directory', 'DELETE'],
    ]) {
      const response = await fetch(path!, { method, headers: { Cookie: cookie } })
      expect(response.status, `${method} ${path}`).toBe(401)
    }
  })

  it('rejects cross-origin login and logout submissions', async () => {
    expect((await login(password, { Origin: 'https://evil.example' })).status).toBe(403)
    const cookie = await session()
    expect((await fetch('/hub-logout', { method: 'POST', headers: { Cookie: cookie, Origin: 'https://evil.example' } })).status).toBe(403)
    expect((await fetch('/api/hub/directory', { headers: { Cookie: cookie } })).status).toBe(200)
  })

  it('revokes a session on logout, including replay of its old cookie', async () => {
    const cookie = await session()
    expect((await fetch('/hub-logout', { method: 'POST', redirect: 'manual', headers: { Cookie: cookie, Origin: 'http://localhost' } })).status).toBe(303)
    expect((await fetch('/api/hub/directory', { headers: { Cookie: cookie } })).status).toBe(401)
  })

  it('rejects expired, forged, and password-rotated sessions', async () => {
    expect((await fetch('/api/hub/directory', { headers: { Cookie: `${DIRECTORY_COOKIE}=${'a'.repeat(64)}` } })).status).toBe(401)
    const cookie = await session()
    runtimeEnv.NUXT_DIRECTORY_PASSWORD = 'a-new-directory-password'
    expect((await fetch('/api/hub/directory', { headers: { Cookie: cookie } })).status).toBe(401)
    runtimeEnv.NUXT_DIRECTORY_PASSWORD = password
    await db.update(directorySessions).set({ expiresAt: 1 })
    expect((await fetch('/api/hub/directory', { headers: { Cookie: cookie } })).status).toBe(401)
  })

  it.each(['', 'short', false])('fails closed when the directory password is invalid: %s', async (value) => {
    runtimeEnv.NUXT_DIRECTORY_PASSWORD = value
    expect((await fetch('/')).status).toBe(503)
    expect((await fetch('/api/hub/directory')).status).toBe(503)
    expect((await login()).status).toBe(503)
  })

  it('limits repeated login attempts using D1', async () => {
    for (let i = 0; i < 10; i++)
      expect((await login('wrong')).status).toBe(401)
    const blocked = await login('wrong')
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('retry-after')).toBeTruthy()
  })

  it('fails closed without leaking errors when the database is unavailable', async () => {
    const cookie = await session()
    const original = runtimeEnv.DB
    runtimeEnv.DB = {
      prepare: () => {
        throw new Error('sensitive database diagnostic')
      },
    }
    try {
      const response = await fetch('/api/hub/directory', { headers: { Cookie: cookie } })
      expect(response.status).toBe(503)
      expect(await response.text()).not.toContain('sensitive database diagnostic')
      expect((await login()).status).toBe(503)
    }
    finally {
      runtimeEnv.DB = original
    }
  })

  it('redirects the static index alias through the protected entry', async () => {
    const response = await fetch('/index.html', { redirect: 'manual' })
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/')
  })
})

describe('directory publication and short links', () => {
  it('defaults new and legacy records to unlisted', async () => {
    const slug = await create()
    expect((await getD1Link(slug))?.listed).toBe(false)
    const legacySlug = `legacy-hub-${crypto.randomUUID()}`
    slugs.push(legacySlug)
    await db.insert(links).values({ slug: legacySlug, id: legacySlug, url: 'https://example.com', normalizedUrl: 'https://example.com', createdAt: 1, updatedAt: 1 })
    expect((await getD1Link(legacySlug))?.listed).toBe(false)
    const response = await fetch('/api/hub/directory', { headers: { Cookie: await session() } })
    const data = await response.text()
    expect(data).not.toContain(slug)
    expect(data).not.toContain(legacySlug)
  })

  it('projects only opted-in eligible metadata and excludes protected, expired, unsafe, and deleted links', async () => {
    const shown = await create({ listed: true, title: 'Lecture notes', description: 'Sensory notes', tags: ['course'], comment: 'internal note' })
    const hidden = await create({ title: 'Hidden title' })
    const locked = await create({ listed: true, password: 'link-password' })
    const unsafe = await create({ listed: true, unsafe: true })
    const expired = await create({ listed: true })
    await db.update(links).set({ effectiveExpiresAt: 1 }).where(eq(links.slug, expired))
    const deleted = await create({ listed: true })
    expect((await postJson('/api/link/delete', { slug: deleted })).status).toBe(204)
    const response = await fetch('/api/hub/directory', { headers: { Cookie: await session() } })
    const data = await response.json() as { items: Record<string, unknown>[] }
    expect(data.items.find(item => item.slug === shown)).toEqual({ slug: shown, title: 'Lecture notes', description: 'Sensory notes', tags: ['course'] })
    for (const slug of [hidden, locked, unsafe, expired, deleted])
      expect(data.items.some(item => item.slug === slug)).toBe(false)
    const json = JSON.stringify(data)
    for (const sensitive of ['example.com', 'internal note', 'password', 'createdAt', 'updatedAt', 'normalizedUrl'])
      expect(json).not.toContain(sensitive)
  })

  it('updates listing without redeployment, preserves it on target-only edits, and keeps direct links public', async () => {
    const slug = await create({ listed: true })
    const cookie = await session()
    expect((await putJson('/api/link/edit', { slug, url: 'https://example.com/updated' })).status).toBe(201)
    expect((await getD1Link(slug))?.listed).toBe(true)
    const redirect = await fetch(`/${slug}`, { redirect: 'manual' })
    expect(redirect.headers.get('location')).toBe('https://example.com/updated')
    expect((await fetch('/api/hub/directory', { headers: { Cookie: cookie } })).status).toBe(200)
    expect((await putJson('/api/link/edit', { slug, url: 'https://example.com/updated', listed: false })).status).toBe(201)
    expect(await (await fetch('/api/hub/directory', { headers: { Cookie: cookie } })).text()).not.toContain(slug)
    expect((await fetch(`/${slug}`, { redirect: 'manual' })).headers.get('location')).toBe('https://example.com/updated')
  })

  it('supports native search and tag filters and escapes untrusted text', async () => {
    const slug = await create({ listed: true, title: 'Sensory 中文 <script>alert(1)</script>', description: 'Bilingual notes', tags: ['course'] })
    const cookie = await session()
    const headers = { Cookie: cookie }
    const html = await (await fetch('/?q=%20SENSORY%20&tag=course', { headers })).text()
    expect(html).toContain(slug)
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain(`href="/${slug}"`)
    expect(html).not.toContain('secret-document')
    expect(await (await fetch('/?q=%E4%B8%AD%E6%96%87', { headers })).text()).toContain(slug)
    expect(await (await fetch('/?q=sensory&tag=other', { headers })).text()).not.toContain(slug)
    expect((await fetch(`/?q=${'x'.repeat(257)}`, { headers })).status).toBe(400)
  })

  it.each(['api', 'hub-login', 'hub-logout'])('reserves the system slug %s', async (slug) => {
    expect((await postJson('/api/link/create', { slug, url: 'https://example.com' })).status).toBe(400)
  })
})
