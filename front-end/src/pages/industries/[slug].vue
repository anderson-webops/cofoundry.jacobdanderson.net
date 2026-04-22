<script setup lang="ts">
import { contractGuidePages, trustCenterPages } from "~/shared/data/public-content"
import { workspaceSeed } from "~/shared/data/seed"
import { getIndustryHubs, getPublicOpportunitiesForIndustry, getPublicProfilesForIndustry, getRoleHubs, getStageHubs, pickRelatedHubEntries } from "~/shared/utils/directory"

const route = useRoute()
const slug = String(route.params.slug)
const hub = getIndustryHubs(workspaceSeed).find(entry => entry.slug === slug)

if (!hub)
  throw createError({ statusCode: 404, statusMessage: "Industry hub not found" })

const profiles = getPublicProfilesForIndustry(workspaceSeed, slug)
const opportunities = getPublicOpportunitiesForIndustry(workspaceSeed, slug)
const relatedRoles = pickRelatedHubEntries(getRoleHubs(workspaceSeed), "", 3)
const relatedStages = pickRelatedHubEntries(getStageHubs(workspaceSeed), "", 3)
const antiSpamGuide = trustCenterPages.find(entry => entry.slug === "anti-spam")!
const trialPlanGuide = contractGuidePages.find(entry => entry.slug === "trial-project-plan")!

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

    <div class="mt-8 gap-4 grid sm:grid-cols-3">
      <MetricTile label="Public profiles" :value="profiles.length" />
      <MetricTile label="Public startup searches" :value="opportunities.length" />
      <MetricTile label="Signal" value="Market fit first" />
    </div>

    <section class="mt-10">
      <PageIntro
        eyebrow="Profiles"
        :title="`${hub.label} people`"
        description="Public profiles who already operate in this market and opted into public discovery."
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

    <div class="mt-14 gap-6 grid lg:grid-cols-2">
      <div class="panel p-6">
        <h2 class="text-2xl font-semibold">
          Explore adjacent hubs
        </h2>
        <div class="surface-row-list mt-6">
          <NuxtLink
            v-for="entry in relatedRoles"
            :key="`role-${entry.slug}`"
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
          <NuxtLink
            v-for="entry in relatedStages"
            :key="`stage-${entry.slug}`"
            :to="`/stage/${entry.slug}`"
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

      <div class="panel p-6">
        <h2 class="text-2xl font-semibold">
          Trust and contracts
        </h2>
        <div class="surface-row-list mt-6">
          <NuxtLink
            :to="`/trust/${antiSpamGuide.slug}`"
            class="surface-row block transition hover:text-[var(--accent)]"
          >
            <p class="font-semibold">
              {{ antiSpamGuide.title }}
            </p>
            <p class="muted text-sm leading-6 mt-2">
              {{ antiSpamGuide.description }}
            </p>
          </NuxtLink>
          <NuxtLink
            :to="`/contracts/${trialPlanGuide.slug}`"
            class="surface-row block transition hover:text-[var(--accent)]"
          >
            <p class="font-semibold">
              {{ trialPlanGuide.title }}
            </p>
            <p class="muted text-sm leading-6 mt-2">
              {{ trialPlanGuide.description }}
            </p>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
