<script setup lang="ts">
import { workspaceSeed } from "~/shared/data/seed"
import { getStageHubs } from "~/shared/utils/directory"

const stageHubs = getStageHubs(workspaceSeed)

usePageSeo("Stage hubs", "Browse public founder and startup searches organized by startup stage.", {
  canonicalPath: "/stage",
})
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Stage hubs"
      title="Choose the ambiguity level you actually want to work inside."
      description="Public stage pages make it easier to find idea-stage searches, MVP-stage roles, or more validated companies without pretending they are all the same problem."
    />

    <div class="mt-10 gap-5 grid md:grid-cols-2 xl:grid-cols-3">
      <NuxtLink
        v-for="hub in stageHubs"
        :key="hub.slug"
        :to="`/stage/${hub.slug}`"
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
      </NuxtLink>
    </div>
  </div>
</template>
