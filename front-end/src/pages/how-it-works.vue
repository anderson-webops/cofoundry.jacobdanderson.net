<script setup lang="ts">
import { howItWorksSteps } from "~/shared/data/marketing"

usePageSeo("How it works")
</script>

<template>
  <div class="reading-shell page-section">
    <PageIntro
      eyebrow="Process"
      title="From first intro to working agreement."
      description="CoFoundry keeps the early steps clear: profile, fit, first call, trial sprint, proposal, and agreement."
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

    <p class="muted text-sm leading-6 mt-8 max-w-3xl">
      The order is deliberate: scan fit, test working cadence, then write terms once the relationship has signal.
    </p>
  </div>
</template>
