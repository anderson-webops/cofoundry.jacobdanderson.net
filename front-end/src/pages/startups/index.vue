<script setup lang="ts">
const opportunities = (await usePublicDirectory()).opportunities

usePageSeo("Public startup searches", "Browse public startup opportunity pages on CoFoundry.", {
  canonicalPath: "/startups",
})
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Public startup searches"
      title="Founder searches with enough detail to judge whether the role is real."
      description="CoFoundry's public startup pages center on role expectations, company stage, and trust markers instead of loose hype or hidden assumptions."
    />

    <div class="mt-10 gap-5 grid xl:grid-cols-3">
      <OpportunityCard
        v-for="entry in opportunities"
        :key="entry.slug"
        :heading-level="2"
        :opportunity="entry.opportunity"
      >
        <BaseButton variant="secondary" :to="`/startups/${entry.slug}`">
          View startup search
        </BaseButton>
      </OpportunityCard>
    </div>
  </div>
</template>
