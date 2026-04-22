<script setup lang="ts">
import { pricingTiers } from "~/shared/data/marketing"

const { getPricingTierCta } = useProductAccess()

usePageSeo("Pricing")
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Pricing"
      title="Straightforward subscriptions for startup team formation."
      description="Start free. Pay when you need more outreach, more live searches, and proposal and agreement tools. CoFoundry does not take automatic equity."
    />

    <div class="mt-10 gap-6 grid lg:grid-cols-3">
      <article v-for="tier in pricingTiers" :key="tier.id" class="panel p-6">
        <div class="flex gap-4 items-start justify-between">
          <div>
            <h2 class="text-2xl font-semibold">
              {{ tier.name }}
            </h2>
            <p class="muted text-sm leading-6 mt-3">
              {{ tier.description }}
            </p>
          </div>
          <BaseBadge :tone="tier.highlighted ? 'accent' : 'neutral'">
            {{ tier.priceLabel }}
          </BaseBadge>
        </div>

        <ul class="text-sm leading-6 mt-8 gap-4 grid">
          <li v-for="feature in tier.features" :key="feature" class="flex gap-2">
            <span class="i-carbon-checkmark-filled text-[var(--accent)] mt-1" />
            <span>{{ feature }}</span>
          </li>
        </ul>

        <div class="mt-8">
          <BaseButton :to="getPricingTierCta(tier.id, `pricing-${tier.id}`).to" block :variant="tier.highlighted ? 'primary' : 'secondary'">
            {{ getPricingTierCta(tier.id, `pricing-${tier.id}`).label }}
          </BaseButton>
        </div>
      </article>
    </div>

    <div class="panel mt-10 p-6 md:p-8">
      <h2 class="text-2xl font-semibold">
        What paid plans add
      </h2>
      <div class="mt-6 gap-4 grid md:grid-cols-3">
        <div class="panel-inset p-4">
          <p class="text-sm font-semibold">
            More new intros
          </p>
          <p class="muted text-sm leading-6 mt-2">
            Reach more people each month without losing the structure that keeps outreach usable.
          </p>
        </div>
        <div class="panel-inset p-4">
          <p class="text-sm font-semibold">
            More live searches
          </p>
          <p class="muted text-sm leading-6 mt-2">
            Save more searches, keep more proposals moving, and manage several active conversations at once.
          </p>
        </div>
        <div class="panel-inset p-4">
          <p class="text-sm font-semibold">
            Proposal and agreement tools
          </p>
          <p class="muted text-sm leading-6 mt-2">
            Paid plans unlock the tools that turn a promising relationship into written terms.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
