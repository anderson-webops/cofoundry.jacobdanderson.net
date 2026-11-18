<script setup lang="ts">
import type { NuxtError } from "#app"
import { computed } from "vue"
import { useSeoMeta } from "#app"
import BaseButton from "~/components/ui/BaseButton.vue"
import { useProductAccess } from "~/composables/useProductAccess"

const props = defineProps<{
  error: NuxtError
}>()

const { getPrimaryAccessCta } = useProductAccess()
const primaryAccessCta = computed(() => getPrimaryAccessCta("error-page"))
const statusCode = computed(() => props.error?.statusCode || 500)
const title = computed(() => statusCode.value === 404
  ? "Page unavailable"
  : "Something went wrong")
const description = computed(() => statusCode.value === 404
  ? "The page you requested is unavailable or may have moved. Use the public navigation or contact the team if you need help finding the right route."
  : "CoFoundry hit an unexpected problem while loading this page. You can return home, request access, or contact support.")

useSeoMeta({
  robots: "noindex, nofollow",
  title: `${title.value} · CoFoundry`,
})
</script>

<template>
  <div class="page-shell py-20 flex min-h-[70vh] items-center">
    <div class="panel mx-auto p-10 text-center max-w-2xl w-full">
      <div class="text-3xl text-[var(--accent)] mx-auto mb-6 p-4 rounded-full bg-[var(--accent-soft)] inline-flex">
        <span :class="statusCode === 404 ? 'i-carbon-search' : 'i-carbon-warning-alt'" />
      </div>
      <p class="section-kicker">
        Error {{ statusCode }}
      </p>
      <h1 class="text-3xl font-semibold mt-3">
        {{ title }}
      </h1>
      <p class="muted text-sm leading-7 mx-auto mt-4 max-w-lg">
        {{ description }}
      </p>
      <div class="mt-8 flex flex-wrap gap-3 justify-center">
        <BaseButton :to="primaryAccessCta.to">
          {{ primaryAccessCta.label }}
        </BaseButton>
        <BaseButton variant="secondary" to="/contact">
          Contact support
        </BaseButton>
        <BaseButton variant="ghost" to="/">
          Home
        </BaseButton>
      </div>
    </div>
  </div>
</template>
