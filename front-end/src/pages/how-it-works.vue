<script setup lang="ts">
import { howItWorksSteps } from "~/shared/data/marketing"

usePageSeo("How it works")
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Process"
      title="Built for founder matching, not task fulfillment."
      description="The product experience is deliberately structured around forming startup teams: signal, match, propose, and formalize."
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
