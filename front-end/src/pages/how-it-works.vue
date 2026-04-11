<script setup lang="ts">
import { howItWorksSteps } from "~/shared/data/marketing"

usePageSeo("How it works")
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Process"
      title="Built for startup team formation, not loose networking."
      description="The product experience is deliberately structured around the failure points the research surfaced most often: low intent, poor trust signals, weak first calls, and vague post-match commitments."
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

    <div class="panel mt-10 p-6 md:p-8">
      <h2 class="text-2xl font-semibold">
        Why the workflow is this opinionated
      </h2>
      <div class="mt-6 gap-4 grid md:grid-cols-3">
        <div class="panel-inset p-4">
          <p class="text-sm font-semibold">
            Reduce search costs
          </p>
          <p class="muted text-sm leading-6 mt-2">
            Intent and proof-of-work let serious users rule people in or out faster.
          </p>
        </div>
        <div class="panel-inset p-4">
          <p class="text-sm font-semibold">
            Catch misalignment early
          </p>
          <p class="muted text-sm leading-6 mt-2">
            First-call prompts and trial sprints expose pace, communication, and decision-rights issues before they become equity fights.
          </p>
        </div>
        <div class="panel-inset p-4">
          <p class="text-sm font-semibold">
            Monetize workflow value
          </p>
          <p class="muted text-sm leading-6 mt-2">
            CoFoundry is strongest when it owns the path from match to signed agreement, not when it behaves like another noisy directory.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
