<script setup lang="ts">
import type { SubscriptionPlan } from "~/shared/types/domain"
import { faqs, pricingTiers } from "~/shared/data/marketing"
import { getPlanLimits } from "~/shared/utils/billing"

const { getPricingTierCta } = useProductAccess()

const pricingFaqQuestions = [
  "Do I have to pay to message someone I already matched with?",
  "Does each agreement participant need a paid plan?",
  "Why do you limit outreach on the free tier?",
  "How easy is it to cancel a paid plan?",
]
const pricingFaqs = faqs.filter(faq => pricingFaqQuestions.includes(faq.question))

function formatMonthlyLimit(limit: number | null) {
  return limit === null ? "Unlimited" : `${limit} / mo`
}

function planComparison(plan: SubscriptionPlan) {
  const limits = getPlanLimits(plan)

  return [
    { label: "New intros", value: formatMonthlyLimit(limits.introLimit) },
    { label: "Proposal sends", value: formatMonthlyLimit(limits.proposalSendLimit) },
    { label: "Agreement drafts", value: formatMonthlyLimit(limits.contractDraftLimit) },
    { label: "Signature-ready agreements", value: limits.canSignContracts ? "Included" : "Not included" },
  ]
}

function splitPrice(label: string) {
  const [amount, period] = label.split("/")
  return { amount, period: period ? `/${period}` : "" }
}

usePageSeo(
  "Pricing for startup team formation",
  "Compare CoFoundry plans for founder discovery, structured outreach, proposal workflows, and agreement preparation.",
  {
    canonicalPath: "/pricing",
  },
)
</script>

<template>
  <div class="page-shell page-section">
    <PageIntro
      eyebrow="Pricing"
      title="Simple plans. No automatic equity."
      description="Start free with a focused search. Upgrade when you need more outreach and the full proposal and agreement tools. Messaging after a mutual match is free on every plan."
    />

    <div class="mt-12 gap-6 grid items-start lg:grid-cols-3">
      <article
        v-for="tier in pricingTiers"
        :key="tier.id"
        class="panel p-7 flex flex-col h-full"
        :class="tier.highlighted ? 'price-card-featured' : ''"
      >
        <div class="flex gap-3 items-center justify-between">
          <h2 class="text-xl font-semibold">
            {{ tier.name }}
          </h2>
          <BaseBadge v-if="tier.highlighted" tone="accent">
            Most popular
          </BaseBadge>
        </div>
        <p class="mt-5 flex gap-1 items-baseline">
          <span class="price-figure">{{ splitPrice(tier.priceLabel).amount }}</span>
          <span v-if="splitPrice(tier.priceLabel).period" class="muted text-base">{{ splitPrice(tier.priceLabel).period }}</span>
        </p>
        <p class="muted leading-7 mt-4 lg:min-h-[5.25rem]">
          {{ tier.description }}
        </p>

        <dl class="text-[0.9375rem] mt-6 grid">
          <div v-for="row in planComparison(tier.id)" :key="row.label" class="py-2.5 border-t border-[var(--line)] flex gap-4 justify-between">
            <dt class="muted">
              {{ row.label }}
            </dt>
            <dd class="font-semibold m-0 text-right tabular-nums">
              {{ row.value }}
            </dd>
          </div>
        </dl>

        <div class="mt-6">
          <BaseButton :to="getPricingTierCta(tier.id, `pricing-${tier.id}`).to" block :variant="tier.highlighted ? 'primary' : 'secondary'">
            {{ getPricingTierCta(tier.id, `pricing-${tier.id}`).label }}
          </BaseButton>
        </div>

        <p class="text-sm font-semibold mt-7 pt-6 border-t border-[var(--line)]">
          Everything in this plan
        </p>
        <ul class="text-[0.9375rem] leading-6 mt-4 gap-3.5 grid">
          <li v-for="feature in tier.features" :key="feature" class="flex gap-2.5">
            <span class="i-carbon-checkmark text-[var(--accent)] mt-1 shrink-0" aria-hidden="true" />
            <span>{{ feature }}</span>
          </li>
        </ul>
      </article>
    </div>

    <p class="muted text-sm mt-6">
      Cancel any time in-product, with your renewal date shown clearly.
    </p>

    <section class="mt-20 gap-10 grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]" aria-labelledby="pricing-questions">
      <div class="section-header self-start">
        <h2 id="pricing-questions">
          Billing questions
        </h2>
        <p>
          Anything else? <NuxtLink to="/contact" class="text-[var(--accent)] underline underline-offset-4">
            Contact us
          </NuxtLink> or read the <NuxtLink to="/faq" class="text-[var(--accent)] underline underline-offset-4">
            full FAQ
          </NuxtLink>.
        </p>
      </div>
      <div class="border-t border-[var(--line)]">
        <details v-for="faq in pricingFaqs" :key="faq.question" class="group py-2 border-b border-[var(--line)]">
          <summary class="disclosure-summary text-lg font-semibold px-1 list-none flex gap-4 cursor-pointer items-center justify-between">
            {{ faq.question }}
            <span class="i-carbon-add text-xl shrink-0 transition group-open:rotate-45" aria-hidden="true" />
          </summary>
          <p class="muted measure leading-7 px-1 pb-4">
            {{ faq.answer }}
          </p>
        </details>
      </div>
    </section>
  </div>
</template>
