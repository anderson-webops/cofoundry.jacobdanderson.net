<script setup lang="ts">
const router = useRouter()

usePageSeo("Page not found")
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
        The route does not exist in the current CoFoundry workspace. You can head back or return to the product shell.
      </p>
      <div class="mt-8 flex gap-3 justify-center">
        <BaseButton variant="secondary" @click="router.back()">
          Go back
        </BaseButton>
        <BaseButton to="/">
          Home
        </BaseButton>
      </div>
    </div>
  </div>
</template>
