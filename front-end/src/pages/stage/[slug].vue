<script setup lang="ts">
import { workspaceSeed } from "~/shared/data/seed"
import { getPublicOpportunitiesForStage, getPublicProfilesForStage, getRoleHubs, getStageHubs, pickRelatedHubEntries } from "~/shared/utils/directory"

const route = useRoute()
const slug = String(route.params.slug)
const hub = getStageHubs(workspaceSeed).find(entry => entry.slug === slug)

if (!hub)
  throw createError({ statusCode: 404, statusMessage: "Stage hub not found" })

const profiles = getPublicProfilesForStage(workspaceSeed, slug)
const opportunities = getPublicOpportunitiesForStage(workspaceSeed, slug)
const relatedRoles = pickRelatedHubEntries(getRoleHubs(workspaceSeed), "", 4)

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

    <div class="mt-8 gap-4 grid sm:grid-cols-2">
      <MetricTile label="Public profiles" :value="profiles.length" />
      <MetricTile label="Public startup searches" :value="opportunities.length" />
    </div>

    <section class="mt-10">
      <PageIntro
        eyebrow="Profiles"
        :title="`${hub.label} collaborators and founders`"
        description="People who explicitly opted into public discovery for this stage of company-building."
      />
      <div class="mt-8 gap-5 grid xl:grid-cols-3">
        <ProfileCard
          v-for="entry in profiles.slice(0, 6)"
          :key="entry.slug"
          :profile="entry.profile"
          :skills="entry.skillLabels"
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

    <div class="mt-14">
      <div class="panel p-6">
        <h2 class="text-2xl font-semibold">
          Related role hubs
        </h2>
        <div class="surface-row-list mt-6 lg:gap-x-8 lg:grid lg:grid-cols-2">
          <NuxtLink
            v-for="entry in relatedRoles"
            :key="entry.slug"
            :to="`/roles/${entry.slug}`"
            class="surface-row block transition hover:text-[var(--accent)]"
          >
            <p class="font-semibold">
              {{ entry.label }}
            </p>
            <p class="muted text-sm leading-6 mt-2">
              {{ entry.profileCount }} profiles · {{ entry.opportunityCount }} searches
            </p>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
