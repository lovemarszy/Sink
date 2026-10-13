import type { H3Event } from 'h3'
import { timingSafeEqual } from 'node:crypto'
import { and, eq, gt, lte, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { directoryLoginAttempts, directorySessions } from '../database/schema'

export const DIRECTORY_COOKIE = 'sink_directory_session'
const SESSION_SECONDS = 2 * 60 * 60
const LOGIN_WINDOW_SECONDS = 15 * 60
const LOGIN_LIMIT = 10

async function digest(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

function directoryPassword(event: H3Event): string {
  const password = useRuntimeConfig(event).directoryPassword
  if (typeof password !== 'string' || password.length < 12)
    throw createError({ status: 503, statusText: 'Directory access is not configured' })
  return password
}

async function passwordVersion(event: H3Event): Promise<string> {
  return await digest(`directory\n${useRuntimeConfig(event).siteToken}\n${directoryPassword(event)}`)
}

export function setDirectoryHeaders(event: H3Event): void {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  setResponseHeader(event, 'Referrer-Policy', 'same-origin')
}

export function isDirectoryOrigin(event: H3Event): boolean {
  setDirectoryHeaders(event)
  return getHeader(event, 'origin') === getRequestURL(event).origin
}

async function directoryDatabase<T>(event: H3Event, operation: (db: ReturnType<typeof drizzle>) => Promise<T>): Promise<T> {
  try {
    return await operation(drizzle(event.context.cloudflare.env.DB))
  }
  catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error)
      throw error
    console.error({ event: 'directory.database.unavailable' })
    throw createError({ status: 503, statusText: 'Directory temporarily unavailable' })
  }
}

export async function hasDirectorySession(event: H3Event): Promise<boolean> {
  const version = await passwordVersion(event)
  const token = getCookie(event, DIRECTORY_COOKIE)
  if (!token || !/^[\da-f]{64}$/.test(token))
    return false
  const tokenHash = await digest(token)
  const rows = await directoryDatabase(event, db => db.select({ tokenHash: directorySessions.tokenHash })
    .from(directorySessions)
    .where(and(
      eq(directorySessions.tokenHash, tokenHash),
      eq(directorySessions.passwordVersion, version),
      gt(directorySessions.expiresAt, Math.floor(Date.now() / 1000)),
    ))
    .limit(1))
  return rows.length > 0
}

export async function requireDirectorySession(event: H3Event): Promise<void> {
  setDirectoryHeaders(event)
  if (!await hasDirectorySession(event))
    throw createError({ status: 401, statusText: 'Directory login required' })
}

export async function logInToDirectory(event: H3Event, input: string): Promise<boolean> {
  const expected = directoryPassword(event)
  const now = Math.floor(Date.now() / 1000)
  // The Cloudflare edge supplies this header. Never trust X-Forwarded-For.
  const ip = getHeader(event, 'cf-connecting-ip') || 'local'
  const key = await digest(`${ip}\n${Math.floor(now / LOGIN_WINDOW_SECONDS)}`)
  const encoder = new TextEncoder()
  return await directoryDatabase(event, async (db) => {
    await db.delete(directoryLoginAttempts).where(lte(directoryLoginAttempts.expiresAt, now))
    const [attempt] = await db.insert(directoryLoginAttempts).values({ key, attempts: 1, expiresAt: now + LOGIN_WINDOW_SECONDS }).onConflictDoUpdate({ target: directoryLoginAttempts.key, set: { attempts: sql`${directoryLoginAttempts.attempts} + 1` } }).returning({ attempts: directoryLoginAttempts.attempts })
    if (!attempt || attempt.attempts > LOGIN_LIMIT) {
      setResponseHeader(event, 'Retry-After', LOGIN_WINDOW_SECONDS - now % LOGIN_WINDOW_SECONDS)
      throw createError({ status: 429, statusText: 'Too many attempts. Try again later.' })
    }
    const [actualHash, expectedHash] = await Promise.all([digest(input), digest(expected)])
    if (!timingSafeEqual(encoder.encode(actualHash), encoder.encode(expectedHash)))
      return false
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
    await db.delete(directorySessions).where(lte(directorySessions.expiresAt, now))
    await db.insert(directorySessions).values({
      tokenHash: await digest(token),
      passwordVersion: await passwordVersion(event),
      expiresAt: now + SESSION_SECONDS,
    })
    await db.delete(directoryLoginAttempts).where(eq(directoryLoginAttempts.key, key))
    setCookie(event, DIRECTORY_COOKIE, token, {
      httpOnly: true,
      secure: getRequestURL(event).protocol === 'https:',
      sameSite: 'strict',
      path: '/',
    })
    return true
  })
}

export async function logOutOfDirectory(event: H3Event): Promise<void> {
  const token = getCookie(event, DIRECTORY_COOKIE)
  if (token) {
    const tokenHash = await digest(token)
    await directoryDatabase(event, async (db) => {
      await db.delete(directorySessions).where(eq(directorySessions.tokenHash, tokenHash))
    })
  }
  deleteCookie(event, DIRECTORY_COOKIE, { path: '/' })
}
