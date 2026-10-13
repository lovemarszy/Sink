<script setup lang="ts">
// A full request reaches the server-rendered, password-protected directory.
definePageMeta({ layout: false })
onMounted(() => window.location.reload())
</script>

<template>
  <main>
    <a href="/">Document Hub</a>
  </main>
</template>
