<script setup lang="ts">
import { adminNavigation } from "~/shared/constants/app"
</script>

<template>
  <div class="p-4 min-h-screen lg:p-5">
    <div class="page-shell gap-4 grid lg:grid-cols-[260px_minmax(0,1fr)]">
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
        <div class="panel-inset muted text-sm leading-6 mt-6 p-4">
          Moderation, reports, and platform analytics for the CoFoundry workspace.
        </div>
      </aside>
      <main class="gap-6 grid">
        <slot />
      </main>
    </div>
  </div>
</template>
