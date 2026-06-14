<script setup lang="ts">
const router = useRouter()
const { getPrimaryAccessCta } = useProductAccess()
const primaryAccessCta = computed(() => getPrimaryAccessCta("not-found"))

if (import.meta.server)
  setResponseStatus(404)

usePageSeo("Page unavailable", "The requested CoFoundry page is unavailable or may have moved.", {
  robots: "noindex, nofollow",
})
</script>

<template>
  <div class="page-shell py-20">
    <div class="panel mx-auto p-10 text-center max-w-2xl">
      <div class="text-3xl text-[var(--accent)] mx-auto mb-6 p-4 rounded-full bg-[var(--accent-soft)] inline-flex">
        <span class="i-carbon-warning" />
      </div>
      <h1 class="text-3xl font-semibold">
        Page unavailable
      </h1>
      <p class="muted text-sm leading-7 mx-auto mt-4 max-w-lg">
        The page you requested is unavailable or may have moved. Use the main navigation, return home, or contact support if you need help finding the right page.
      </p>
      <div class="mt-8 flex gap-3 justify-center">
        <BaseButton variant="secondary" @click="router.back()">
          Go back
        </BaseButton>
        <BaseButton :to="primaryAccessCta.to">
          {{ primaryAccessCta.label }}
        </BaseButton>
        <BaseButton variant="secondary" to="/">
          Home
        </BaseButton>
      </div>
    </div>
  </div>
</template>
