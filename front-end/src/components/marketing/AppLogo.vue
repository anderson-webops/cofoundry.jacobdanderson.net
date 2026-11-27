<script setup lang="ts">
import { NuxtLink } from "#components"
</script>

<template>
  <NuxtLink to="/" class="inline-flex gap-3 min-h-11 items-center">
    <span class="text-lg text-white font-semibold rounded-2xl bg-[var(--text)] inline-flex h-11 w-11 items-center justify-center dark:text-[var(--cta-accent-text)] dark:bg-[var(--accent)]">
      C
    </span>
    <span class="text-lg tracking-tight font-semibold">CoFoundry</span>
  </NuxtLink>
</template>
