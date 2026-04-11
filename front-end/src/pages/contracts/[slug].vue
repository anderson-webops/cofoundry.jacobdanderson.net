<script setup lang="ts">
import { contractGuidePages } from "~/shared/data/public-content"

const route = useRoute()
const slug = String(route.params.slug)
const page = contractGuidePages.find(entry => entry.slug === slug)

if (!page)
  throw createError({ statusCode: 404, statusMessage: "Contract guide not found" })

usePageSeo(page.title, page.description, {
  canonicalPath: `/contracts/${page.slug}`,
})
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      :eyebrow="page.eyebrow"
      :title="page.title"
      :description="page.description"
    >
      <template #actions>
        <BaseButton variant="secondary" to="/contracts">
          Contract resources
        </BaseButton>
        <BaseButton :to="page.ctaTo">
          {{ page.ctaLabel }}
        </BaseButton>
      </template>
    </PageIntro>

    <div class="mt-10 gap-6 grid">
      <article v-for="section in page.sections" :key="section.title" class="panel p-6 md:p-8">
        <h2 class="text-2xl font-semibold">
          {{ section.title }}
        </h2>
        <p class="muted text-base leading-7 mt-4 max-w-3xl">
          {{ section.body }}
        </p>
        <ul v-if="section.bullets?.length" class="muted text-sm leading-7 mt-6 gap-3 grid">
          <li v-for="bullet in section.bullets" :key="bullet" class="flex gap-3">
            <span class="i-carbon-checkmark-filled text-[var(--accent)] mt-1" />
            <span>{{ bullet }}</span>
          </li>
        </ul>
      </article>
    </div>

    <div class="panel mt-10 p-6 md:p-8">
      <h2 class="text-2xl font-semibold">
        Legal disclaimer
      </h2>
      <p class="muted text-base leading-7 mt-4 max-w-3xl">
        CoFoundry provides structured drafting support and editable templates. It does not provide legal advice. Final founder documents should be reviewed by qualified counsel for the relevant jurisdiction.
      </p>
    </div>
  </div>
</template>
