<script setup lang="ts">
import {
  privacyDataCategories,
  privacyKeyNotes,
  privacyLastUpdated,
  privacyRetentionRows,
  privacySections,
  privacyVisibilityTiers,
} from "~/shared/data/legal"

const runtimeConfig = useRuntimeConfig()

const supportEmail = computed(() => runtimeConfig.public.supportEmail)
const backendModeLabel = computed(() => runtimeConfig.public.backendMode === "supabase"
  ? "Supabase-backed data mode"
  : "Mock / first-party demo data mode")
const billingModeLabel = computed(() => runtimeConfig.public.billingMode === "stripe"
  ? "Stripe-backed billing mode"
  : "Mock billing mode")

usePageSeo("Privacy Policy", "Product-specific privacy disclosures for CoFoundry's founder matching, profile visibility, messaging, proposal, contract, and billing workflows.", {
  canonicalPath: "/privacy",
})
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Legal"
      title="Privacy Policy"
      description="This policy is written for CoFoundry's actual data flows: public-lite profiles, member-only discovery, mutual-match messaging, proposal and contract workflows, subscriptions, moderation, and the future gated investment module."
    >
      <template #actions>
        <BaseButton variant="secondary" to="/terms">
          Terms of Service
        </BaseButton>
        <BaseButton variant="secondary" to="/safety">
          Trust & Safety
        </BaseButton>
      </template>
    </PageIntro>

    <div class="panel mt-10 p-6 md:p-8">
      <div class="flex flex-wrap gap-4 items-start justify-between">
        <div>
          <p class="text-sm font-semibold">
            Last updated
          </p>
          <p class="muted text-sm leading-6 mt-2">
            {{ privacyLastUpdated }}
          </p>
        </div>
        <div class="max-w-xl">
          <p class="text-sm font-semibold">
            Current deployment posture
          </p>
          <p class="muted text-sm leading-6 mt-2">
            CoFoundry is currently configured for {{ backendModeLabel }} and {{ billingModeLabel }}. If live providers or new tracking features are enabled later, CoFoundry will update this policy and any required notices before changing production behavior.
          </p>
        </div>
      </div>

      <div class="mt-6 gap-4 grid md:grid-cols-2 xl:grid-cols-4">
        <div v-for="item in privacyKeyNotes" :key="item.title" class="panel-inset p-4">
          <p class="text-sm font-semibold">
            {{ item.title }}
          </p>
          <p class="muted text-sm leading-6 mt-3">
            {{ item.body }}
          </p>
        </div>
      </div>
    </div>

    <div class="panel mt-10 p-6 md:p-8">
      <div class="flex flex-wrap gap-3 items-end justify-between">
        <div>
          <p class="text-sm font-semibold">
            Visibility at a glance
          </p>
          <h2 class="text-2xl font-semibold mt-2">
            What different audiences can see
          </h2>
        </div>
        <p class="muted text-sm leading-6 max-w-2xl">
          This is the main privacy risk surface for CoFoundry. Public profile content can help discovery, but it also creates indexing and scraping risk if you choose public visibility.
        </p>
      </div>

      <div class="mt-6 gap-4 grid lg:grid-cols-2">
        <div v-for="tier in privacyVisibilityTiers" :key="tier.title" class="panel-inset p-5">
          <div class="flex flex-wrap gap-3 items-center justify-between">
            <h3 class="text-lg font-semibold">
              {{ tier.title }}
            </h3>
            <BaseBadge tone="neutral">
              {{ tier.audience }}
            </BaseBadge>
          </div>
          <p class="muted text-sm leading-6 mt-4">
            {{ tier.details }}
          </p>
          <p class="text-sm font-semibold mt-4">
            {{ tier.notes }}
          </p>
        </div>
      </div>
    </div>

    <div class="panel mt-10 p-6 md:p-8">
      <div class="flex flex-wrap gap-3 items-end justify-between">
        <div>
          <p class="text-sm font-semibold">
            Data categories
          </p>
          <h2 class="text-2xl font-semibold mt-2">
            What CoFoundry processes
          </h2>
        </div>
        <p class="muted text-sm leading-6 max-w-2xl">
          The categories below reflect the actual founder-matching product surface: onboarding, discovery, relationship formation, billing, and trust-and-safety operations.
        </p>
      </div>

      <div class="mt-6 gap-4 grid lg:grid-cols-2">
        <div v-for="category in privacyDataCategories" :key="category.category" class="panel-inset p-5">
          <h3 class="text-lg font-semibold">
            {{ category.category }}
          </h3>
          <p class="muted text-sm leading-6 mt-4">
            <span class="text-[var(--copy)] font-semibold">Examples:</span> {{ category.examples }}
          </p>
          <p class="muted text-sm leading-6 mt-3">
            <span class="text-[var(--copy)] font-semibold">Why we use it:</span> {{ category.purposes }}
          </p>
          <p class="muted text-sm leading-6 mt-3">
            <span class="text-[var(--copy)] font-semibold">Who can see it:</span> {{ category.visibility }}
          </p>
        </div>
      </div>
    </div>

    <div class="mt-10 gap-6 grid lg:grid-cols-[0.85fr_2.15fr]">
      <aside class="panel p-6 h-fit lg:top-24 lg:sticky">
        <h2 class="text-lg font-semibold">
          On this page
        </h2>
        <nav class="mt-5 gap-3 grid">
          <a
            v-for="section in privacySections"
            :key="section.id"
            :href="`#${section.id}`"
            class="muted text-sm leading-6 transition hover:text-[var(--copy)]"
          >
            {{ section.title }}
          </a>
        </nav>

        <div class="panel-inset mt-6 p-4">
          <p class="text-sm font-semibold">
            Privacy requests
          </p>
          <p class="muted text-sm leading-6 mt-3">
            For access, correction, deletion, visibility, or safety-related privacy requests, contact
            <a :href="`mailto:${supportEmail}`" class="text-[var(--copy)] underline underline-offset-4">{{ supportEmail }}</a>.
          </p>
          <div class="mt-4 flex flex-wrap gap-3">
            <BaseButton variant="ghost" to="/contact">
              Contact page
            </BaseButton>
            <BaseButton variant="ghost" to="/app/settings">
              Settings
            </BaseButton>
          </div>
        </div>

        <div class="panel-inset mt-4 p-4">
          <p class="text-sm font-semibold">
            Retention snapshot
          </p>
          <div class="mt-3 gap-3 grid">
            <div v-for="row in privacyRetentionRows" :key="row.category" class="p-3 border border-[var(--line)] rounded-2xl">
              <p class="text-sm font-semibold">
                {{ row.category }}
              </p>
              <p class="muted text-sm leading-6 mt-2">
                {{ row.window }}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div class="gap-6 grid">
        <section
          v-for="section in privacySections"
          :id="section.id"
          :key="section.id"
          class="panel p-6 scroll-mt-28 md:p-8"
        >
          <h2 class="text-2xl font-semibold">
            {{ section.title }}
          </h2>
          <p class="text-sm font-semibold mt-4">
            {{ section.summary }}
          </p>
          <div class="mt-5 gap-4 grid">
            <p
              v-for="paragraph in section.paragraphs"
              :key="paragraph"
              class="muted text-sm leading-7"
            >
              {{ paragraph }}
            </p>
          </div>
          <ul v-if="section.bullets?.length" class="text-sm leading-7 mt-5 gap-3 grid">
            <li
              v-for="bullet in section.bullets"
              :key="bullet"
              class="flex gap-3 items-start"
            >
              <span class="i-carbon-checkmark-filled text-[var(--accent)] mt-1 shrink-0" />
              <span class="muted">{{ bullet }}</span>
            </li>
          </ul>
        </section>

        <div class="panel p-6 md:p-8">
          <div class="flex flex-wrap gap-3 items-end justify-between">
            <div>
              <p class="text-sm font-semibold">
                Retention detail
              </p>
              <h2 class="text-2xl font-semibold mt-2">
                How long data generally stays around
              </h2>
            </div>
            <p class="muted text-sm leading-6 max-w-2xl">
              These windows are current operating targets, not absolute deletion guarantees. Investigations, tax rules, chargebacks, and legal holds can require longer retention.
            </p>
          </div>

          <div class="mt-6 gap-4 grid md:grid-cols-2 xl:grid-cols-3">
            <div v-for="row in privacyRetentionRows" :key="`${row.category}-detail`" class="panel-inset p-4">
              <p class="font-semibold">
                {{ row.category }}
              </p>
              <p class="text-sm font-semibold mt-3">
                {{ row.window }}
              </p>
              <p class="muted text-sm leading-6 mt-3">
                {{ row.notes }}
              </p>
            </div>
          </div>
        </div>

        <div class="panel p-6 md:p-8">
          <h2 class="text-2xl font-semibold">
            Related Policies
          </h2>
          <div class="mt-6 gap-4 grid md:grid-cols-3">
            <NuxtLink to="/terms" class="panel-inset p-4 transition hover:border-[var(--accent)]">
              <p class="font-semibold">
                Terms of Service
              </p>
              <p class="muted text-sm leading-6 mt-2">
                Defines the legal rules for accounts, content, paid plans, proposals, contract templates, and dispute handling.
              </p>
            </NuxtLink>
            <NuxtLink to="/safety" class="panel-inset p-4 transition hover:border-[var(--accent)]">
              <p class="font-semibold">
                Trust & Safety
              </p>
              <p class="muted text-sm leading-6 mt-2">
                Explains CoFoundry's anti-scam controls, reporting workflow, moderation approach, and contact-gating design.
              </p>
            </NuxtLink>
            <NuxtLink to="/contracts" class="panel-inset p-4 transition hover:border-[var(--accent)]">
              <p class="font-semibold">
                Contract Resources
              </p>
              <p class="muted text-sm leading-6 mt-2">
                Explains how CoFoundry's proposal and agreement workflow works and why generated documents still require legal review.
              </p>
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
