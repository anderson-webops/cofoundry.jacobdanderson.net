<script setup lang="ts">
import { adminNavigation } from "~/shared/constants/app"

const mobileNavOpen = ref(false)

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
  <div class="py-4 min-h-screen lg:py-5">
    <div class="workspace-shell gap-5 grid min-h-[calc(100vh-2rem)] lg:grid-cols-[272px_minmax(0,1fr)] lg:min-h-[calc(100vh-2.5rem)]">
      <div class="hidden lg:block">
        <aside class="panel p-4 h-full">
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
          <div class="mt-6">
            <ThemeSchemePicker align="start" compact />
          </div>
        </aside>
      </div>

      <div class="gap-5 grid">
        <div class="flex items-center justify-between lg:hidden">
          <AppLogo />
          <div class="flex gap-3 items-center">
            <ThemeToggle />
            <button class="p-2 border border-[var(--line)] rounded-full inline-flex items-center justify-center" aria-label="Toggle admin navigation" @click="mobileNavOpen = !mobileNavOpen">
              <span :class="mobileNavOpen ? 'i-carbon-close' : 'i-carbon-menu'" />
            </button>
          </div>
        </div>

        <aside v-if="mobileNavOpen" class="panel p-4 lg:hidden">
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
          <div class="mt-6">
            <ThemeSchemePicker align="start" compact />
          </div>
        </aside>

        <AppTopbar />
        <main class="gap-6 grid">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>
