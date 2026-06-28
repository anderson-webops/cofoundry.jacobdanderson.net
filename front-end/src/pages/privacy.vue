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

usePageSeo("Privacy Policy", "Product-specific privacy disclosures for CoFoundry's founder matching, profile visibility, messaging, proposals, contracts, and billing.", {
  canonicalPath: "/privacy",
})
</script>

<template>
  <div class="reading-shell page-section">
    <PageIntro
      eyebrow="Legal"
      title="Privacy Policy"
      description="How CoFoundry handles profile, messaging, billing, and safety data."
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

    <div class="process-list mt-10">
      <div class="process-list-item">
        <p class="text-sm font-semibold">
          Last updated
        </p>
        <p class="muted text-sm leading-6">
          {{ privacyLastUpdated }}
        </p>
      </div>

      <article v-for="item in privacyKeyNotes" :key="item.title" class="process-list-item">
        <div>
          <p class="text-sm font-semibold">
            {{ item.title }}
          </p>
        </div>
        <p class="muted text-sm leading-6">
          {{ item.body }}
        </p>
      </article>
    </div>

    <section class="mt-12">
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
          Public profile content can help discovery, but it also creates indexing and scraping risk if you choose public visibility.
        </p>
      </div>

      <div class="process-list mt-6">
        <article v-for="tier in privacyVisibilityTiers" :key="tier.title" class="process-list-item">
          <div class="flex flex-wrap gap-3 items-center justify-between">
            <h3 class="text-lg font-semibold">
              {{ tier.title }}
            </h3>
            <BaseBadge tone="neutral">
              {{ tier.audience }}
            </BaseBadge>
          </div>
          <div>
            <p class="muted text-sm leading-6">
              {{ tier.details }}
            </p>
            <p class="text-sm font-semibold mt-4">
              {{ tier.notes }}
            </p>
          </div>
        </article>
      </div>
    </section>

    <section class="mt-12">
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
          These categories cover account setup, discovery, collaboration, billing, and trust-and-safety operations.
        </p>
      </div>

      <div class="process-list mt-6">
        <article v-for="category in privacyDataCategories" :key="category.category" class="process-list-item">
          <h3 class="text-lg font-semibold">
            {{ category.category }}
          </h3>
          <div class="muted text-sm leading-6 gap-3 grid">
            <p><span class="text-[var(--text)] font-semibold">Examples:</span> {{ category.examples }}</p>
            <p><span class="text-[var(--text)] font-semibold">Why we use it:</span> {{ category.purposes }}</p>
            <p><span class="text-[var(--text)] font-semibold">Who can see it:</span> {{ category.visibility }}</p>
          </div>
        </article>
      </div>
    </section>

    <div class="reading-layout mt-10">
      <aside class="panel p-6 h-fit lg:top-24 lg:sticky">
        <h2 class="text-lg font-semibold">
          On this page
        </h2>
        <nav class="mt-5 gap-3 grid">
          <a
            v-for="section in privacySections"
            :key="section.id"
            :href="`#${section.id}`"
            class="legal-toc-link muted text-sm leading-6"
          >
            {{ section.title }}
          </a>
        </nav>

        <div class="surface-divider mt-6 pt-6">
          <p class="text-sm font-semibold">
            Privacy requests
          </p>
          <p class="muted text-sm leading-6 mt-3">
            For access, correction, deletion, visibility, or safety-related privacy requests, contact
            <a :href="`mailto:${supportEmail}`" class="text-[var(--text)] underline underline-offset-4">{{ supportEmail }}</a>.
          </p>
          <div class="mt-4 flex flex-wrap gap-3">
            <BaseButton variant="ghost" to="/contact">
              Contact page
            </BaseButton>
            <BaseButton variant="ghost" to="/auth/sign-in">
              Sign in for settings
            </BaseButton>
          </div>
        </div>
      </aside>

      <div class="reading-body">
        <section
          v-for="section in privacySections"
          :id="section.id"
          :key="section.id"
          class="surface-row scroll-mt-28"
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

        <section class="surface-row">
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

          <div class="process-list mt-6">
            <article v-for="row in privacyRetentionRows" :key="`${row.category}-detail`" class="process-list-item">
              <p class="font-semibold">
                {{ row.category }}
              </p>
              <div>
                <p class="text-sm font-semibold">
                  {{ row.window }}
                </p>
                <p class="muted text-sm leading-6 mt-3">
                  {{ row.notes }}
                </p>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
