<script setup lang="ts">
import { pricingTiers } from "~/shared/data/marketing"

const { getPricingTierCta } = useProductAccess()

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
      title="Pricing"
      description="CoFoundry does not take automatic equity."
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
  </div>
</template>
