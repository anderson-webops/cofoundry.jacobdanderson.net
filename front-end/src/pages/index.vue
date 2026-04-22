<script setup lang="ts">
import { appDescription, appTagline } from "~/shared/constants/app"
import { howItWorksSteps, pricingTiers } from "~/shared/data/marketing"
import { contractGuidePages, trustCenterPages } from "~/shared/data/public-content"
import { workspaceSeed } from "~/shared/data/seed"
import { getIndustryHubs, getRoleHubs, getStageHubs } from "~/shared/utils/directory"

const roleHubs = getRoleHubs(workspaceSeed)
const industryHubs = getIndustryHubs(workspaceSeed)
const stageHubs = getStageHubs(workspaceSeed)
const { getPrimaryAccessCta } = useProductAccess()
const heroAccessCta = computed(() => getPrimaryAccessCta("home-hero"))
const footerAccessCta = computed(() => getPrimaryAccessCta("home-footer"))

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
                Version history
              </BaseBadge>
            </div>
            <div class="hero-preview-frame grid-soft">
              <div class="hero-preview-card">
                <div class="flex gap-4 items-center justify-between">
                  <div>
                    <p class="text-sm font-semibold">
                      First call → trial sprint
                    </p>
                    <p class="muted text-sm mt-1">
                      LedgerLoop → Malik Thompson
                    </p>
                  </div>
                  <BaseBadge tone="accent">
                    Active trial
                  </BaseBadge>
                </div>
                <div class="muted text-sm mt-4 gap-3 grid">
                  <div>Goal: pressure-test architecture ownership and customer cadence</div>
                  <div>Weekly commitment: 10 hours for 2 weeks</div>
                  <div>Outputs: one product prototype, one written decision log, one retro</div>
                </div>
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
          title="From first signal to written terms."
          description="Profiles, intros, trial sprints, proposals, and agreements follow one clear sequence."
        />
        <div class="mt-10 gap-5 grid lg:grid-cols-4">
          <article v-for="step in howItWorksSteps" :key="step.id" class="panel p-6">
            <p class="section-kicker">
              {{ step.eyebrow }}
            </p>
            <h2 class="text-xl font-semibold mt-4">
              {{ step.title }}
            </h2>
            <p class="muted text-sm leading-7 mt-4">
              {{ step.body }}
            </p>
          </article>
        </div>
      </div>
    </section>

    <section class="page-section-tight">
      <div class="page-shell">
        <PageIntro
          eyebrow="Search entry points"
          title="Browse by role, industry, and stage."
          description="Public pages help people evaluate the network before they request access or create a profile."
        >
          <template #actions>
            <BaseButton variant="secondary" to="/find-cofounder">
              Browse public directory
            </BaseButton>
          </template>
        </PageIntro>

        <div class="mt-10 gap-5 grid lg:grid-cols-3">
          <article class="panel p-6">
            <p class="section-kicker">
              Roles
            </p>
            <div class="mt-4 gap-3 grid">
              <NuxtLink v-for="hub in roleHubs.slice(0, 4)" :key="hub.slug" :to="`/roles/${hub.slug}`" class="panel-inset p-4">
                <p class="font-semibold">
                  {{ hub.label }}
                </p>
                <p class="muted text-sm mt-2">
                  {{ hub.profileCount }} profiles · {{ hub.opportunityCount }} searches
                </p>
              </NuxtLink>
            </div>
          </article>
          <article class="panel p-6">
            <p class="section-kicker">
              Industries
            </p>
            <div class="mt-4 gap-3 grid">
              <NuxtLink v-for="hub in industryHubs.slice(0, 4)" :key="hub.slug" :to="`/industries/${hub.slug}`" class="panel-inset p-4">
                <p class="font-semibold">
                  {{ hub.label }}
                </p>
                <p class="muted text-sm mt-2">
                  {{ hub.profileCount }} profiles · {{ hub.opportunityCount }} searches
                </p>
              </NuxtLink>
            </div>
          </article>
          <article class="panel p-6">
            <p class="section-kicker">
              Stages
            </p>
            <div class="mt-4 gap-3 grid">
              <NuxtLink v-for="hub in stageHubs.slice(0, 4)" :key="hub.slug" :to="`/stage/${hub.slug}`" class="panel-inset p-4">
                <p class="font-semibold">
                  {{ hub.label }}
                </p>
                <p class="muted text-sm mt-2">
                  {{ hub.profileCount }} profiles · {{ hub.opportunityCount }} searches
                </p>
              </NuxtLink>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="page-section-tight">
      <div class="page-shell gap-8 grid lg:grid-cols-2">
        <div class="panel p-6 md:p-8">
          <p class="section-kicker">
            Trust Center
          </p>
          <h2 class="text-3xl tracking-tight font-semibold mt-3">
            Understand how privacy, outreach, and moderation work.
          </h2>
          <div class="mt-6 gap-4 grid">
            <NuxtLink
              v-for="page in trustCenterPages"
              :key="page.slug"
              :to="`/trust/${page.slug}`"
              class="panel-inset p-4"
            >
              <p class="font-semibold">
                {{ page.title }}
              </p>
              <p class="muted text-sm leading-6 mt-2">
                {{ page.description }}
              </p>
            </NuxtLink>
          </div>
        </div>

        <div class="panel p-6 md:p-8">
          <p class="section-kicker">
            Contract resources
          </p>
          <h2 class="text-3xl tracking-tight font-semibold mt-3">
            Learn the founder terms before you need them.
          </h2>
          <div class="mt-6 gap-4 grid">
            <NuxtLink
              v-for="page in contractGuidePages"
              :key="page.slug"
              :to="`/contracts/${page.slug}`"
              class="panel-inset p-4"
            >
              <p class="font-semibold">
                {{ page.title }}
              </p>
              <p class="muted text-sm leading-6 mt-2">
                {{ page.description }}
              </p>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <section class="page-section-tight">
      <div class="page-shell panel p-6 overflow-hidden md:p-8">
        <PageIntro
          eyebrow="Pricing"
          title="Free to start. Paid for more reach and agreement tools."
          description="Start free, then pay for more outreach, proposals, and agreements."
        >
          <template #actions>
            <BaseButton to="/pricing">
              View pricing
            </BaseButton>
          </template>
        </PageIntro>

        <div class="mt-10 gap-5 grid lg:grid-cols-3">
          <article v-for="tier in pricingTiers" :key="tier.id" class="p-6 border rounded-[1.5rem]" :class="tier.highlighted ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line)] bg-[var(--panel-strong)]'">
            <div class="flex gap-3 items-start justify-between">
              <div>
                <h3 class="text-xl font-semibold">
                  {{ tier.name }}
                </h3>
                <p class="muted text-sm leading-6 mt-2">
                  {{ tier.description }}
                </p>
              </div>
              <BaseBadge :tone="tier.highlighted ? 'accent' : 'neutral'">
                {{ tier.priceLabel }}
              </BaseBadge>
            </div>
            <ul class="text-sm leading-6 mt-6 gap-3 grid">
              <li v-for="feature in tier.features" :key="feature" class="flex gap-2 items-start">
                <span class="i-carbon-checkmark-outline text-[var(--accent)] mt-1" />
                <span>{{ feature }}</span>
              </li>
            </ul>
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
