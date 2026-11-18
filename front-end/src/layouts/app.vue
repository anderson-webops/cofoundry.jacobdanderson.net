<script setup lang="ts">
import { ref } from "vue"
import { useHead } from "#app"
import AppSidebar from "~/components/app/AppSidebar.vue"
import AppTopbar from "~/components/app/AppTopbar.vue"
import ThemeToggle from "~/components/app/ThemeToggle.vue"
import AppLogo from "~/components/marketing/AppLogo.vue"
import { useWorkspaceRealtimeRefresh } from "~/composables/useWorkspaceRealtimeRefresh"

const mobileNavOpen = ref(false)

useWorkspaceRealtimeRefresh()

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
    <div class="workspace-shell gap-5 grid min-h-[calc(100vh-2rem)] lg:grid-cols-[292px_minmax(0,1fr)] lg:min-h-[calc(100vh-2.5rem)]">
      <div class="hidden lg:block">
        <AppSidebar />
      </div>

      <div class="gap-5 grid">
        <div class="flex items-center justify-between lg:hidden">
          <AppLogo />
          <div class="flex gap-3 items-center">
            <ThemeToggle />
            <button class="p-2 border border-[var(--line)] rounded-full inline-flex items-center justify-center" aria-label="Toggle workspace navigation" @click="mobileNavOpen = !mobileNavOpen">
              <span class="i-carbon-menu" />
            </button>
          </div>
        </div>

        <div v-if="mobileNavOpen" class="lg:hidden">
          <AppSidebar />
        </div>

        <AppTopbar />
        <main class="gap-6 grid">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>
