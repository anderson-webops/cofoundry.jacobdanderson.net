<script setup lang="ts">
import { appDescription, appTagline } from "~/shared/constants/app"
import { howItWorksSteps } from "~/shared/data/marketing"

const { getPrimaryAccessCta } = useProductAccess()
const heroAccessCta = computed(() => getPrimaryAccessCta("home-hero"))
const footerAccessCta = computed(() => getPrimaryAccessCta("home-footer"))
const homepageSteps = howItWorksSteps.slice(0, 3)

usePageSeo("Build startup teams with more structure", appDescription, {
  canonicalPath: "/",
})
</script>

<template>
  <div>
    <section class="page-section relative overflow-hidden">
      <div class="page-shell gap-12 grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div class="fade-up">
          <p class="section-kicker">
            Founder matching for startup teams
          </p>
          <h1 class="text-5xl tracking-tight font-semibold mt-4 max-w-3xl md:text-7xl">
            {{ appTagline }}
          </h1>
          <p class="muted text-lg leading-8 mt-6 max-w-2xl">
            Meet founders and early collaborators who want to build a company together. Compare fit, commitment, and working style early, then move from first call to trial sprint, proposal, and agreement in one place.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <BaseButton size="lg" :to="heroAccessCta.to">
              {{ heroAccessCta.label }}
            </BaseButton>
            <BaseButton size="lg" variant="secondary" to="/how-it-works">
              See how it works
            </BaseButton>
          </div>
        </div>

        <div class="panel p-6 relative overflow-hidden md:p-8">
          <div class="hero-spotlight" />
          <div class="surface-stack-lg">
            <div class="flex gap-4 items-center justify-between">
              <div>
                <p class="text-sm font-semibold">
                  From intro to agreement
                </p>
                <p class="muted text-sm mt-1">
                  Built for real company conversations
                </p>
              </div>
              <BaseBadge tone="accent">
                Trial first
              </BaseBadge>
            </div>
            <div class="hero-preview-frame grid-soft">
              <div class="surface-row">
                <div class="flex flex-wrap gap-3 items-center justify-between">
                  <p class="text-sm font-semibold">
                    First call → trial sprint
                  </p>
                  <BaseBadge tone="accent">
                    Active trial
                  </BaseBadge>
                </div>
                <p class="muted text-sm mt-2">
                  LedgerLoop → Malik Thompson
                </p>
                <p class="muted text-sm leading-6 mt-4">
                  Pressure-test architecture ownership, customer cadence, and weekly commitment before proposal work starts.
                </p>
              </div>
              <div class="hero-preview-summary">
                <div>
                  <p class="text-sm font-semibold">
                    Proposal and agreement ready
                  </p>
                  <p class="muted text-sm mt-1">
                    Move into written terms only after the trial creates real conviction
                  </p>
                </div>
                <span class="i-carbon-document-signed text-2xl text-[var(--accent)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="page-section-tight">
      <div class="page-shell">
        <PageIntro
          eyebrow="How CoFoundry works"
          :heading-level="2"
          title="From first signal to written terms."
          description="Profiles, intros, trial sprints, proposals, and agreements follow one clear sequence."
        />
        <div class="process-list mt-10">
          <article v-for="step in homepageSteps" :key="step.id" class="process-list-item">
            <p class="section-kicker process-list-kicker">
              {{ step.eyebrow }}
            </p>
            <div>
              <h2 class="text-xl font-semibold">
                {{ step.title }}
              </h2>
              <p class="muted text-sm leading-7 mt-3">
                {{ step.body }}
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="page-section">
      <div class="page-shell marketing-cta-panel px-6 py-12 rounded-[2rem] md:px-10">
        <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div class="max-w-[38rem]">
            <p class="section-kicker marketing-cta-kicker">
              Start the search
            </p>
            <h2 class="text-3xl tracking-tight font-semibold mt-4 md:text-4xl">
              Find the right person, run a short trial, and put the terms in writing.
            </h2>
          </div>
          <div class="flex flex-wrap gap-3">
            <BaseButton size="lg" :to="footerAccessCta.to" class="marketing-cta-primary">
              {{ footerAccessCta.label }}
            </BaseButton>
            <BaseButton size="lg" variant="secondary" to="/contact" class="marketing-cta-secondary">
              Talk to us
            </BaseButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
