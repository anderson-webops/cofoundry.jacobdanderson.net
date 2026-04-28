<script setup lang="ts">
import { trustCenterPages } from "~/shared/data/public-content"

usePageSeo("Trust Center", "Learn how CoFoundry handles visibility, outreach limits, and misuse prevention.", {
  canonicalPath: "/trust",
})
</script>

<template>
  <div class="reading-shell page-section">
    <PageIntro
      eyebrow="Trust Center"
      title="How CoFoundry handles privacy, outreach, and misuse."
      description="These pages explain how profile visibility, contact rules, moderation, and outreach limits work."
    />

    <div class="mt-10 gap-5 grid lg:grid-cols-3">
      <NuxtLink
        v-for="page in trustCenterPages"
        :key="page.slug"
        :to="`/trust/${page.slug}`"
        class="panel p-6 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
      >
        <p class="section-kicker">
          {{ page.eyebrow }}
        </p>
        <h2 class="text-2xl font-semibold mt-3">
          {{ page.title }}
        </h2>
        <p class="muted text-sm leading-6 mt-4">
          {{ page.description }}
        </p>
      </NuxtLink>
    </div>
  </div>
</template>
