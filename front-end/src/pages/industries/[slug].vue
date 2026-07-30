<script setup lang="ts">
import { pickRelatedHubEntries } from "~/shared/utils/directory"

const route = useRoute()
const slug = String(route.params.slug)
const directory = await usePublicDirectory()
const hub = directory.industryHubs.find(entry => entry.slug === slug)

if (!hub)
  throw createError({ statusCode: 404, statusMessage: "Industry hub not found" })

const profiles = directory.profiles.filter(entry => entry.industrySlugs.includes(slug))
const opportunities = directory.opportunities.filter(entry => entry.industrySlugs.includes(slug))
const relatedRoles = pickRelatedHubEntries(directory.roleHubs, "", 3)
const relatedStages = pickRelatedHubEntries(directory.stageHubs, "", 3)

usePageSeo(`${hub.label} founder searches`, hub.description, {
  canonicalPath: `/industries/${hub.slug}`,
})
</script>

<template>
  <div class="page-shell page-section">
    <PageIntro
      eyebrow="Industry hub"
      :title="hub.label"
      :description="hub.description"
    >
      <template #actions>
        <BaseButton variant="secondary" to="/industries">
          All industry hubs
        </BaseButton>
      </template>
    </PageIntro>

    <section class="mt-10">
      <PageIntro
        eyebrow="Profiles"
        :heading-level="2"
        :title="`${hub.label} people`"
        description="Public profiles who already operate in this market and opted into public discovery."
      />
      <div class="mt-8 gap-5 grid xl:grid-cols-3">
        <ProfileCard
          v-for="entry in profiles.slice(0, 6)"
          :key="entry.slug"
          :profile="entry.profile"
          :skills="entry.skillLabels"
          :trust-summary="entry.trustSummary"
        >
          <BaseButton variant="secondary" :to="`/people/${entry.slug}`">
            View public profile
          </BaseButton>
        </ProfileCard>
      </div>
    </section>

    <section class="mt-14">
      <PageIntro
        eyebrow="Startup searches"
        :heading-level="2"
        :title="`${hub.label} startup opportunities`"
        description="Founders in this market using CoFoundry to fill real ownership gaps."
      />
      <div class="mt-8 gap-5 grid xl:grid-cols-3">
        <OpportunityCard
          v-for="entry in opportunities.slice(0, 6)"
          :key="entry.slug"
          :opportunity="entry.opportunity"
        >
          <BaseButton variant="secondary" :to="`/startups/${entry.slug}`">
            View startup search
          </BaseButton>
        </OpportunityCard>
      </div>
    </section>

    <nav class="surface-row mt-14">
      <h2 class="text-lg font-semibold">
        Explore adjacent hubs
      </h2>
      <div class="mt-4 flex flex-wrap gap-2">
        <NuxtLink
          v-for="entry in relatedRoles"
          :key="`role-${entry.slug}`"
          :to="`/roles/${entry.slug}`"
          class="pill"
        >
          {{ entry.label }}
        </NuxtLink>
        <NuxtLink
          v-for="entry in relatedStages"
          :key="`stage-${entry.slug}`"
          :to="`/stage/${entry.slug}`"
          class="pill"
        >
          {{ entry.label }}
        </NuxtLink>
      </div>
    </nav>
  </div>
</template>
