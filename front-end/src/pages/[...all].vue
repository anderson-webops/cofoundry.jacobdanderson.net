<script setup lang="ts">
const router = useRouter()
const { getPrimaryAccessCta } = useProductAccess()
const primaryAccessCta = computed(() => getPrimaryAccessCta("not-found"))

usePageSeo("Page not found", "The requested CoFoundry page could not be found.", {
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
        Page not found
      </h1>
      <p class="muted text-sm leading-7 mx-auto mt-4 max-w-lg">
        The route you requested is not available. Use the public navigation, return home, or contact the team if you expected a live workspace path here.
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
