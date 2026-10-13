import type { H3Event } from 'h3'

/** Bound streamed input as well as Content-Length before parsing a password. */
export async function readDirectoryLoginPassword(event: H3Event): Promise<string> {
  const contentType = getHeader(event, 'content-type')?.split(';')[0]
  if (contentType !== 'application/x-www-form-urlencoded')
    throw createError({ status: 415, statusText: 'Use the login form' })
  const reader = toWebRequest(event).body?.getReader()
  if (!reader)
    throw createError({ status: 400, statusText: 'Password is required' })
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done)
        break
      size += value.byteLength
      if (size > 4096) {
        await reader.cancel()
        throw createError({ status: 413, statusText: 'Login request is too large' })
      }
      chunks.push(value)
    }
  }
  finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  const password = new URLSearchParams(new TextDecoder().decode(bytes)).get('password')
  if (!password || password.length > 256)
    throw createError({ status: 400, statusText: 'Invalid password input' })
  return password
}
