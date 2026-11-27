<script setup lang="ts">
import PageIntro from "~/components/ui/PageIntro.vue"
import { useCanonicalAppUrl } from "~/composables/useCanonicalAppUrl"
import { usePageSeo } from "~/composables/usePageSeo"
import { faqs } from "~/shared/data/marketing"
import { buildFaqStructuredData } from "~/shared/utils/seo"

const canonicalAppUrl = useCanonicalAppUrl()
usePageSeo(
  "Founder questions about CoFoundry",
  "Direct answers about CoFoundry accounts, founder matching, public profiles, proposals, agreements, and billing.",
  {
    canonicalPath: "/faq",
    structuredData: buildFaqStructuredData(faqs, canonicalAppUrl),
  },
)
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      title="Frequently asked questions"
    />

    <div class="mt-10 gap-4 grid">
      <details v-for="faq in faqs" :key="faq.question" class="panel group p-6">
        <summary class="disclosure-summary text-lg font-semibold list-none cursor-pointer">
          {{ faq.question }}
        </summary>
        <p class="muted text-sm leading-7 mt-4 max-w-3xl">
          {{ faq.answer }}
        </p>
      </details>
    </div>
  </div>
</template>
