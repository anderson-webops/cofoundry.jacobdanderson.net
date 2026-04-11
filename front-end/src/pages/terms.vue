<script setup lang="ts">
import { termsKeyNotes, termsLastUpdated, termsSections } from "~/shared/data/legal"

const runtimeConfig = useRuntimeConfig()
const supportEmail = computed(() => runtimeConfig.public.supportEmail)

usePageSeo("Terms of Service", "Product-specific terms for CoFoundry's founder matching, messaging, proposal, contract, billing, and trust workflows.", {
  canonicalPath: "/terms",
})
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Legal"
      title="Terms of Service"
      description="These terms are written for CoFoundry's actual product surface: founder matching, structured intros, messaging, proposal workflow, agreement templates, paid subscriptions, moderation, and the future gated investment module."
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

    <div class="panel mt-10 p-6 md:p-8">
      <div class="flex flex-wrap gap-4 items-start justify-between">
        <div>
          <p class="text-sm font-semibold">
            Last updated
          </p>
          <p class="muted text-sm leading-6 mt-2">
            {{ termsLastUpdated }}
          </p>
        </div>
        <div class="max-w-xl">
          <p class="text-sm font-semibold">
            Drafting note
          </p>
          <p class="muted text-sm leading-6 mt-2">
            This version is product-specific, but CoFoundry should still finalize contracting-entity details, billing flow compliance, and jurisdiction-specific language with counsel before a broad public launch.
          </p>
        </div>
      </div>

      <div class="mt-6 gap-4 grid md:grid-cols-2 xl:grid-cols-4">
        <div v-for="item in termsKeyNotes" :key="item.title" class="panel-inset p-4">
          <p class="text-sm font-semibold">
            {{ item.title }}
          </p>
          <p class="muted text-sm leading-6 mt-3">
            {{ item.body }}
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
            v-for="section in termsSections"
            :key="section.id"
            :href="`#${section.id}`"
            class="muted text-sm leading-6 transition hover:text-[var(--copy)]"
          >
            {{ section.title }}
          </a>
        </nav>

        <div class="panel-inset mt-6 p-4">
          <p class="text-sm font-semibold">
            Notices and support
          </p>
          <p class="muted text-sm leading-6 mt-3">
            For support, trust and safety appeals, or intellectual property complaints, contact
            <a :href="`mailto:${supportEmail}`" class="text-[var(--copy)] underline underline-offset-4">{{ supportEmail }}</a>.
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

      <div class="gap-6 grid">
        <section
          v-for="section in termsSections"
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
          <h2 class="text-2xl font-semibold">
            Related Policies
          </h2>
          <div class="mt-6 gap-4 grid md:grid-cols-3">
            <NuxtLink to="/privacy" class="panel-inset p-4 transition hover:border-[var(--accent)]">
              <p class="font-semibold">
                Privacy Policy
              </p>
              <p class="muted text-sm leading-6 mt-2">
                Explains what CoFoundry collects, how profile visibility works, and how trust, billing, and moderation data are handled.
              </p>
            </NuxtLink>
            <NuxtLink to="/safety" class="panel-inset p-4 transition hover:border-[var(--accent)]">
              <p class="font-semibold">
                Trust & Safety
              </p>
              <p class="muted text-sm leading-6 mt-2">
                Describes the product-level controls behind moderation, verification, contact gating, and acceptable behavior.
              </p>
            </NuxtLink>
            <NuxtLink to="/contracts" class="panel-inset p-4 transition hover:border-[var(--accent)]">
              <p class="font-semibold">
                Contract Resources
              </p>
              <p class="muted text-sm leading-6 mt-2">
                Explains what CoFoundry's agreement workflow is for and why generated documents still require legal review.
              </p>
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
