import { readDirectory } from '../../services/directory'

export default eventHandler(async (event) => {
  // Also validate here so future middleware changes cannot expose the feed.
  await requireDirectorySession(event)
  try {
    return await readDirectory(event)
  }
  catch {
    console.error({ event: 'directory.read.failed' })
    throw createError({ status: 503, statusText: 'Directory temporarily unavailable' })
  }
})
