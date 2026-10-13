# Document Hub for loveur.life

This fork keeps Sink's administration and redirects, and replaces the marketing homepage with a password-protected resource directory. The intended hostname is `go.loveur.life`; no production resources or DNS changes are made by local development.

## Access model

- `/`: a native HTML password form, then the directory after authentication.
- `/hub-login`: same-origin POST only; creates a separate directory session.
- `/hub-logout`: same-origin POST only; revokes the session in D1.
- `GET /api/hub/directory`: requires a valid directory session. It returns only title, description, slug, and tags for explicitly listed eligible links.
- `/<slug>`: existing public short-link behavior, including existing link passwords and warnings. Directory login is not required.
- Management APIs: retain Sink's Site Token and verified Cloudflare Access authentication. A directory cookie never grants management rights.

The directory password is shared. Anyone receiving it can browse the same directory; individual invitation, attribution, and revocation are not implemented. Change the shared password to invalidate all existing directory sessions. Original document permissions remain independent.

Sessions use random 256-bit opaque tokens. D1 stores only their SHA-256 digests, an expiry, and a password version bound to the management secret. Cookies are HttpOnly, SameSite=Strict, Secure over HTTPS, and have no persistent lifetime. The server enforces a 15-minute expiry and logout revokes the stored session. Shared computers should still use the explicit logout button, since some browsers restore session cookies.

Login is limited to 10 attempts per IP per 15-minute window using atomic D1 increments. Cloudflare supplies the client IP in production. School users sharing an IP can share the limit; successful logins clear the current counter.

## Implementation choices

The homepage is deliberately server-rendered through `server/middleware/1a.directory.ts`. It avoids a frontend framework, external fonts, third-party login, or JavaScript requirement for login, browsing, search, tag filtering, and opening links. A small optional script provides clipboard copying; the complete short URL is also selectable without JavaScript.

The server chooses a complete Chinese or English interface from the browser language. `NUXT_DIRECTORY_TITLE` can override the title without exposing secrets. The Sink dashboard retains its synchronized locale files. Titles and descriptions are now available in the basic link form; they continue to serve existing link previews too.

`links.listed` defaults to false for all existing and new records. Edits that omit it preserve the current flag. Old imports without the flag remain unlisted. Password-protected, unsafe, and expired links are excluded even when listed. Sink currently has no separate disabled field; deletion removes a link from D1.

Directory queries project an allowlist in SQL, exclude noneligible links before querying tags, and return at most 500 items. Search matches title, description, slug, and tags after trimming, Unicode normalization, and case folding. Tag filters combine with search. Results use a stable title/slug order. All directory HTML and API responses are private/no-store, so management updates appear on the next reload. The directory does not index document contents or cache a second copy of link data.

`wrangler.jsonc` runs the Worker before static assets for the root, static index alias, login/logout, and API paths. Root prerendering is disabled. `/index.html` redirects through the protected root. Other prerendered pages contain no directory records. Client navigation back to `/` reloads the native page.

## Local setup and checks

Use Node.js 24+ and pnpm 11.11.0 as declared by upstream. Keep development credentials in ignored `.env`; never reuse development/test passwords in production.

```sh
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm lint
pnpm types:check
pnpm locales:check
pnpm build
pnpm test --run
pnpm exec wrangler dev --local --port 8787
```

Tests execute the fresh `.output/server/index.mjs` and apply committed migrations to local simulated D1. Remote bindings are disabled in Vitest; failure-path AI tests mock network failure rather than waiting for external websites.

After local D1 setup, complete Sink's first-run KV-to-D1 migration in the existing dashboard, even for an empty installation. This enables link writes.

## Production checklist (requires explicit deployment authorization)

