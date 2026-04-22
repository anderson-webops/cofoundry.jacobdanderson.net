<script setup lang="ts">
import { faqs } from "~/shared/data/marketing"

usePageSeo("FAQ", undefined, {
  canonicalPath: "/faq",
  structuredData: [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer,
        },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://cofoundry.jacobdanderson.net/",
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "FAQ",
          "item": "https://cofoundry.jacobdanderson.net/faq",
        },
      ],
    },
  ],
})
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="FAQ"
      title="Questions founders ask before they trust a matching platform."
      description="Direct answers about how CoFoundry works."
    />

    <div class="mt-10 gap-4 grid">
      <details v-for="faq in faqs" :key="faq.question" class="panel group p-6">
        <summary class="text-lg font-semibold list-none cursor-pointer">
          {{ faq.question }}
        </summary>
        <p class="muted text-sm leading-7 mt-4 max-w-3xl">
          {{ faq.answer }}
        </p>
      </details>
    </div>
  </div>
</template>
