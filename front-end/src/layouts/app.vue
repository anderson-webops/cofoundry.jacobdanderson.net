<script setup lang="ts">
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
  <div class="px-3 py-4 min-h-screen lg:px-4 lg:py-5">
    <div class="workspace-shell gap-5 grid min-h-[calc(100vh-2rem)] lg:grid-cols-[292px_minmax(0,1fr)]">
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
