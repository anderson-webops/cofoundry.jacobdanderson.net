<script setup lang="ts">
import { computed } from "vue"
import { useRuntimeConfig } from "#app"
import BaseButton from "~/components/ui/BaseButton.vue"
import PageIntro from "~/components/ui/PageIntro.vue"
import { usePageSeo } from "~/composables/usePageSeo"
import { termsKeyNotes, termsLastUpdated, termsSections } from "~/shared/data/legal"

const runtimeConfig = useRuntimeConfig()
const supportEmail = computed(() => runtimeConfig.public.supportEmail)

usePageSeo("Terms of Service", "Product-specific terms for CoFoundry's founder matching, messaging, proposals, contracts, billing, and trust controls.", {
  canonicalPath: "/terms",
})
</script>

<template>
  <div class="reading-shell page-section">
    <PageIntro
      eyebrow="Legal"
      title="Terms of Service"
      description="Terms for using CoFoundry."
    >
      <template #actions>
        <BaseButton variant="secondary" to="/privacy">
          Privacy Policy
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
          {{ termsLastUpdated }}
        </p>
      </div>

      <article v-for="item in termsKeyNotes" :key="item.title" class="process-list-item">
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

    <div class="reading-layout mt-10">
      <aside class="panel p-6 h-fit lg:top-24 lg:sticky">
        <h2 class="text-lg font-semibold">
          On this page
        </h2>
        <nav class="mt-5 gap-3 grid">
          <a
            v-for="section in termsSections"
            :key="section.id"
            :href="`#${section.id}`"
            class="legal-toc-link muted text-sm leading-6"
          >
            {{ section.title }}
          </a>
        </nav>

        <div class="surface-divider mt-6 pt-6">
          <p class="text-sm font-semibold">
            Notices and support
          </p>
          <p class="muted text-sm leading-6 mt-3">
            For support, trust and safety appeals, or intellectual property complaints, contact
            <a :href="`mailto:${supportEmail}`" class="text-[var(--text)] underline underline-offset-4">{{ supportEmail }}</a>.
          </p>
          <div class="mt-4 flex flex-wrap gap-3">
            <BaseButton variant="ghost" to="/contact">
              Contact page
            </BaseButton>
            <BaseButton variant="ghost" to="/pricing">
              Pricing
            </BaseButton>
          </div>
        </div>
      </aside>

      <div class="reading-body">
        <section
          v-for="section in termsSections"
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
      </div>
    </div>
  </div>
</template>
