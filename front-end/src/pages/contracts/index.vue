<script setup lang="ts">
import { contractGuidePages } from "~/shared/data/public-content"

usePageSeo("Founder agreement resources", "Learn how CoFoundry approaches proposals, founder agreements, vesting, and trial plans.", {
  canonicalPath: "/contracts",
})
</script>

<template>
  <div class="reading-shell page-section">
    <PageIntro
      eyebrow="Contracts & Proposals"
      title="Guides for proposals, trials, vesting, and IP."
    />

    <div class="mt-10 gap-5 grid lg:grid-cols-2">
      <NuxtLink
        v-for="page in contractGuidePages"
        :key="page.slug"
        :to="`/contracts/${page.slug}`"
        class="panel p-6 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
      >
        <h2 class="text-2xl font-semibold">
          {{ page.title }}
        </h2>
        <p class="muted text-sm leading-6 mt-4">
          {{ page.description }}
        </p>
      </NuxtLink>
    </div>

    <p class="muted text-sm leading-6 mt-8 pt-6 border-t border-[var(--line)]">
      CoFoundry's contract builder creates editable templates and preserves negotiation context. It does not replace counsel or legal advice.
    </p>
  </div>
</template>
