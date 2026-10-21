<script setup lang="ts">
import { howItWorksSteps } from "~/shared/data/marketing"

usePageSeo(
  "How CoFoundry formation works",
  "See how CoFoundry moves founder relationships from profile signal to intro, trial sprint, proposal, and agreement.",
  {
    canonicalPath: "/how-it-works",
  },
)
</script>

<template>
  <div class="reading-shell page-section">
    <PageIntro
      title="From first intro to working agreement."
    />

    <div class="mt-10 gap-6 grid">
      <article v-for="step in howItWorksSteps" :key="step.id" class="panel p-6 gap-6 grid md:p-8 md:grid-cols-[200px_1fr]">
        <div>
          <p class="section-kicker">
            {{ step.eyebrow }}
          </p>
        </div>
        <div>
          <h2 class="text-2xl font-semibold">
            {{ step.title }}
          </h2>
          <p class="muted text-base leading-7 mt-4 max-w-3xl">
            {{ step.body }}
          </p>
        </div>
      </article>
    </div>
  </div>
</template>
