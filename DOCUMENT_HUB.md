# Document Hub operations guide

This guide describes the document-directory fork of Sink. All addresses and resource names below are examples or values supplied by the deployer. No production URLs, account IDs, deployment history, or passwords belong in this document.

## Architecture and boundaries

The homepage is server-rendered by `server/middleware/1a.directory.ts`. Login, browsing, search, tag filters, link opening, and manual URL copying do not require JavaScript or a third-party login provider. Browser language selects Chinese or English; `NUXT_DIRECTORY_TITLE` optionally overrides the directory title. The administration panel requires JavaScript and keeps Sink's eleven synchronized interface locales.

| Route | Behavior |
| --- | --- |
| `/` | Password form, then the directory for authenticated visitors |
| `/index.html` | Redirects to the protected homepage |
| `POST /hub-login` | Same-origin form login |
| `POST /hub-logout` | Same-origin logout and session revocation |
| `GET /api/hub/directory` | Directory-session authentication; metadata only |
| `/dashboard/login` | Standalone management-key login |
| Other `/api/**` routes | Sink management authentication; directory cookies are insufficient |
| `/<slug>` | Public short-link resolution with that link's own controls |

D1 is the authoritative store; route link writes through the existing link-store utilities. The minimal production profile reads redirects directly from D1 so changes, deletions, and added link passwords take effect without waiting for KV propagation. KV remains bound for existing Sink functionality and migrations.

`listed` defaults to false. Directory queries include only explicitly listed links that are not password-protected, unsafe, or expired. Responses contain only slug, title, description, and tags, with private/no-store headers. At most 500 eligible records are loaded, then metadata search and tag filtering are applied. This is not document-content search or file hosting.

## Authentication

Directory sessions are independent random 256-bit tokens. D1 stores their SHA-256 digests, fixed 900-second expiry, and a version bound to both the directory password and management key. Cookies are HttpOnly, SameSite=Strict, and Secure over HTTPS. Reads do not extend the deadline; logout revokes the stored session. Changing either secret invalidates existing directory sessions.

`NUXT_DIRECTORY_PASSWORD` must have at least ten characters; prefer a longer random value. It is shared with approved directory viewers. There are no individual accounts, invitation lists, or per-person revocation. Destination document permissions remain independent.

The management key (`NUXT_SITE_TOKEN`) is private to the owner. Its browser copy lives in the current tab's sessionStorage for fifteen minutes; legacy localStorage copies are cleared. This browser deadline does **not** expire or rotate the underlying management API key. Cloudflare Access management authentication remains supported by upstream, but is not required by the minimal profile.

Production secrets belong in Cloudflare's encrypted Worker secrets, not in Git, build variables, public configuration, screenshots, or local plaintext delivery files. Development-only credentials may live in ignored `.env`; production operation does not require local password files.

## Local development

Use Node.js 24+ and pnpm 11.11.0. Install dependencies, copy `.env.example` to `.env`, and set test-only secrets. The general example retains upstream options; production uses the dedicated template described below.

```sh
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm dev
```

For Worker verification:

```sh
pnpm lint
pnpm types:check
pnpm locales:check
pnpm build
pnpm test --run
pnpm exec wrangler dev --local --port 8787
```

Tests apply committed migrations to simulated local D1 and disable remote bindings. Build before Worker tests to avoid testing stale server output. Complete the first-run KV-to-D1 initialization in the dashboard even when both stores are empty; otherwise link writes return HTTP 423.

## Minimal Workers deployment

### 1. Prepare isolated resources

