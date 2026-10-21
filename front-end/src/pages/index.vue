<script setup lang="ts">
import { appDescription, appTagline } from "~/shared/constants/app"
import { faqs, formationRisks, howItWorksSteps, pricingTiers, trustPillars } from "~/shared/data/marketing"

const { getPrimaryAccessCta, getPricingTierCta } = useProductAccess()
const heroAccessCta = computed(() => getPrimaryAccessCta("home-hero"))
const closingAccessCta = computed(() => getPrimaryAccessCta("home-closing"))

const homeFaqQuestions = [
  "Is CoFoundry a freelance marketplace?",
  "Does CoFoundry take equity in every relationship?",
  "Can I keep my profile private while browsing?",
  "Are the contracts legally binding?",
]
const homeFaqs = faqs.filter(faq => homeFaqQuestions.includes(faq.question))

const heroAssurances = [
  "Free to start",
  "No automatic equity",
  "Contact shared only on mutual opt-in",
]

usePageSeo("Build startup teams with more structure", appDescription, {
  canonicalPath: "/",
})
</script>

<template>
  <div>
    <section class="pb-16 pt-12 relative overflow-hidden md:pb-24 md:pt-20">
      <div class="page-shell gap-12 grid items-center lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div class="fade-up">
          <p class="section-kicker">
            Startup team formation
          </p>
          <h1 class="display-heading text-[clamp(2.75rem,1.6rem+4.6vw,5rem)] mt-4 max-w-[14ch]">
            {{ appTagline }}
          </h1>
          <p class="lede mt-6">
            Meet founders and early collaborators who match your role, stage, and commitment, then move from first call to a short trial and a written agreement in one place.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <BaseButton size="lg" :to="heroAccessCta.to">
              {{ heroAccessCta.label }}
              <span class="i-carbon-arrow-right" aria-hidden="true" />
            </BaseButton>
            <BaseButton size="lg" variant="secondary" to="/how-it-works">
              See how it works
            </BaseButton>
          </div>
          <ul class="muted text-sm mt-8 flex flex-wrap gap-x-6 gap-y-2">
            <li v-for="item in heroAssurances" :key="item" class="flex gap-2 items-center">
              <span class="i-carbon-checkmark-outline text-[var(--success)]" aria-hidden="true" />
              {{ item }}
            </li>
          </ul>
        </div>

        <figure class="panel fade-up m-0 p-6 md:p-7">
          <figcaption class="flex gap-3 items-center justify-between">
            <span class="font-semibold">The formation path</span>
            <BaseBadge tone="accent">
              6 steps
            </BaseBadge>
          </figcaption>
          <ol class="mt-6 gap-3 grid">
            <li
              v-for="(step, index) in howItWorksSteps"
              :key="step.id"
              class="step-card flex gap-3 items-center"
              :class="index === 3 ? 'step-card-active' : ''"
            >
              <span class="flow-index text-sm shrink-0 h-9 w-9">
                {{ index + 1 }}
              </span>
              <span class="font-medium">{{ step.name }}</span>
              <span :class="step.icon" class="muted text-lg ml-auto" aria-hidden="true" />
            </li>
          </ol>
        </figure>
      </div>
    </section>

    <section class="page-section section-alt">
      <div class="page-shell">
        <div class="section-header">
          <p class="section-kicker">
            Why structure matters
          </p>
          <h2>Most founder matches fail over questions nobody asked early.</h2>
          <p>Good energy on a first call is not the same as a good fit. CoFoundry puts the hard topics in front of both people before anyone commits.</p>
        </div>
        <div class="feature-grid feature-grid-3 mt-10">
          <article v-for="risk in formationRisks" :key="risk.title" class="feature-tile">
            <span class="feature-icon" aria-hidden="true">
              <span :class="risk.icon" />
            </span>
            <h3 class="text-xl font-semibold">
              {{ risk.title }}
            </h3>
            <p class="muted leading-7">
              {{ risk.body }}
            </p>
          </article>
        </div>
      </div>
    </section>

    <section class="page-section">
      <div class="page-shell gap-12 grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div class="section-header self-start lg:top-28 lg:sticky">
          <p class="section-kicker">
            How it works
          </p>
          <h2>From first intro to working agreement.</h2>
          <p>Every relationship follows the same six steps, so you always know what comes next and what still needs to be decided.</p>
          <div class="mt-2">
            <BaseButton variant="secondary" to="/how-it-works">
              Read the full walkthrough
            </BaseButton>
          </div>
        </div>
        <ol class="flow-list">
          <li v-for="(step, index) in howItWorksSteps" :key="step.id" class="flow-step">
            <span class="flow-index" aria-hidden="true">{{ index + 1 }}</span>
            <div class="pt-2">
              <h3 class="text-lg font-semibold">
                <span class="sr-only">Step {{ index + 1 }}: </span>{{ step.name }}
              </h3>
              <p class="muted measure leading-7 mt-1.5">
                {{ step.body }}
              </p>
            </div>
          </li>
        </ol>
      </div>
    </section>

    <section class="page-section section-alt">
      <div class="page-shell">
        <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div class="section-header">
            <p class="section-kicker">
              Trust and safety
            </p>
            <h2>Built so the right people reply, and the wrong ones cannot reach you.</h2>
          </div>
          <BaseButton variant="secondary" to="/trust" class="self-start md:self-auto">
            Visit the Trust Center
          </BaseButton>
        </div>
        <div class="feature-grid feature-grid-3 mt-10">
          <article v-for="pillar in trustPillars" :key="pillar.title" class="feature-tile">
            <span class="feature-icon" aria-hidden="true">
              <span :class="pillar.icon" />
            </span>
            <h3 class="text-lg font-semibold">
              {{ pillar.title }}
            </h3>
            <p class="muted leading-7">
              {{ pillar.body }}
            </p>
          </article>
        </div>
      </div>
    </section>

    <section class="page-section">
      <div class="page-shell">
        <div class="section-header">
          <p class="section-kicker">
            Pricing
          </p>
          <h2>Start free. Upgrade when your search gets serious.</h2>
          <p>Messaging after a mutual match is always free. Paid plans add outreach volume and the full proposal and agreement tools.</p>
        </div>
        <div class="mt-10 gap-5 grid md:grid-cols-3">
          <article
            v-for="tier in pricingTiers"
            :key="tier.id"
            class="feature-tile"
            :class="tier.highlighted ? 'price-card-featured' : ''"
          >
            <div class="flex gap-3 items-center justify-between">
              <h3 class="text-lg font-semibold">
                {{ tier.name }}
              </h3>
              <BaseBadge v-if="tier.highlighted" tone="accent">
                Most popular
              </BaseBadge>
            </div>
            <p class="text-3xl tracking-tight font-semibold">
              {{ tier.priceLabel }}
            </p>
            <p class="muted leading-7">
              {{ tier.description }}
            </p>
            <div class="mt-2">
              <BaseButton :to="getPricingTierCta(tier.id, `home-pricing-${tier.id}`).to" block :variant="tier.highlighted ? 'primary' : 'secondary'">
                {{ getPricingTierCta(tier.id, `home-pricing-${tier.id}`).label }}
              </BaseButton>
            </div>
          </article>
        </div>
        <p class="mt-6">
          <NuxtLink to="/pricing" class="public-action-link -ml-3">
            Compare every plan feature
            <span class="i-carbon-arrow-right ml-2" aria-hidden="true" />
          </NuxtLink>
        </p>
      </div>
    </section>

    <section class="page-section section-alt">
      <div class="page-shell gap-10 grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div class="section-header self-start">
          <p class="section-kicker">
            Questions
          </p>
          <h2>What founders ask first.</h2>
          <p>
            More answers are in the <NuxtLink to="/faq" class="text-[var(--accent)] underline underline-offset-4">
              full FAQ
            </NuxtLink>.
          </p>
        </div>
        <div class="border-t border-[var(--line)]">
          <details v-for="faq in homeFaqs" :key="faq.question" class="group py-2 border-b border-[var(--line)]">
            <summary class="disclosure-summary text-lg font-semibold px-1 list-none flex gap-4 cursor-pointer items-center justify-between">
              {{ faq.question }}
              <span class="i-carbon-add text-xl shrink-0 transition group-open:rotate-45" aria-hidden="true" />
            </summary>
            <p class="muted measure leading-7 px-1 pb-4">
              {{ faq.answer }}
            </p>
          </details>
        </div>
      </div>
    </section>

    <section class="page-section">
      <div class="page-shell">
        <div class="marketing-cta-panel p-8 rounded-[var(--radius-lg)] md:p-14">
          <p class="marketing-cta-kicker section-kicker">
            Ready when you are
          </p>
          <h2 class="display-heading text-[clamp(2rem,1.4rem+2.4vw,3.25rem)] mt-4 max-w-[20ch]">
            Find someone worth building with.
          </h2>
          <p class="text-lg leading-8 mt-4 opacity-85 max-w-[40rem]">
            Set up your profile and decide exactly who can see it and who can contact you.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <BaseButton size="lg" class="marketing-cta-primary" :to="closingAccessCta.to">
              {{ closingAccessCta.label }}
            </BaseButton>
            <BaseButton size="lg" variant="secondary" class="marketing-cta-secondary" to="/find-cofounder">
              Browse cofounders
            </BaseButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
