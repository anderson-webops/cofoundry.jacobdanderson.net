<script setup lang="ts">
import { trustCenterPages } from "~/shared/data/public-content"

const route = useRoute()
const slug = String(route.params.slug)
const page = trustCenterPages.find(entry => entry.slug === slug)
const { getGuidePageCta } = useProductAccess()

if (!page)
  throw createError({ statusCode: 404, statusMessage: "Trust page not found" })

usePageSeo(page.title, page.description, {
  canonicalPath: `/trust/${page.slug}`,
})

const pageCta = computed(() => getGuidePageCta(page.ctaLabel, page.ctaTo, `trust-${page.slug}`))
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      :eyebrow="page.eyebrow"
      :title="page.title"
      :description="page.description"
    >
      <template #actions>
        <BaseButton variant="secondary" to="/trust">
          Trust Center
        </BaseButton>
        <BaseButton :to="pageCta.to">
          {{ pageCta.label }}
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
  </div>
</template>
