<script setup lang="ts">
import { adminNavigation } from "~/shared/constants/app"

const mobileNavOpen = ref(false)
const route = useRoute()

function isActive(to: string) {
  if (to === "/admin")
    return route.path === "/admin" || route.path === "/admin/"

  return route.path === to || route.path.startsWith(`${to}/`)
}

watch(() => route.path, () => {
  mobileNavOpen.value = false
})

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
  <div class="py-3 min-h-screen lg:py-4">
    <a href="#main-content" class="skip-link">Skip to content</a>
    <div class="workspace-shell gap-6 grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <div class="hidden lg:block">
        <aside class="panel p-3 flex flex-col h-[calc(100vh-2rem)] top-4 sticky">
          <div class="mb-4 px-1 flex items-center justify-between">
            <AppLogo />
            <ThemeToggle />
          </div>
          <p class="nav-group-label mb-1">
            Admin
          </p>
          <nav aria-label="Admin" class="pr-1 flex-1 gap-1 grid content-start overflow-y-auto">
            <NuxtLink
              v-for="item in adminNavigation"
              :key="item.to"
              :to="item.to"
              class="nav-link"
              :class="isActive(item.to) ? 'nav-link-active' : ''"
              :aria-current="isActive(item.to) ? 'page' : undefined"
            >
              <span :class="item.icon" class="text-lg shrink-0" aria-hidden="true" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </nav>
          <div class="mt-4 pt-4 border-t border-[var(--line)]">
            <ThemeSchemePicker align="start" compact />
          </div>
        </aside>
      </div>

      <div class="gap-5 grid min-w-0 content-start">
        <div class="flex items-center justify-between lg:hidden">
          <AppLogo />
          <div class="flex gap-3 items-center">
            <ThemeToggle />
            <button
              type="button"
              class="border border-[var(--line)] rounded-full bg-[var(--panel-strong)] inline-flex h-11 w-11 items-center justify-center"
              aria-controls="admin-mobile-navigation"
              :aria-expanded="mobileNavOpen"
              aria-label="Toggle admin navigation"
              @click="mobileNavOpen = !mobileNavOpen"
            >
              <span class="text-lg" :class="mobileNavOpen ? 'i-carbon-close' : 'i-carbon-menu'" aria-hidden="true" />
            </button>
          </div>
        </div>

        <aside v-if="mobileNavOpen" id="admin-mobile-navigation" class="panel p-3 lg:hidden">
          <nav aria-label="Admin" class="gap-1 grid">
            <NuxtLink
              v-for="item in adminNavigation"
              :key="item.to"
              :to="item.to"
              class="nav-link"
              :class="isActive(item.to) ? 'nav-link-active' : ''"
              :aria-current="isActive(item.to) ? 'page' : undefined"
            >
              <span :class="item.icon" class="text-lg shrink-0" aria-hidden="true" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </nav>
          <div class="mt-4 pt-4 border-t border-[var(--line)]">
            <ThemeSchemePicker align="start" compact />
          </div>
        </aside>

        <AppTopbar />
        <main id="main-content" tabindex="-1" class="pb-10 outline-none gap-6 grid">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>
