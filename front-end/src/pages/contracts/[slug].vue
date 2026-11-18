<script setup lang="ts">
import { computed } from "vue"
import { createError, useRoute } from "#app"
import BaseButton from "~/components/ui/BaseButton.vue"
import PageIntro from "~/components/ui/PageIntro.vue"
import { usePageSeo } from "~/composables/usePageSeo"
import { useProductAccess } from "~/composables/useProductAccess"
import { contractGuidePages } from "~/shared/data/public-content"

const route = useRoute()
const slug = String(route.params.slug)
const page = contractGuidePages.find(entry => entry.slug === slug)
const { getGuidePageCta } = useProductAccess()

if (!page)
  throw createError({ statusCode: 404, statusMessage: "Contract guide not found" })

usePageSeo(page.title, page.description, {
  canonicalPath: `/contracts/${page.slug}`,
})

const pageCta = computed(() => getGuidePageCta(page.ctaLabel, page.ctaTo, `contracts-${page.slug}`))
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
        <BaseButton :to="pageCta.to">
          {{ pageCta.label }}
        </BaseButton>
      </template>
    </PageIntro>

    <div class="process-list mt-10">
      <article v-for="section in page.sections" :key="section.title" class="process-list-item">
        <p class="section-kicker process-list-kicker">
          {{ section.title }}
        </p>
        <div>
          <p class="text-base leading-7 max-w-3xl">
            {{ section.body }}
          </p>
          <ul v-if="section.bullets?.length" class="muted text-sm leading-7 mt-6 gap-3 grid">
            <li v-for="bullet in section.bullets" :key="bullet" class="flex gap-3">
              <span class="i-carbon-checkmark-filled text-[var(--accent)] mt-1" />
              <span>{{ bullet }}</span>
            </li>
          </ul>
        </div>
      </article>
    </div>

    <p class="muted text-sm leading-6 mt-8 pt-6 border-t border-[var(--line)]">
      CoFoundry provides structured drafting support and editable templates. It does not provide legal advice. Final founder documents should be reviewed by qualified counsel for the relevant jurisdiction.
    </p>
  </div>
</template>
