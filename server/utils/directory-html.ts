import type { H3Event } from 'h3'
import type { DirectoryItem } from '#shared/utils/directory'

function escape(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[char]!)
}

function words(event: H3Event) {
  const messages = /\bzh(?:[\-;,]|$)/i.test(getHeader(event, 'accept-language') || '')
    ? {
        lang: 'zh-CN',
        title: '文档导航',
        subtitle: '课程资料与小组协作，一处找到。',
        password: '访问密码',
        login: '进入目录',
        loginHelp: '输入获得的访问密码即可浏览。',
        sessionHelp: '公共电脑请在使用后退出。登录有效期为 15 分钟。',
        error: '密码不正确，请重试。',
        search: '搜索',
        placeholder: '搜索标题、短地址、描述或标签',
        all: '全部',
        clear: '清除筛选',
        empty: '目录里还没有资料。',
        noResults: '没有找到匹配的资料。',
        open: '打开',
        copy: '复制链接',
        copied: '已复制',
        copyFallback: '请选中短链接并复制。',
        logout: '退出',
        manage: '管理',
        source: '基于 Sink',
        sharing: '直接短链接可以公开访问；原文档的分享权限仍然生效。',
        count: '条资料',
        truncated: '当前显示前 500 条资料。',
      }
    : {
        lang: 'en',
        title: 'Document Hub',
        subtitle: 'Course materials and group work, all in one place.',
        password: 'Access password',
        login: 'Enter directory',
        loginHelp: 'Enter the access password you have been given.',
        sessionHelp: 'Log out on shared computers. Sessions last 15 minutes.',
        error: 'Incorrect password. Please try again.',
        search: 'Search',
        placeholder: 'Search titles, shortcuts, descriptions, or tags',
        all: 'All',
        clear: 'Clear filters',
        empty: 'No links are listed yet.',
        noResults: 'No matching links.',
        open: 'Open',
        copy: 'Copy link',
        copied: 'Copied',
        copyFallback: 'Select the short URL and copy it.',
        logout: 'Log out',
        manage: 'Manage',
        source: 'Powered by Sink',
        sharing: 'Direct short links remain public. Original document permissions still apply.',
        count: 'resources',
        truncated: 'Showing the first 500 resources.',
      }
  const title = useRuntimeConfig(event).directoryTitle
  const configuredTitle = typeof title === 'string' ? title.trim().slice(0, 128) : ''
  return { ...messages, title: configuredTitle ? escape(configuredTitle) : messages.title }
}

// Keep the entry page self-contained for school browsers with JavaScript disabled.
const DIRECTORY_CSS = `
* { box-sizing: border-box; }
body { margin: 0; background: #fff; color: #18181b; font: 16px/1.6 "IBM Plex Sans", system-ui, sans-serif; }
a { color: inherit; }
button, input { font: inherit; }
button, .button { white-space: nowrap; }
button, .button { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; min-height: 44px; border: 1px solid #e4e4e7; border-radius: .625rem; background: #fff; color: #18181b; padding: .5rem 1rem; text-decoration: none; cursor: pointer; }
button:hover, .button:hover { background: #f4f4f5; }
button:focus-visible, input:focus-visible, a:focus-visible { outline: 3px solid #a1a1aa; outline-offset: 3px; }
.primary { background: #18181b; color: #fafafa; border-color: #18181b; }
.primary:hover { background: #27272a; }
.muted { color: #71717a; font-size: .875rem; }
main { max-width: 1040px; margin: auto; padding: 28px 24px 48px; }
header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 48px; }
.brand { font-weight: 600; letter-spacing: .04em; }
.actions { display: flex; gap: 8px; align-items: center; }
h1 { font-size: clamp(28px, 5vw, 40px); line-height: 1.2; letter-spacing: -.03em; margin: 0 0 12px; }
p { margin: 0 0 20px; }
form { margin: 0; }
input { width: 100%; min-height: 48px; padding: .6rem .85rem; border: 1px solid #e4e4e7; border-radius: .625rem; background: #fff; color: #18181b; }
label { display: block; font-size: .875rem; font-weight: 600; margin-bottom: 8px; }
.search { display: flex; gap: 8px; margin: 28px 0 18px; }
.search input { min-width: 0; }
.search button { flex-shrink: 0; }
.filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }
.filters a { font-size: .875rem; min-height: 36px; }
.active { background: #18181b; color: #fff; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 16px; }
.card { border: 1px solid #e4e4e7; border-radius: .625rem; padding: 24px; display: flex; flex-direction: column; gap: 12px; overflow-wrap: anywhere; }
.card h2 { font-size: 18px; line-height: 1.4; margin: 0; }
.card p { margin: 0; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { font-size: 12px; color: #71717a; background: #f4f4f5; border-radius: .625rem; padding: 2px 8px; }
.card .actions { margin-top: auto; padding-top: 8px; flex-wrap: wrap; }
.short-url { font-size: 13px; min-height: 36px; color: #71717a; background: #fafafa; }
.login { max-width: 400px; margin: 12vh auto 0; }
.login section { border: 1px solid #e4e4e7; border-radius: .625rem; padding: 28px; }
.login .primary { width: 100%; margin: 16px 0; }
.error { color: #b91c1c; }
.empty { border: 1px dashed #e4e4e7; border-radius: .625rem; text-align: center; padding: 48px 20px; }
.empty p { margin-bottom: 12px; }
footer { margin-top: 48px; border-top: 1px solid #e4e4e7; padding-top: 20px; }
.status { min-height: 24px; }
[hidden] { display: none !important; }
@media (max-width: 480px) {
  main { padding: 20px 16px 32px; }
  header { margin-bottom: 32px; }
  .login { margin-top: 8vh; }
  .login section { padding: 24px; }
  .search { flex-direction: column; }
  .card { padding: 20px; }
}
`

