<script setup lang="ts">
const mobileNavOpen = ref(false)
const route = useRoute()

useWorkspaceRealtimeRefresh()

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
    <div class="workspace-shell gap-6 grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <div class="hidden lg:block">
        <div class="h-[calc(100vh-2rem)] top-4 sticky">
          <AppSidebar />
        </div>
      </div>

      <div class="gap-5 grid min-w-0 content-start">
        <div class="flex items-center justify-between lg:hidden">
          <AppLogo />
          <button
            type="button"
            class="border border-[var(--line)] rounded-full bg-[var(--panel-strong)] inline-flex h-11 w-11 items-center justify-center"
            aria-controls="workspace-mobile-navigation"
            :aria-expanded="mobileNavOpen"
            aria-label="Toggle workspace navigation"
            @click="mobileNavOpen = !mobileNavOpen"
          >
            <span class="text-lg" :class="mobileNavOpen ? 'i-carbon-close' : 'i-carbon-menu'" aria-hidden="true" />
          </button>
        </div>

        <div v-if="mobileNavOpen" id="workspace-mobile-navigation" class="lg:hidden">
          <AppSidebar />
        </div>

        <AppTopbar />
        <main id="main-content" tabindex="-1" class="pb-10 outline-none gap-6 grid">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>
