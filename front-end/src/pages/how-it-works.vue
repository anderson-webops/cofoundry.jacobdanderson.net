<script setup lang="ts">
import { howItWorksSteps } from "~/shared/data/marketing"

usePageSeo("How it works")
</script>

<template>
  <div class="page-shell py-16 md:py-20">
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

    <div class="panel mt-10 p-6 md:p-8">
      <h2 class="text-2xl font-semibold">
        Why it follows this order
      </h2>
      <div class="mt-6 gap-4 grid md:grid-cols-3">
        <div class="panel-inset p-4">
          <p class="text-sm font-semibold">
            See fit sooner
          </p>
          <p class="muted text-sm leading-6 mt-2">
            Clear profiles and proof help you decide whether a conversation is worth having.
          </p>
        </div>
        <div class="panel-inset p-4">
          <p class="text-sm font-semibold">
            Test before you commit
          </p>
          <p class="muted text-sm leading-6 mt-2">
            First-call prompts and trial sprints expose pace, communication, and decision issues before they become harder to unwind.
          </p>
        </div>
        <div class="panel-inset p-4">
          <p class="text-sm font-semibold">
            Keep the terms in one place
          </p>
          <p class="muted text-sm leading-6 mt-2">
            Proposal versions, comments, and agreement drafts stay attached to the same relationship.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
