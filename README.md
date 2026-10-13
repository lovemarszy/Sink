# Document Hub

A self-hosted document directory built on [Sink](https://github.com/miantiao-me/Sink). Approved visitors enter a shared password to browse the directory; the owner manages links through a separate administration panel.

The application runs on Cloudflare Workers with D1 and Workers KV. It stores links and metadata, rather than uploading or hosting the destination documents. No deployment URL or production credentials are included in this repository.

## Features

- A password-protected homepage with fixed 15-minute directory sessions.
- A native HTML directory: login, search, tag filtering, opening links, and manual copying work without JavaScript. Clipboard copying is an optional enhancement.
- Titles, descriptions, tags, and an explicit **Show in directory** option. New links are unlisted by default.
- Public short URLs with editable destinations. Hiding a link from the directory does not disable its short URL.
- A separate, minimal administration login with eleven interface languages, theme switching, and no promotional header or footer.
- Existing Sink link management, expiry controls, link passwords, and JSON import/export.
- A minimal deployment profile with HTTPS, request limits, and no AI, Analytics Engine, R2, scheduled backups, or public preview hostnames.

## Access and privacy

| Entry | Access | Lifetime |
| --- | --- | --- |
| `/` and `GET /api/hub/directory` | Shared directory password | Server-enforced 15 minutes |
| `/dashboard/login` and management APIs | Independent management key (`NUXT_SITE_TOKEN`) | Browser copy expires after 15 minutes; the API key remains valid until rotated |
| `/<slug>` | Public, subject to that link's own password, warning, or expiry | Controlled by the link settings |

Directory access never grants management permissions. Directory responses expose only titles, descriptions, slugs, and tags. Password-protected, unsafe, and expired links are excluded even if marked as listed.

This is a shared-password directory, without individual accounts or invitations. Changing the directory password invalidates existing directory sessions. Document providers retain their own access permissions; protect confidential files at the destination as well.

## Using the directory

1. Open `/dashboard/login` and enter the management key.
2. Complete the first-run storage initialization, including for a new empty installation.
3. Create a link with its destination, short code, title, description, and optional tags.
4. Enable **Show in directory** when the link should appear on the homepage.
5. Share the directory password with approved visitors; keep the management key private.

Changes appear when visitors reload the directory. The directory is limited to 500 eligible links and searches their metadata, not the contents of documents. Use logout on shared computers.

## Development

Requires Node.js 24+ and **pnpm 11.11.0**.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
```

Set development-only `NUXT_SITE_TOKEN` and `NUXT_DIRECTORY_PASSWORD` values in ignored `.env`. The directory password must contain at least ten characters; prefer a longer random value for production. Do not reuse production secrets for development or tests.

```sh
pnpm db:migrate:local
pnpm dev
```

The Nuxt development server uses port 7465. For a local Worker preview, build first and run `pnpm exec wrangler dev --local --port 8787`. Finish the existing KV-to-D1 initialization before creating links.

## Deployment and maintenance

Use the [Document Hub operations guide](DOCUMENT_HUB.md) for the minimal Workers profile, secret setup, database migrations, custom domains, password rotation, backups, and rollback.

Copy [.env.document-hub.example](.env.document-hub.example) to an ignored `.env.production` and fill in your own account and resource IDs. The example contains no real deployment address or passwords. Deploy with the generated `wrangler.deploy.jsonc`, rather than the upstream development configuration.

The minimal profile is intended for a Workers Free account. Free quotas can be exhausted and availability can be interrupted; request limits are not a financial spending cap. Review Cloudflare's current [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), and [KV](https://developers.cloudflare.com/kv/platform/pricing/) plans before deployment or any upgrade. A zone's Free Website plan does not establish the Workers account plan.

Automatic R2 backups are disabled in this profile. Periodically export links through **Import/Export** and keep the export privately. Optional upstream analytics, AI, proxying, and R2 features require separate configuration and resource review.

## Verification

```sh
pnpm lint
pnpm types:check
pnpm locales:check
pnpm build
pnpm test --run
```

Worker tests execute the built server, so rebuild after server changes. Tests use simulated local storage with remote bindings disabled. See [AGENTS.md](AGENTS.md) for repository constraints and [DESIGN.md](DESIGN.md) for interface guidance.

The [documentation tree](docs/) also contains inherited Sink reference material. Its full-feature deployment instructions differ from this fork's minimal profile; start with `DOCUMENT_HUB.md` for this project.

Run `pnpm build:docs` to validate the documentation site. If publishing it separately, set `DOCS_SITE_URL` to its actual base URL for canonical links and a sitemap; leave it unset while the documentation has no public address.

## Attribution and license

Based on [Sink by miantiao-me](https://github.com/miantiao-me/Sink). Original license and copyright notices are retained. This fork is licensed under [AGPL-3.0-only](LICENSE); provide the corresponding source to users of a deployed modified version as required by the license.
