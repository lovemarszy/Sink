import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const config = JSON.parse(await readFile(new URL('../wrangler.deploy.jsonc', import.meta.url), 'utf8'))
assert.equal(config.name, 'loveur-document-hub')
assert.equal(config.account_id, '404e1598aa3a9c767f80113cf5025c93')
assert.equal(config.workers_dev, false)
assert.equal(config.preview_urls, false)
assert.equal(config.ai, undefined)
assert.equal(config.analytics_engine_datasets, undefined)
assert.deepEqual(config.r2_buckets, [])
assert.deepEqual(config.triggers.crons, [])
assert.equal(config.vars.NUXT_RESOURCE_GUARDS_ENABLED, 'true')
assert.equal(config.vars.NUXT_DISABLE_ACCESS_LOG, 'true')
assert.equal(config.vars.NUXT_AUTHORITATIVE_REDIRECTS, 'true')
assert.equal(config.vars.NUXT_REQUIRE_HTTPS, 'true')
assert.equal(config.vars.NUXT_DISABLE_AUTO_BACKUP, 'true')
assert.equal(config.vars.NUXT_PUBLIC_LINK_PROXY_ENABLED, 'false')
assert.equal(config.vars.NUXT_PUBLIC_PREVIEW_MODE, '')
assert.equal(config.vars.NUXT_PUBLIC_HOME_URL, '')
assert.equal(config.vars.NUXT_HOME_URL, '')
assert.equal(config.vars.NUXT_SITE_TOKEN, undefined)
assert.equal(config.vars.NUXT_DIRECTORY_PASSWORD, undefined)
assert.equal(config.vars.NUXT_REDIRECT_STATUS_CODE, '302')
assert.equal(config.vars.NUXT_REDIRECT_NO_STORE, 'true')
assert.equal(config.vars.NUXT_API_CORS, 'false')
assert.equal(config.d1_databases[0].database_name, 'loveur-document-hub')
assert.notEqual(config.d1_databases[0].database_id, 'ef964055-65bf-4b78-b109-ac9c9290ae62')
assert.notEqual(config.kv_namespaces[0].id, 'ef93d42dc4b34969bab404d2e80f8dd3')
assert.deepEqual(config.ratelimits.map(item => item.simple), [
  { limit: 120, period: 60 },
  { limit: 10, period: 60 },
  { limit: 600, period: 60 },
])
assert(config.routes.every(route => route.custom_domain && route.pattern === 'go.loveur.life'))
console.log('Document Hub production binding and resource checks passed.')
