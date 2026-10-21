<script setup lang="ts">
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
  <div class="py-6 flex flex-col min-h-screen md:py-8">
    <a href="#main-content" class="skip-link">Skip to content</a>
    <div class="page-shell flex flex-1 flex-col">
      <div class="mb-10 flex gap-3 items-center justify-between">
        <AppLogo />
        <div class="flex gap-2 items-center">
          <BaseButton variant="ghost" to="/" class="hidden sm:inline-flex">
            <span class="i-carbon-arrow-left" aria-hidden="true" />
            Back to site
          </BaseButton>
          <ThemeToggle />
        </div>
      </div>
      <main id="main-content" tabindex="-1" class="outline-none flex flex-1 items-start justify-center md:pt-6">
        <div class="panel p-6 max-w-lg w-full md:p-10">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
