<script setup lang="ts">
import { howItWorksSteps } from "~/shared/data/marketing"

const { getPrimaryAccessCta } = useProductAccess()
const accessCta = computed(() => getPrimaryAccessCta("how-it-works"))

usePageSeo(
  "How CoFoundry formation works",
  "See how CoFoundry moves founder relationships from profile signal to intro, trial sprint, proposal, and agreement.",
  {
    canonicalPath: "/how-it-works",
  },
)
</script>

<template>
  <div class="page-shell page-section">
    <PageIntro
      eyebrow="How it works"
      title="From first intro to working agreement."
      description="Six steps take a founder relationship from a clear search to written terms. Each one answers a question you would otherwise discover too late."
    />

    <div class="mt-14 gap-12 grid lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
      <nav aria-label="Steps" class="hidden self-start lg:block lg:top-28 lg:sticky">
        <ol class="text-sm gap-1 grid">
          <li v-for="(step, index) in howItWorksSteps" :key="step.id">
            <a :href="`#${step.id}`" class="legal-toc-link muted gap-3 hover:text-[var(--text)]">
              <span class="font-semibold tabular-nums">{{ index + 1 }}</span>
              {{ step.name }}
            </a>
          </li>
        </ol>
      </nav>

      <ol class="flow-list">
        <li v-for="(step, index) in howItWorksSteps" :id="step.id" :key="step.id" class="flow-step">
          <span class="flow-index" aria-hidden="true">{{ index + 1 }}</span>
          <article class="pt-1.5">
            <p class="section-kicker flex gap-2 items-center">
              <span :class="step.icon" aria-hidden="true" />
              Step {{ index + 1 }} · {{ step.name }}
            </p>
            <h2 class="text-2xl leading-snug tracking-tight font-semibold mt-3 max-w-[34ch] md:text-[1.75rem]">
              {{ step.title }}
            </h2>
            <p class="muted measure text-[1.0625rem] leading-[1.75] mt-3">
              {{ step.body }}
            </p>
          </article>
        </li>
      </ol>
    </div>

    <div class="mt-16 p-6 border border-[var(--line)] rounded-[var(--radius-lg)] bg-[var(--bg-muted)] flex flex-col gap-5 md:p-8 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 class="text-xl font-semibold">
          Ready to start step one?
        </h2>
        <p class="muted mt-1">
          Set up your search, then browse people who match it.
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
        <BaseButton :to="accessCta.to">
          {{ accessCta.label }}
        </BaseButton>
        <BaseButton variant="secondary" to="/pricing">
          View pricing
        </BaseButton>
      </div>
    </div>
  </div>
</template>
