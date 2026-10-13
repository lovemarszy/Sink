---
layout: home
title: Document Hub Documentation
description: A password-protected document directory with separate administration and public short links.

hero:
  name: Document Hub
  text: Private directory, simple access
  tagline: A password-protected document directory built on Sink, with independent administration and public short links.
  actions:
    - theme: brand
      text: Document Hub Guide
      link: /guide/document-hub
    - theme: alt
      text: Explore Features
      link: /features/links
    - theme: alt
      text: API Reference
      link: /api/

features:
  - title: Runs on Cloudflare
    icon: ☁️
    details: The minimal Workers profile uses D1, KV, and native request limits. AI, analytics collection, R2, and scheduled backups are disabled.
  - title: Private directory
    icon: 🔐
    details: Use a shared password to browse listed resources, search metadata, and filter tags. Directory sessions expire after fifteen minutes.
  - title: Link management
    icon: 🔗
    details: Add expiration, passwords, warnings, tags, and device or country routing when you need them.
  - title: Independent administration
    icon: 🔑
    details: Manage resources with a separate private key. Directory viewers cannot manage links; direct short URLs retain their own controls.
---
