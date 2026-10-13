export default eventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  if (!config.resourceGuardsEnabled)
    return
  if (config.requireHttps) {
    const url = new URL(event.context.cloudflare?.request?.url || getRequestURL(event).href)
    if (url.protocol !== 'https:') {
      url.protocol = 'https:'
      return sendRedirect(event, url.href, 308)
    }
    setResponseHeader(event, 'Strict-Transport-Security', 'max-age=31536000')
  }
  const env = event.context.cloudflare?.env
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  if (!env?.REQUEST_RATE_LIMITER || !env.LOGIN_RATE_LIMITER || !env.GLOBAL_RATE_LIMITER) {
    setResponseStatus(event, 503)
    return 'Request protection is unavailable'
  }
  const path = getRequestURL(event).pathname
  const contentLength = Number(getHeader(event, 'content-length') || 0)
  if (path === '/hub-login' && contentLength > 4096) {
    setResponseStatus(event, 413)
    return 'Login request is too large'
  }
  try {
    // Native counters reject floods before D1/KV operations. They are per location,
    // not a hard spending cap; the deployment must remain on Workers Free.
    const ip = getHeader(event, 'cf-connecting-ip') || 'local'
    const checks = [
      { limiter: env.GLOBAL_RATE_LIMITER, key: 'document-hub' },
      { limiter: env.REQUEST_RATE_LIMITER, key: ip },
      ...(path === '/hub-login' ? [{ limiter: env.LOGIN_RATE_LIMITER, key: ip }] : []),
    ]
    for (const { limiter, key } of checks) {
      if (!(await limiter.limit({ key })).success) {
        setResponseStatus(event, 429)
        setResponseHeader(event, 'Retry-After', 60)
        return 'Too many requests. Please try again in a minute.'
      }
    }
  }
  catch {
    setResponseStatus(event, 503)
    return 'Request protection is temporarily unavailable'
  }
})
