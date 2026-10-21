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
  <div class="py-8 min-h-screen">
    <div class="page-shell">
      <div class="mb-8 flex items-center justify-between">
        <AppLogo />
        <ThemeToggle />
      </div>
      <main>
        <div class="panel mx-auto p-6 max-w-xl w-full md:p-8">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
