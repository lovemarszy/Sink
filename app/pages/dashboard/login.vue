<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'

definePageMeta({
  layout: false,
})

const { t } = useI18n()

useSeoMeta({
  title: () => t('login.title'),
  description: () => t('login.description'),
  ogTitle: () => t('login.title'),
  ogSiteName: () => t('login.title'),
  ogDescription: () => t('login.description'),
  ogImage: '',
  twitterTitle: () => t('login.title'),
  twitterDescription: () => t('login.description'),
  twitterImage: '',
  robots: 'noindex, nofollow',
})
</script>

<template>
  <main class="flex min-h-svh items-center justify-center px-6 py-16">
    <div class="flex w-full max-w-sm flex-col gap-4">
      <div class="flex items-center justify-between gap-4">
        <Button as-child variant="ghost" size="sm">
          <a href="/">
            <ArrowLeft aria-hidden="true" />
            {{ $t('layouts.links.home_aria_label') }}
          </a>
        </Button>
        <div class="flex items-center gap-1">
          <SwitchLanguage />
          <SwitchTheme />
        </div>
      </div>
      <Login />
    </div>
  </main>
</template>
