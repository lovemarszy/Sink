const TOKEN_KEY = 'SinkSiteToken'
const TOKEN_EXPIRES_KEY = 'SinkSiteTokenExpires'

export function readSessionAuthToken(storage: Pick<Storage, 'getItem' | 'removeItem'>, now = Date.now()) {
  const expiresAt = Number(storage.getItem(TOKEN_EXPIRES_KEY))
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    storage.removeItem(TOKEN_KEY)
    storage.removeItem(TOKEN_EXPIRES_KEY)
    return null
  }
  return storage.getItem(TOKEN_KEY)
}

export function getAuthToken() {
  if (!import.meta.client)
    return null

  // Remove the legacy persistent copy when this installation is first opened.
  localStorage.removeItem(TOKEN_KEY)
  return readSessionAuthToken(sessionStorage)
}

export function setAuthToken(token: string) {
  if (!import.meta.client)
    return

  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(TOKEN_EXPIRES_KEY, String(Date.now() + 15 * 60 * 1000))
}

export function removeAuthToken() {
  if (!import.meta.client)
    return

  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_EXPIRES_KEY)
}
