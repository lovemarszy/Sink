import { z } from 'zod'
import { filterDirectory } from '#shared/utils/directory'
import { readDirectory } from '../services/directory'

const QuerySchema = z.object({
  q: z.string().trim().max(256).default(''),
  tag: z.string().trim().max(32).default(''),
})

export default eventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (path === '/index.html') {
    setDirectoryHeaders(event)
    return sendRedirect(event, '/', 303)
  }
  if (path !== '/')
    return
  setDirectoryHeaders(event)
  if (event.method !== 'GET' && event.method !== 'HEAD')
    throw createError({ status: 405, statusText: 'Method not allowed' })
  if (!await hasDirectorySession(event))
    return generateDirectoryLoginHtml(event)
  const query = await getValidatedQuery(event, QuerySchema.parse)
  try {
    const { items, truncated } = await readDirectory(event)
    return generateDirectoryHtml(event, {
      items: filterDirectory(items, query.q, query.tag),
      tags: [...new Set(items.flatMap(item => item.tags))].sort(),
      query: query.q,
      tag: query.tag,
      total: items.length,
      truncated,
    })
  }
  catch {
    console.error({ event: 'directory.read.failed' })
    throw createError({ status: 503, statusText: 'Directory temporarily unavailable. Please reload to retry.' })
  }
})
