import { readFile, writeFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'
import { parse, printParseErrorCode } from 'jsonc-parser'
import { z } from 'zod'

const rootDir = new URL('../', import.meta.url)
const sourcePath = new URL('wrangler.jsonc', rootDir)
const envPath = new URL(process.env.DEPLOY_ENV_FILE || '.env', rootDir)
const outputPath = new URL('wrangler.deploy.jsonc', rootDir)

const defaultName = z.preprocess(
  value => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).default('sink'),
)

const optionalName = z.preprocess(
  value => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).optional(),
)

const deployEnvSchema = z.object({
  DEPLOY_DOCUMENT_HUB: z.enum(['true', 'false']).default('false'),
  DEPLOY_WORKER_NAME: optionalName,
  DEPLOY_ACCOUNT_ID: optionalName,
  DEPLOY_CUSTOM_DOMAIN: optionalName,
  DEPLOY_D1_DATABASE_ID: z.string().trim().min(1),
  DEPLOY_KV_NAMESPACE_ID: z.string().trim().min(1),
  // Optional Wrangler preview binding; falls back to DEPLOY_KV_NAMESPACE_ID
  DEPLOY_KV_PREVIEW_NAMESPACE_ID: optionalName,
  DEPLOY_D1_DATABASE_NAME: defaultName,
  DEPLOY_R2_BUCKET_NAME: optionalName,
  // Optional Wrangler preview bucket; falls back to DEPLOY_R2_BUCKET_NAME when R2 is enabled
  DEPLOY_R2_PREVIEW_BUCKET_NAME: optionalName,
  DEPLOY_ANALYTICS_DATASET: defaultName,
})

async function loadEnv() {
  let fileEnv = {}

  try {
    fileEnv = parseEnv(await readFile(envPath, 'utf8'))
  }
  catch (error) {
    if (error.code !== 'ENOENT')
      throw error
  }

  return deployEnvSchema.parse({ ...fileEnv, ...process.env })
}

function getBinding(config, section, binding) {
  const bindings = config[section]
  const match = Array.isArray(bindings)
    ? bindings.find(item => item.binding === binding)
    : undefined

  if (!match)
    throw new Error(`Missing expected ${section} binding "${binding}" in wrangler.jsonc`)

  return match
}

const source = await readFile(sourcePath, 'utf8')
const parseErrors = []
const config = parse(source, parseErrors, { allowTrailingComma: true })

if (parseErrors.length > 0) {
  const details = parseErrors
    .map(error => `${printParseErrorCode(error.error)} at offset ${error.offset}`)
    .join(', ')
  throw new Error(`Failed to parse wrangler.jsonc: ${details}`)
}

const env = await loadEnv()
const d1 = getBinding(config, 'd1_databases', 'DB')
const kv = getBinding(config, 'kv_namespaces', 'KV')
const analytics = getBinding(config, 'analytics_engine_datasets', 'ANALYTICS')

d1.database_id = env.DEPLOY_D1_DATABASE_ID
d1.database_name = env.DEPLOY_D1_DATABASE_NAME
kv.id = env.DEPLOY_KV_NAMESPACE_ID
kv.preview_id = env.DEPLOY_KV_PREVIEW_NAMESPACE_ID ?? env.DEPLOY_KV_NAMESPACE_ID
analytics.dataset = env.DEPLOY_ANALYTICS_DATASET

// This installation intentionally has no paid add-on bindings or public preview URLs.
if (env.DEPLOY_DOCUMENT_HUB === 'true') {
  if (!env.DEPLOY_WORKER_NAME || !env.DEPLOY_ACCOUNT_ID)
    throw new Error('Document Hub requires an explicit Worker name and account ID')
  config.name = env.DEPLOY_WORKER_NAME
  config.account_id = env.DEPLOY_ACCOUNT_ID
  config.workers_dev = false
  config.preview_urls = false
  config.routes = env.DEPLOY_CUSTOM_DOMAIN ? [{ pattern: env.DEPLOY_CUSTOM_DOMAIN, custom_domain: true }] : []
  delete config.ai
  delete config.analytics_engine_datasets
  config.triggers = { crons: [] }
  config.observability = { enabled: true, head_sampling_rate: 0.01, logs: { enabled: true, invocation_logs: false }, traces: { enabled: false } }
  config.vars = {
    ...config.vars,
    NUXT_RESOURCE_GUARDS_ENABLED: 'true',
    NUXT_DISABLE_ACCESS_LOG: 'true',
    NUXT_AUTHORITATIVE_REDIRECTS: 'true',
    NUXT_REQUIRE_HTTPS: 'true',
    NUXT_DISABLE_AUTO_BACKUP: 'true',
    NUXT_REDIRECT_STATUS_CODE: '302',
    NUXT_REDIRECT_NO_STORE: 'true',
    NUXT_PUBLIC_PREVIEW_MODE: '',
    NUXT_PUBLIC_HOME_URL: '',
    NUXT_HOME_URL: '',
    NUXT_PUBLIC_LINK_PROXY_ENABLED: 'false',
    NUXT_API_CORS: 'false',
  }
}

if (env.DEPLOY_R2_BUCKET_NAME && env.DEPLOY_DOCUMENT_HUB !== 'true') {
  const r2 = getBinding(config, 'r2_buckets', 'R2')
  r2.bucket_name = env.DEPLOY_R2_BUCKET_NAME
  r2.preview_bucket_name = env.DEPLOY_R2_PREVIEW_BUCKET_NAME ?? env.DEPLOY_R2_BUCKET_NAME
}
else {
  config.r2_buckets = config.r2_buckets.filter(({ binding }) => binding !== 'R2')
}

await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
