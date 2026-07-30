<script setup lang="ts">
import { pickRelatedHubEntries } from "~/shared/utils/directory"

const route = useRoute()
const slug = String(route.params.slug)
const directory = await usePublicDirectory()
const hub = directory.stageHubs.find(entry => entry.slug === slug)

if (!hub)
  throw createError({ statusCode: 404, statusMessage: "Stage hub not found" })

const profiles = directory.profiles.filter(entry => entry.stageSlugs.includes(slug))
const opportunities = directory.opportunities.filter(entry => entry.stageSlugs.includes(slug))
const relatedRoles = pickRelatedHubEntries(directory.roleHubs, "", 4)

usePageSeo(`${hub.label} startup searches`, hub.description, {
  canonicalPath: `/stage/${hub.slug}`,
})
</script>

<template>
  <div class="page-shell page-section">
    <PageIntro
      eyebrow="Stage hub"
      :title="hub.label"
      :description="hub.description"
    >
      <template #actions>
        <BaseButton variant="secondary" to="/stage">
          All stage hubs
        </BaseButton>
      </template>
    </PageIntro>

    <section class="mt-10">
      <PageIntro
        eyebrow="Profiles"
        :heading-level="2"
        :title="`${hub.label} collaborators and founders`"
        description="People who explicitly opted into public discovery for this stage of company-building."
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
        description="Public startup searches at this stage, with enough structure to evaluate whether the company shape is worth a call."
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
        Related role hubs
      </h2>
      <div class="mt-4 flex flex-wrap gap-2">
        <NuxtLink
          v-for="entry in relatedRoles"
          :key="entry.slug"
          :to="`/roles/${entry.slug}`"
          class="pill"
        >
          {{ entry.label }}
        </NuxtLink>
      </div>
    </nav>
  </div>
</template>
