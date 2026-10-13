import type { H3Event } from 'h3'
import type { DirectoryItem } from '#shared/utils/directory'
import { and, asc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { links, linkTags } from '../database/schema'

export const DIRECTORY_LIMIT = 500

/** Project safe fields in SQL; destination URLs never enter the directory payload. */
export async function readDirectory(event: H3Event): Promise<{ items: DirectoryItem[], truncated: boolean }> {
  const db = drizzle(event.context.cloudflare.env.DB)
  const rows = await db.select({ slug: links.slug, title: links.title, description: links.description })
    .from(links)
    .where(and(
      eq(links.listed, true),
      or(isNull(links.password), eq(links.password, '')),
      or(isNull(links.unsafe), eq(links.unsafe, false)),
      or(isNull(links.effectiveExpiresAt), gt(links.effectiveExpiresAt, Math.floor(Date.now() / 1000))),
    ))
    .orderBy(asc(sql`coalesce(nullif(${links.title}, ''), ${links.slug})`), asc(links.slug))
    .limit(DIRECTORY_LIMIT + 1)
  const items = rows.slice(0, DIRECTORY_LIMIT).map(row => ({
    slug: row.slug,
    title: row.title || row.slug,
    description: row.description || '',
    tags: [] as string[],
  }))
  const bySlug = new Map(items.map(item => [item.slug, item]))
  // Bound each D1 query below its parameter limit.
  const slugs = items.map(item => item.slug)
  for (let offset = 0; offset < slugs.length; offset += 90) {
    const tags = await db.select({ slug: linkTags.linkSlug, tag: linkTags.tagName }).from(linkTags).where(inArray(linkTags.linkSlug, slugs.slice(offset, offset + 90))).orderBy(asc(linkTags.tagName))
    for (const row of tags)
      bySlug.get(row.slug)?.tags.push(row.tag)
  }
  return { items, truncated: rows.length > DIRECTORY_LIMIT }
}
