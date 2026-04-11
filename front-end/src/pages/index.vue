<script setup lang="ts">
import { appDescription, appTagline } from "~/shared/constants/app"
import { heroMetrics, howItWorksSteps, pricingTiers, researchPrinciples, testimonials } from "~/shared/data/marketing"
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
    <section class="py-16 relative overflow-hidden md:py-24">
      <div class="page-shell gap-12 grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div class="fade-up">
          <p class="section-kicker">
            Founder matching for serious builders
          </p>
          <h1 class="text-5xl tracking-tight font-semibold mt-4 max-w-3xl md:text-7xl">
            {{ appTagline }}
          </h1>
          <p class="muted text-lg leading-8 mt-6 max-w-2xl">
            CoFoundry is built for founder relationships, not freelance gigs. Find aligned partners, compare commitment and governance early, run a short working sprint, and only then turn the relationship into something explicit enough to sign.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <BaseButton size="lg" :to="heroAccessCta.to">
              {{ heroAccessCta.label }}
            </BaseButton>
            <BaseButton size="lg" variant="secondary" to="/how-it-works">
              See the workflow
            </BaseButton>
          </div>
          <div class="mt-10 gap-4 grid sm:grid-cols-3">
            <MetricTile v-for="metric in heroMetrics" :key="metric.label" :label="metric.label" :value="metric.value" :context="metric.context" />
          </div>
        </div>

        <div class="panel p-6 relative overflow-hidden md:p-8">
          <div class="hero-spotlight" />
          <div class="grid-soft p-6 border border-[var(--line)] rounded-[1.5rem] bg-[var(--panel-inset)] md:p-8">
            <div class="flex gap-4 items-center justify-between">
              <div>
                <p class="text-sm font-semibold">
                  Formation workflow
                </p>
                <p class="muted text-sm mt-1">
                  High-trust by design
                </p>
              </div>
              <BaseBadge tone="accent">
                Research-backed
              </BaseBadge>
            </div>
            <div class="mt-8 gap-4 grid">
              <div class="panel p-5">
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
                  <div>Outputs: one workflow prototype, one written decision log, one retro</div>
                </div>
              </div>
              <div class="panel-inset p-4 flex gap-4 items-center justify-between">
                <div>
                  <p class="text-sm font-semibold">
                    Proposal and agreement ready
                  </p>
                  <p class="muted text-sm mt-1">
                    Structured terms only appear after the sprint creates conviction
                  </p>
                </div>
                <span class="i-carbon-document-signed text-2xl text-[var(--accent)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="py-16">
      <div class="page-shell">
        <PageIntro
          eyebrow="How CoFoundry works"
          title="A calmer path from first signal to signed agreement."
          description="Each section of the product is designed to reduce ambiguity: clearer profiles, more intentional matching, and a structured way to negotiate the relationship."
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

    <section class="py-16">
      <div class="page-shell">
        <PageIntro
          eyebrow="Search entry points"
          title="A public layer built around real search intent."
          description="CoFoundry now exposes public role, industry, stage, profile, and startup-search pages so serious users can evaluate the market before they commit to joining it."
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

    <section class="py-16">
      <div class="page-shell">
        <PageIntro
          eyebrow="Research-backed product principles"
          title="The site now reflects what actually reduces failed founder matches."
          description="The best improvements were not more social features. They were tighter intent, faster trust assessment, and a better path from match to real working relationship."
        />
        <div class="mt-10 gap-5 grid lg:grid-cols-4">
          <article v-for="principle in researchPrinciples" :key="principle.title" class="panel p-6">
            <h2 class="text-xl font-semibold">
              {{ principle.title }}
            </h2>
            <p class="muted text-sm leading-7 mt-4">
              {{ principle.body }}
            </p>
          </article>
        </div>
      </div>
    </section>

    <section class="py-16">
      <div class="page-shell gap-8 grid lg:grid-cols-2">
        <div class="panel p-6 md:p-8">
          <p class="section-kicker">
            Trust Center
          </p>
          <h2 class="text-3xl tracking-tight font-semibold mt-3">
            Search visibility without a safety model is noise.
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
            The workflow differentiator now has public entry points.
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

    <section class="py-16">
      <div class="page-shell gap-8 grid lg:grid-cols-[0.75fr_1.25fr]">
        <div>
          <p class="section-kicker">
            Proof, not fluff
          </p>
          <h2 class="text-3xl tracking-tight font-semibold mt-3">
            Teams come here because the hard conversations happen early.
          </h2>
          <p class="muted text-base leading-7 mt-4">
            CoFoundry is not optimized for volume. It is optimized for founder fit, explicit expectations, and cleaner transitions into actual working relationships.
          </p>
        </div>
        <div class="gap-5 grid md:grid-cols-3">
          <article v-for="testimonial in testimonials" :key="testimonial.id" class="panel p-6">
            <p class="text-base leading-7">
              “{{ testimonial.quote }}”
            </p>
            <div class="mt-6">
              <p class="font-semibold">
                {{ testimonial.author }}
              </p>
              <p class="muted text-sm">
                {{ testimonial.role }} · {{ testimonial.company }}
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="py-16">
      <div class="page-shell panel p-6 overflow-hidden md:p-8">
        <PageIntro
          eyebrow="Pricing"
          title="Free to start. Paid when the workflow matters."
          description="The core monetization in V1 is subscription SaaS. CoFoundry charges for better workflow outcomes, not mandatory platform equity."
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

    <section class="py-16">
      <div class="page-shell marketing-cta-panel px-6 py-12 rounded-[2rem] md:px-10">
        <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div class="max-w-4xl">
            <p class="section-kicker marketing-cta-kicker">
              Ready to build with more structure
            </p>
            <h2 class="text-3xl tracking-tight font-semibold mt-4 md:text-4xl">
              Start matching, proposing, and documenting the relationship in one place.
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