function document(event: H3Event, body: string, script = ''): string {
  const text = words(event)
  const nonce = crypto.randomUUID()
  setDirectoryHeaders(event)
  setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'Content-Security-Policy', `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`)
  return `<!doctype html><html lang="${text.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${text.title}</title><style nonce="${nonce}">${DIRECTORY_CSS}</style></head><body>${body}${script ? `<script nonce="${nonce}">${script}</script>` : ''}</body></html>`
}

export function generateDirectoryLoginHtml(event: H3Event, hasError = false): string {
  const text = words(event)
  return document(event, `<main class="login"><section><p class="brand">DOCUMENT HUB</p><h1>${text.title}</h1><p class="muted">${text.loginHelp}</p><form method="post" action="/hub-login"><label for="password">${text.password}</label><input id="password" name="password" type="password" required maxlength="256" autocomplete="current-password" autofocus ${hasError ? 'aria-invalid="true" aria-describedby="login-error"' : ''}>${hasError ? `<p class="error" id="login-error" role="alert">${text.error}</p>` : ''}<button class="primary" type="submit">${text.login}</button></form><p class="muted">${text.sessionHelp}</p></section></main>`)
}

export function generateDirectoryHtml(event: H3Event, data: { items: DirectoryItem[], tags: string[], query: string, tag: string, total: number, truncated: boolean }): string {
  const text = words(event)
  const filterUrl = (tag: string) => `/?${new URLSearchParams({ q: data.query, tag })}`
  const origin = getRequestURL(event).origin
  const cards = data.items.map((item) => {
    const path = `/${encodeURIComponent(item.slug)}`
    const shortUrl = `${origin}${path}`
    return `<article class="card"><h2><a href="${path}" target="_blank" rel="noopener noreferrer">${escape(item.title)}</a></h2>${item.description ? `<p class="muted">${escape(item.description)}</p>` : ''}<div class="tags">${item.tags.map(tag => `<span class="tag">${escape(tag)}</span>`).join('')}</div><label class="muted" for="url-${escape(item.slug)}">/${escape(item.slug)}</label><input class="short-url" id="url-${escape(item.slug)}" readonly value="${escape(shortUrl)}"><div class="actions"><a class="button primary" href="${path}" target="_blank" rel="noopener noreferrer">${text.open}</a><button type="button" data-copy="url-${escape(item.slug)}" data-copied="${text.copied}" hidden>${text.copy}</button></div></article>`
  }).join('')
  const empty = `<div class="empty"><p>${data.total ? text.noResults : text.empty}</p>${data.query || data.tag ? `<a class="button" href="/">${text.clear}</a>` : ''}</div>`
  const body = `<main><header><span class="brand">DOCUMENT HUB</span><div class="actions"><a class="button" href="/dashboard">${text.manage}</a><form method="post" action="/hub-logout"><button type="submit">${text.logout}</button></form></div></header><h1>${text.title}</h1><p class="muted">${text.subtitle}</p><form class="search" method="get" action="/"><input id="q" name="q" type="search" maxlength="256" aria-label="${text.search}" placeholder="${text.placeholder}" value="${escape(data.query)}"><input name="tag" type="hidden" value="${escape(data.tag)}"><button class="primary" type="submit">${text.search}</button></form><nav class="filters" aria-label="${text.search}"><a class="button ${data.tag ? '' : 'active'}" ${data.tag ? '' : 'aria-current="true"'} href="${escape(filterUrl(''))}">${text.all}</a>${data.tags.map(tag => `<a class="button ${tag === data.tag ? 'active' : ''}" ${tag === data.tag ? 'aria-current="true"' : ''} href="${escape(filterUrl(tag))}">${escape(tag)}</a>`).join('')}</nav><p class="muted">${data.items.length} ${text.count}${data.query || data.tag ? ` · <a href="/">${text.clear}</a>` : ''}</p>${data.items.length ? `<div class="grid">${cards}</div>` : empty}<p class="muted status" id="copy-status" role="status" data-fallback="${text.copyFallback}"></p>${data.truncated ? `<p class="muted">${text.truncated}</p>` : ''}<footer><p class="muted">${text.sharing}</p><a class="muted" href="https://github.com/lovemarszy/Sink">${text.source}</a></footer></main>`
  const script = `document.querySelectorAll('[data-copy]').forEach(function(button){button.hidden=false;button.addEventListener('click',async function(){var input=document.getElementById(button.dataset.copy);var status=document.getElementById('copy-status');try{await navigator.clipboard.writeText(input.value);status.textContent=button.dataset.copied;}catch(e){input.focus();input.select();status.textContent=status.dataset.fallback;}});});`
  return document(event, body, script)
}
