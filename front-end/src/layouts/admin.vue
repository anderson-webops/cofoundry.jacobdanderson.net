<script setup lang="ts">
import { adminNavigation } from "~/shared/constants/app"

useHead({
  meta: [
    {
      name: "robots",
      content: "noindex, nofollow",
    },
  ],
})
</script>

<template>
  <div class="px-3 py-4 min-h-screen lg:px-4 lg:py-5">
    <div class="workspace-shell gap-5 grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <aside class="panel p-4">
        <div class="mb-6 flex items-center justify-between">
          <AppLogo />
          <ThemeToggle />
        </div>
        <nav class="gap-1 grid">
          <NuxtLink
            v-for="item in adminNavigation"
            :key="item.to"
            :to="item.to"
            class="text-sm text-[var(--muted)] font-medium px-3 py-2.5 rounded-2xl flex gap-3 transition items-center hover:text-[var(--text)] hover:bg-[var(--accent-soft)]"
            active-class="bg-[var(--accent-soft)] text-[var(--text)]"
          >
            <span :class="item.icon" />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </nav>
        <div class="mt-6 gap-3 grid">
          <div class="panel-inset muted text-sm leading-6 p-4">
            Moderation, server-approved enforcement actions, and audit history for the CoFoundry workspace.
          </div>
          <ThemeSchemePicker align="start" compact />
        </div>
      </aside>
      <div class="gap-5 grid">
        <AppTopbar />
        <main class="gap-6 grid">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>
