---
title: Document Hub
description: Understand this fork's private directory, public short links, and minimal deployment profile.
---

# Document Hub

This fork replaces Sink's marketing homepage with a password-protected document directory and a separate administration login. It stores links and metadata; destination documents remain with their original providers.

## Access model

- The homepage requires the shared directory password. Directory sessions expire after fifteen minutes and do not grant management access.
- `/dashboard/login` accepts the private management key. Its browser copy expires after fifteen minutes; the API key remains valid until rotated.
- Direct short URLs remain public, subject to their individual link controls. Hiding a link from the directory does not protect the destination document.

Directory login, search, tag filtering, opening links, and manual copying work without JavaScript. The administration panel requires JavaScript.

## Publish a resource

Complete the first-run [storage initialization](/storage/kv-to-d1), then use [link management](/features/links) to create a short URL with a title, description, and tags. Enable **Show in directory** to list it on the homepage. New links are unlisted by default.

Password-protected, unsafe, and expired links are omitted from the directory. The directory loads at most 500 eligible records and searches metadata, not document contents.

## Deployment and operation

The repository's `DOCUMENT_HUB.md` is the operations guide for this fork. Use `.env.document-hub.example` to prepare the minimal Workers profile. Neither file contains a real deployment URL or production passwords.

The profile binds D1, KV, static assets, and native request limits. It disables AI, Analytics Engine, R2, scheduled backups, proxying, demo mode, workers.dev, and preview URLs. The inherited full-feature Sink deployment instructions describe additional optional services; they do not establish this profile's resource policy.

Keep production credentials in encrypted Worker secrets. After changing the shared directory password, verify that new logins work and previous sessions fail. Use [link export](/features/import-export) for private manual backups; automatic R2 snapshots are disabled in the minimal profile.

Free quotas can be exhausted, and native request limits are not a spending cap. Check the actual Workers account plan and current Cloudflare terms before deploying or upgrading. Actual school-browser and network compatibility needs hands-on testing.
