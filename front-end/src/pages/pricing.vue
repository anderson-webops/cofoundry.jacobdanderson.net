<script setup lang="ts">
import { pricingTiers } from "~/shared/data/marketing"

usePageSeo("Pricing")
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Pricing"
      title="Straightforward subscription pricing for startup team formation."
      description="V1 monetizes through SaaS subscriptions and a premium workflow. There is no mandatory platform equity in the core product, and the paid plans are tied to outbound velocity, proposal volume, and agreement execution instead of basic directory access."
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

    <div class="panel mt-10 p-6 md:p-8">
      <h2 class="text-2xl font-semibold">
        What the paid plans are really buying
      </h2>
      <div class="mt-6 gap-4 grid md:grid-cols-3">
        <div class="panel-inset p-4">
          <p class="text-sm font-semibold">
            Higher search velocity
          </p>
          <p class="muted text-sm leading-6 mt-2">
            More outbound intros, more saved searches, and better ranking for people who have earned trust with proof-of-work and active participation.
          </p>
        </div>
        <div class="panel-inset p-4">
          <p class="text-sm font-semibold">
            Higher-intent workflow
          </p>
          <p class="muted text-sm leading-6 mt-2">
            Trial charters, clause-level proposal comments, version history, and signature-ready agreement flow reduce the cost of forming a team badly.
          </p>
        </div>
        <div class="panel-inset p-4">
          <p class="text-sm font-semibold">
            Lower billing friction
          </p>
          <p class="muted text-sm leading-6 mt-2">
            The value is not access for its own sake. It is clearer intent, visible renewal dates, and cancellation that happens in-product without a support maze.
          </p>
        </div>
      </div>
    </div>

    <div class="panel mt-10 p-6 md:p-8">
      <h2 class="text-2xl font-semibold">
        The metered units
      </h2>
      <div class="mt-6 gap-4 grid md:grid-cols-3">
        <div class="panel-inset p-4">
          <p class="text-sm font-semibold">
            New intros
          </p>
          <p class="muted text-sm leading-6 mt-2">
            CoFoundry meters new outbound introductions, not matched messaging. That keeps the marketplace useful without turning it into a cold-outreach channel.
          </p>
        </div>
        <div class="panel-inset p-4">
          <p class="text-sm font-semibold">
            Proposal sends
          </p>
          <p class="muted text-sm leading-6 mt-2">
            Structured deal rooms are visible on every plan, but higher-volume proposal sending is paid because that is where real negotiation begins.
          </p>
        </div>
        <div class="panel-inset p-4">
          <p class="text-sm font-semibold">
            Agreement drafts and signatures
          </p>
          <p class="muted text-sm leading-6 mt-2">
            Free can preview an agreement draft. Paid plans unlock signature-ready workflow and print-friendly export when the relationship is ready to formalize.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
