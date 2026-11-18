<script setup lang="ts">
import { NuxtLink } from "#components"
import BaseBadge from "~/components/ui/BaseBadge.vue"
import PageIntro from "~/components/ui/PageIntro.vue"
import { usePageSeo } from "~/composables/usePageSeo"
import { usePublicDirectory } from "~/composables/usePublicDirectory"

const industryHubs = (await usePublicDirectory()).industryHubs

usePageSeo("Industry hubs", "Browse public founder and startup searches organized by industry.", {
  canonicalPath: "/industries",
})
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      title="Browse founders and startup searches by industry."
    />

    <div class="mt-10 gap-5 grid md:grid-cols-2 xl:grid-cols-3">
      <NuxtLink
        v-for="hub in industryHubs"
        :key="hub.slug"
        :to="`/industries/${hub.slug}`"
        class="panel p-6 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
      >
        <div class="flex gap-4 items-start justify-between">
          <div>
            <h2 class="text-xl font-semibold">
              {{ hub.label }}
            </h2>
          </div>
          <BaseBadge tone="accent">
            {{ hub.profileCount + hub.opportunityCount }}
          </BaseBadge>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
