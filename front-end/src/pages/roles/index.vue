<script setup lang="ts">
import { NuxtLink } from "#components"
import BaseBadge from "~/components/ui/BaseBadge.vue"
import PageIntro from "~/components/ui/PageIntro.vue"
import { usePageSeo } from "~/composables/usePageSeo"
import { usePublicDirectory } from "~/composables/usePublicDirectory"
import { formatPublicHubInventoryLabel } from "~/shared/utils/directory"

const roleHubs = (await usePublicDirectory()).roleHubs

usePageSeo("Role hubs", "Browse public founder and collaborator searches organized by role.", {
  canonicalPath: "/roles",
})
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      title="Browse founder and collaborator searches by role."
    />

    <div class="mt-10 gap-5 grid md:grid-cols-2 xl:grid-cols-3">
      <NuxtLink
        v-for="hub in roleHubs"
        :key="hub.slug"
        :to="`/roles/${hub.slug}`"
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
        <p class="muted text-sm mt-4">
          {{ formatPublicHubInventoryLabel(hub) }}
        </p>
      </NuxtLink>
    </div>
  </div>
</template>