1. Use the fork `https://github.com/lovemarszy/Sink`; review and merge the document-hub changes first. Preserve upstream license notices and make the deployed source available under AGPL-3.0-only.
2. Verify the Cloudflare account and the `loveur.life` zone. Verify that `go.loveur.life` is unused before adding the custom Worker domain. Select a new, unused Worker name (suggested `loveur-document-hub`) in the deployment configuration; never overwrite an existing Worker named `sink` by using the upstream default.
3. Create project-specific D1 and KV resources. Configure `DEPLOY_D1_DATABASE_ID`, `DEPLOY_D1_DATABASE_NAME`, and `DEPLOY_KV_NAMESPACE_ID`. Existing configuration can generate `wrangler.deploy.jsonc`; do not deploy upstream placeholder IDs.
4. Keep optional R2 backups and AI/analytics services within the selected account's available features. Do not add paid resources without approval. If R2 is omitted, set `NUXT_DISABLE_AUTO_BACKUP=true` and arrange backups separately.
5. Set `NUXT_SITE_TOKEN` as a strong, private encrypted management secret and `NUXT_DIRECTORY_PASSWORD` as an independent encrypted secret of at least 12 characters. Keep these out of Git, browser bundles, logs, and public responses. Set secrets before enabling the public custom domain.
6. Set `NUXT_PUBLIC_PREVIEW_MODE` to empty, leave `NUXT_PUBLIC_HOME_URL` and legacy `NUXT_HOME_URL` empty, and keep API CORS disabled unless specifically needed.
7. Recommend `NUXT_REDIRECT_STATUS_CODE=302` and `NUXT_REDIRECT_NO_STORE=true` for mutable document destinations. These are configuration recommendations; core redirect defaults and middleware are preserved.
8. Back up any existing database before running remote migrations. The new generated migration is `drizzle/0006_pale_hitman.sql`; it adds a default-false listing column and independent session/rate-limit tables without deleting existing links. `drizzle/0007_deep_mindworm.sql` adds a visibility/title/slug index to avoid scanning unlisted records.
9. After approval and backup, use the existing `pnpm deploy:config` and `pnpm db:migrate:remote` commands with verified project bindings. Build fresh, then use `pnpm deploy:worker`. Note that the deploy command itself runs remote migrations first. Ordinary verification must never run these commands.
10. Enable HTTPS and attach `go.loveur.life` as the custom Worker domain. The application's directory authentication also protects alternate Worker hostnames. Do not place whole-site Cloudflare Access in front of it, since direct short links intentionally remain public. Optional management-only Access must use owner identities, not directory viewers.
11. Complete the existing first-run link-store setup and verify the acceptance checks below.

For rollback, retain the previous Worker version and a D1 backup/export. Roll back code with Cloudflare's deployment controls; leave additive tables/columns in place unless a separately reviewed restoration is needed. If rolling back to upstream's marketing homepage, do not treat that page as a private directory. Additive schema rollback must never delete existing links or link tags.

## Manual acceptance checks

- In a new browser session, `/` displays only a password form. Anonymous directory API requests return 401; no link titles or tags are exposed.
- Incorrect passwords and foreign-origin submissions fail. Repeated attempts are limited. Successful login shows the directory without giving access to management APIs.
- Create a link without opting in: the short URL works, but the directory omits it.
- Set title, description, tags, and Show in directory: the item appears on reload. Search in Chinese/English, combine a tag filter, and clear an empty result.
- Open uses `/<slug>`. Copy/select yields the full short URL. Change the destination and confirm the same slug redirects to the new target.
- Clear Show in directory: the item disappears, while direct access still works. Add a link password, mark unsafe, expire, or delete a link: it is excluded from the directory.
- Logout, then replay the old cookie: directory API access is rejected. Rotate the directory password: old sessions are rejected.
- On a school browser, test with JavaScript disabled; login, search, filters, opening, and manual copying still work. Network/domain blocking and very old browser behavior require testing on the actual school computer.

## Source touchpoints

- Data: `server/database/schema.ts`, generated `drizzle/0006_pale_hitman.sql` and metadata, `shared/schemas/link.ts`, `server/services/link-store/d1.ts`.
- Directory: `server/services/directory.ts`, `shared/utils/directory.ts`, `server/utils/directory-auth.ts`, `server/utils/directory-html.ts`, `server/middleware/1a.directory.ts`, `server/routes/hub-login.post.ts`, `server/routes/hub-logout.post.ts`, `server/api/hub/directory.get.ts`.
- Authentication boundary: the exact GET exception in `server/middleware/2.auth.ts` validates only the independent directory session.
- UI: `app/pages/index.vue`, the existing link form/advanced fields and form payload utility, locale additions in all 11 `links.json` files.
- Routing/config: `app/app.config.ts`, `nuxt.config.ts`, `wrangler.jsonc`, `.env.example`, regenerated `worker-configuration.d.ts`.
- Validation: `tests/api/directory.spec.ts`, existing form defaults and AI fallback tests, `vitest.config.ts`. Vue is explicitly declared at its already-used version so pnpm unit tests can resolve it. A pre-existing implicit-any callback in `Heatmap.vue` is annotated with its existing accepted `unknown` parameter type to restore typecheck.

## Verified results

Local build, ESLint, Nuxt typecheck, locale contract checks, and diff whitespace checks passed. All 36 test files and 401 tests passed, including directory sessions, resource guards, browser credential expiry, HTTPS, and authoritative redirects. Native browser verification covered login, search, clipboard copying, logout, and the 390-pixel mobile layout. The build retains upstream CSS-transform and sourcemap warnings; it completed successfully. School network access and the actual school browser have not been tested. Production setup is authorized by the owner; deployment verification is recorded separately below.

