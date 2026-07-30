<script setup lang="ts">
const profiles = (await usePublicDirectory()).profiles

usePageSeo("Public founder profiles", "Browse opt-in public founder and collaborator profiles on CoFoundry.", {
  canonicalPath: "/people",
})
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Public profiles"
      title="Public founder and collaborator profiles."
      description="These pages show enough signal to evaluate fit without exposing direct contact details or turning the network into a scraped directory."
    />

    <div class="mt-10 gap-5 grid xl:grid-cols-3">
      <ProfileCard
        v-for="entry in profiles"
        :key="entry.slug"
        :heading-level="2"
        :profile="entry.profile"
        :skills="entry.skillLabels"
        :trust-summary="entry.trustSummary"
      >
        <BaseButton variant="secondary" :to="`/people/${entry.slug}`">
          View public profile
        </BaseButton>
      </ProfileCard>
    </div>
  </div>
</template>
