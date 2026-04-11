<script setup lang="ts">
import { workspaceSeed } from "~/shared/data/seed"
import { getRoleHubs } from "~/shared/utils/directory"

const roleHubs = getRoleHubs(workspaceSeed)

usePageSeo("Role hubs", "Browse public founder and collaborator searches organized by role.", {
  canonicalPath: "/roles",
})
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Role hubs"
      title="Search by the job-to-be-done inside the founding team."
      description="Every role hub is backed by live public inventory. If a role does not have enough real profiles or startup searches to be useful, it does not get a page."
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
            <p class="muted text-sm leading-6 mt-3">
              {{ hub.description }}
            </p>
          </div>
          <BaseBadge tone="accent">
            {{ hub.profileCount + hub.opportunityCount }}
          </BaseBadge>
        </div>
        <p class="muted text-sm mt-4">
          {{ hub.profileCount }} public profiles · {{ hub.opportunityCount }} public startup searches
        </p>
      </NuxtLink>
    </div>
  </div>
</template>
