<script setup lang="ts">
import { workspaceSeed } from "~/shared/data/seed"
import { getPublicProfiles } from "~/shared/utils/directory"

const profiles = getPublicProfiles(workspaceSeed)

usePageSeo("Public founder profiles", "Browse opt-in public founder and collaborator profiles on CoFoundry.", {
  canonicalPath: "/people",
})
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Public profiles"
      title="Opt-in founder and collaborator pages built for serious discovery."
      description="These pages show enough signal to evaluate fit without exposing direct contact details or turning the network into a scraped directory."
    />

    <div class="mt-10 gap-5 grid xl:grid-cols-3">
      <ProfileCard
        v-for="entry in profiles"
        :key="entry.slug"
        :profile="entry.profile"
        :skills="entry.skillLabels"
      >
        <BaseButton variant="secondary" :to="`/people/${entry.slug}`">
          View public profile
        </BaseButton>
      </ProfileCard>
    </div>
  </div>
</template>
