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
  <div class="p-4 min-h-screen lg:p-5">
    <div class="page-shell gap-4 grid min-h-[calc(100vh-2rem)] lg:grid-cols-[280px_minmax(0,1fr)]">
      <div class="hidden lg:block">
        <AppSidebar />
      </div>

      <div class="gap-4 grid">
        <div class="flex items-center justify-between lg:hidden">
          <AppLogo />
          <div class="flex gap-3 items-center">
            <ThemeToggle />
            <button class="p-2 border border-[var(--line)] rounded-full" @click="mobileNavOpen = !mobileNavOpen">
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
