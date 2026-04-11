<script setup lang="ts">
import { pricingTiers } from "~/shared/data/marketing"

usePageSeo("Pricing")
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Pricing"
      title="Straightforward subscription pricing for startup team formation."
      description="V1 monetizes through SaaS subscriptions and a premium workflow. There is no mandatory platform equity in the core product."
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
          <BaseButton :to="tier.id === 'team' ? '/contact' : '/auth/sign-up'" block :variant="tier.highlighted ? 'primary' : 'secondary'">
            {{ tier.ctaLabel }}
          </BaseButton>
        </div>
      </article>
    </div>
  </div>
</template>