## Production resource protection

The owner confirmed Workers Free for the Marszy account on 2026-10-13. The existing OAuth authorization cannot read billing subscriptions; this confirmation must not be confused with the zone’s separate Free Website plan. Do not upgrade the Workers plan without a fresh cost review. Free Workers, D1, and KV stop accepting operations after their account quotas are exceeded; native rate limit bindings themselves are only approximate per-location guards, not a spending cap. Account quotas are shared with other Workers. Traffic exhaustion can temporarily affect availability, including other projects on the account.

Set `DEPLOY_DOCUMENT_HUB=true`, `DEPLOY_WORKER_NAME=loveur-document-hub`, and `DEPLOY_ACCOUNT_ID` in an ignored `.env.production`. Use `DEPLOY_ENV_FILE=.env.production pnpm deploy:config`, then `node scripts/check-document-hub-config.mjs` before publishing. The generated profile has only project-specific D1/KV, static assets, and native rate limiters. It removes AI, Analytics Engine, R2, cron jobs, public workers.dev, and preview URLs. Reverse proxying and analytics collection are disabled, so public redirects do not download target documents, write click records, or run user-agent analytics. Logs sample 1% and disable invocation logging; built-in request metrics remain available. No automatic deploy integration or background monitor is configured.

`server/middleware/0.resource-guard.ts` executes before redirect resolution. It rejects excess traffic before D1/KV calls: 120 requests/minute per client IP, 10 login requests/minute per IP, and 600 requests/minute per Cloudflare location across this Worker. Shared school IPs can share these thresholds. The original atomic D1 limit of 10 login attempts per 15-minute window remains as a second layer. Missing or failed native bindings return 503 instead of silently allowing database work. Login bodies are streamed with a hard 4096-byte limit, even without Content-Length. Directory session deadlines are fixed at 900 seconds and are not extended by reads.

The dashboard no longer saves its management key in localStorage. Its browser copy lives in sessionStorage in the current tab, with a fixed 15-minute deadline; legacy persistent copies are cleared. The long-lived management API secret itself remains valid until rotated, as required by Sink’s existing authentication model. Directory login still does not confer management rights.

First upload a Worker with no route and workers.dev disabled. Install the two encrypted secrets through stdin, then attach only `go.loveur.life`. Never upload credential files, echo their values, or place them in deployment vars. User credential output files have owner-only filesystem permissions and should be kept separate: only the directory password is intended for approved visitors.

For this minimal profile, `NUXT_AUTHORITATIVE_REDIRECTS=true` reads active links directly from D1 rather than KV. A live test showed KV could return the previous destination immediately after an edit. The opt-in D1 path makes edits, deletions, expiry, and newly added passwords effective on the next redirect request; upstream KV behavior remains the default for other installations. D1 reads increase modestly, while redirect-triggered cache refill writes are avoided.

`NUXT_REQUIRE_HTTPS=true` upgrades HTTP to HTTPS before rendering any login form and sends HSTS for this hostname only. It does not change the zone’s other websites or SSL settings.

## Deployment record

Deployed to `https://go.loveur.life` on 2026-10-13 under the owner’s explicit authorization. Worker: `loveur-document-hub`. D1: `loveur-document-hub`; dedicated KV namespace. Version: `f257e24f-4818-473d-b381-8660bc25786b`. Both encrypted secret names were verified without exposing their values. Live configuration checks confirmed only D1/KV/assets/rate-limit bindings, disabled workers.dev/previews, no cron schedules, no AI/Analytics Engine/R2, enabled resource guards, and sampled logs.

All 36 test files and 401 tests passed; lint, typecheck, locale checks, build, and production configuration checks passed. Live HTTPS probes verified anonymous directory rejection, rejection of development credentials, management authentication, empty-store initialization, Secure/HttpOnly/SameSite cookies, default-unlisted creation, metadata redaction, immediate target changes, visitor write rejection, foreign-origin rejection, and logout revocation. Temporary probe links were deleted. HTTP upgrades to HTTPS and HSTS were verified. Native browser verification confirmed directory login, the 15-minute notice, management login, and a fresh management tab requiring reauthentication. A homepage reload conflict discovered during browser verification was fixed before final deployment. The actual school browser/network still needs testing.

The production directory is empty and ready for owner-managed resources. R2/cron backups are intentionally disabled; use Sink’s authenticated export when needed and consult Cloudflare D1 recovery controls. The management API key remains long-lived until rotated; its browser session copy expires after 15 minutes.
