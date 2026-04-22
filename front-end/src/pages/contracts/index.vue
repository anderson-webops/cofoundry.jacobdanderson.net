<script setup lang="ts">
import { contractGuidePages } from "~/shared/data/public-content"

usePageSeo("Founder agreement resources", "Learn how CoFoundry approaches proposals, founder agreements, vesting, and trial plans.", {
  canonicalPath: "/contracts",
})
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Contracts & Proposals"
      title="Guides for proposals, trials, vesting, and IP."
      description="These pages explain the founder decisions that usually show up before an agreement is signed."
    />

    <div class="mt-10 gap-5 grid lg:grid-cols-2">
      <NuxtLink
        v-for="page in contractGuidePages"
        :key="page.slug"
        :to="`/contracts/${page.slug}`"
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

    <div class="panel mt-10 p-6 md:p-8">
      <h2 class="text-2xl font-semibold">
        Important disclaimer
      </h2>
      <p class="muted text-base leading-7 mt-4 max-w-3xl">
        CoFoundry's contract builder creates editable templates and preserves negotiation context. It does not replace counsel or legal advice.
      </p>
    </div>
  </div>
</template>