Confirm the account's **Workers Free** plan independently of the domain zone's Free Website plan. Choose a dedicated, unused Worker name and create project-specific D1 and KV resources. Do not overwrite another Worker or deploy upstream placeholder resource IDs.

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create document-hub-db
pnpm exec wrangler kv namespace create KV
cp .env.document-hub.example .env.production
```

Fill `.env.production` with the actual account ID, Worker name, D1 database name/ID, and KV namespace ID. Keep `DEPLOY_CUSTOM_DOMAIN` empty for the first upload. The template has no passwords and is ignored after copying.

### 2. Generate and verify configuration

```sh
DEPLOY_ENV_FILE=.env.production pnpm deploy:config
DEPLOY_ENV_FILE=.env.production node scripts/check-document-hub-config.mjs
pnpm build
```

The checker compares the generated bindings with the chosen deployment inputs and verifies the minimal resource policy. Keep `DEPLOY_ENV_FILE=.env.production` on subsequent deployment commands; otherwise the scripts may read development `.env` instead.

### 3. Apply migrations and upload without a public domain

Back up existing data before migrations. New installations use the committed migrations, including `0006_pale_hitman.sql` (listing/session/login-attempt tables) and `0007_deep_mindworm.sql` (directory visibility index).

```sh
DEPLOY_ENV_FILE=.env.production pnpm deploy:worker
```

This command runs remote D1 migrations before uploading. It is a production mutation, not a validation command. The first configuration has no custom-domain route, workers.dev endpoint, or preview URL.

### 4. Install independent encrypted secrets

Run the following commands interactively and enter the values at the secret prompts. Never put real values in command arguments, shell history, or committed files.

```sh
pnpm exec wrangler secret put NUXT_SITE_TOKEN --config wrangler.deploy.jsonc --env-file .env.production
pnpm exec wrangler secret put NUXT_DIRECTORY_PASSWORD --config wrangler.deploy.jsonc --env-file .env.production
```

Use a strong random management key and a different directory password. A persistent directory title can be added separately as `NUXT_DIRECTORY_TITLE` in Worker runtime configuration; it is not a password.

### 5. Attach the chosen hostname

Set `DEPLOY_CUSTOM_DOMAIN` to your chosen hostname in `.env.production`, regenerate and check the configuration, then deploy again with the same explicit `DEPLOY_ENV_FILE`. Confirm the hostname is unused before binding it. Do not add whole-site Cloudflare Access: public short links intentionally remain accessible without directory login.

Open `/dashboard/login`, sign in, and complete the first-run storage initialization. Create links and explicitly enable **Show in directory** for eligible resources.

## Resource policy and costs

The minimal profile removes Workers AI, Analytics Engine, R2, cron jobs, workers.dev, and public preview URLs. It disables reverse proxying, click-log collection, automatic backups, API CORS, and demo mode. Redirects use 302 with no-store. Logs sample 1% with invocation logs and traces disabled. No automatic deployment integration or monitor is installed by this profile.

HTTPS is required, with HSTS scoped to the deployed hostname. Native limits execute before D1/KV work; missing or failed rate-limit bindings fail closed with HTTP 503.

| Protection | Threshold |
| --- | --- |
| Requests per IP, per Cloudflare location | 120 per minute |
| Directory login requests per IP, per Cloudflare location | 10 per minute |
| Aggregate Worker requests per Cloudflare location | 600 per minute |
| Atomic D1 directory login attempts per IP | 10 per 15-minute window |
| Login form body | 4096 bytes, including streamed bodies |

Successful directory login clears that IP's current D1 attempt counter. School networks can share public IPs, so unrelated users may share these limits. Cloudflare's native counters are approximate and local to a location; they are **not** a global accounting system or spending cap. See the [rate-limit binding documentation](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

Free quotas can be exhausted, causing request or storage operations to fail; account-level allowances may also serve other projects. The application does not guarantee availability during an attack or prevent charges from unrelated account services. Review the current [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), and [KV](https://developers.cloudflare.com/kv/platform/pricing/) terms before enabling paid plans or add-ons.

## Routine maintenance

- **Manage links:** change metadata, destinations, tags, and listing status through the dashboard. Reload the directory to see changes. Keep one short code when changing a document's destination.
- **Backup:** use **Import/Export → Links export** and keep the JSON privately. Exports contain link information and password-related fields, but do not replace a full database backup or include Worker secrets. R2 snapshots and cron backups are disabled in the minimal profile. Review D1 recovery controls for database-level recovery.
- **Rotate directory password:** run `wrangler secret put NUXT_DIRECTORY_PASSWORD` with the same config/env-file arguments above. Once the update propagates, test a new login and confirm old passwords and sessions fail. No local plaintext password file is needed.
- **Rotate management key:** update `NUXT_SITE_TOKEN` as an encrypted secret. Old API clients and browser copies will be rejected; existing directory sessions are also invalidated.
- **Upgrade:** review upstream changes, preserve this fork's directory/authentication/resource policy, run checks against a fresh build, export data, then deploy using the intended configuration. Add schema changes through generated Drizzle migrations.
- **Rollback:** retain a prior Worker version and a database backup/export. Cloudflare deployment rollback changes code, not the D1 schema. Keep additive tables and columns unless a separately reviewed data restoration is required. Restoring an old secret or code version may affect authentication; recheck access after rollback.

## Acceptance and troubleshooting

| Check or symptom | Expected behavior or next step |
| --- | --- |
| Anonymous homepage | Password form only; no resource titles or tags |
| Anonymous directory API | HTTP 401 |
| Missing or too-short directory secret | HTTP 503; set the encrypted secret |
| Incorrect password | HTTP 401 without granting a session |
| Repeated or burst requests | HTTP 429; wait before retrying |
| Protection unavailable | HTTP 503; inspect all three rate-limit bindings |
| Link writes return 423 | Complete first-run storage initialization |
| Link missing from directory | Check listed status, link password, unsafe flag, expiry, and the 500-item bound |
| Visitor attempts a management write | Rejected; directory cookies are not management keys |
| Target edited or link deleted | Next redirect reflects authoritative D1 state in the minimal profile |
| Logout or secret rotation | Previous directory session is rejected |
| School browser | Verify native directory with JavaScript disabled on the actual device/network; the administration panel still needs JavaScript |

Network/domain blocking cannot be solved by the password form. Avoid adding fallback public endpoints that bypass the intended access policy.

## Source map

- Directory: `server/services/directory.ts`, `shared/utils/directory.ts`, `server/utils/directory-auth.ts`, `server/utils/directory-html.ts`, `server/middleware/1a.directory.ts`, login/logout routes, and `server/api/hub/directory.get.ts`.
- Permission boundary and resources: `server/middleware/2.auth.ts`, `server/middleware/0.resource-guard.ts`, `app/utils/auth-token.ts`.
- Administration: `app/pages/dashboard/login.vue`, the existing link forms, and synchronized locale files.
- Data: `server/database/schema.ts`, `shared/schemas/link.ts`, link-store services, and generated `drizzle/` migrations.
- Deployment: `scripts/cloudflare-deploy-config.mjs`, `scripts/check-document-hub-config.mjs`, `wrangler.jsonc`, and `.env.document-hub.example`.
- Verification: directory API tests, resource-guard tests, token tests, and existing redirect/link tests. Actual school browser/network compatibility requires separate hands-on testing.

Retain upstream license notices and make corresponding deployed source available under AGPL-3.0-only. Deployment addresses, account identities, version IDs, and operational credentials should stay outside public documentation.
