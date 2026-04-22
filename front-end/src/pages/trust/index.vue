<script setup lang="ts">
import { trustCenterPages } from "~/shared/data/public-content"

usePageSeo("Trust Center", "Learn how CoFoundry handles visibility, outreach limits, and misuse prevention.", {
  canonicalPath: "/trust",
})
</script>

<template>
  <div class="page-shell py-16 md:py-20">
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

    <div class="panel mt-10 p-6 md:p-8">
      <h2 class="text-2xl font-semibold">
        Across every trust page
      </h2>
      <div class="mt-6 gap-4 grid md:grid-cols-3">
        <div class="panel-inset p-4">
          <p class="font-semibold">
            Mutual-intent contact
          </p>
          <p class="muted text-sm leading-6 mt-2">
            Search visibility does not equal direct access. Contact still follows the member's reveal rule and product trust gates.
          </p>
        </div>
        <div class="panel-inset p-4">
          <p class="font-semibold">
            Reviewable moderation
          </p>
          <p class="muted text-sm leading-6 mt-2">
            Reports and account actions stay attached to the case so restrictions can be reviewed later.
          </p>
        </div>
        <div class="panel-inset p-4">
          <p class="font-semibold">
            Focused use
          </p>
          <p class="muted text-sm leading-6 mt-2">
            The network is for founders and early collaborators, not recruiting spam or off-platform lead harvesting.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
