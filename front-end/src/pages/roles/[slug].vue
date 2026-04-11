<script setup lang="ts">
import { contractGuidePages, trustCenterPages } from "~/shared/data/public-content"
import { workspaceSeed } from "~/shared/data/seed"
import { getIndustryHubs, getPublicOpportunitiesForRole, getPublicProfilesForRole, getRoleHubs, getStageHubs, pickRelatedHubEntries } from "~/shared/utils/directory"

const route = useRoute()
const slug = String(route.params.slug)
const hub = getRoleHubs(workspaceSeed).find(entry => entry.slug === slug)

if (!hub)
  throw createError({ statusCode: 404, statusMessage: "Role hub not found" })

const profiles = getPublicProfilesForRole(workspaceSeed, slug)
const opportunities = getPublicOpportunitiesForRole(workspaceSeed, slug)
const relatedIndustries = pickRelatedHubEntries(getIndustryHubs(workspaceSeed), "", 3)
const relatedStages = pickRelatedHubEntries(getStageHubs(workspaceSeed), "", 3)
const visibilityGuide = trustCenterPages.find(entry => entry.slug === "profile-visibility")!
const founderAgreementGuide = contractGuidePages.find(entry => entry.slug === "founder-agreement")!

usePageSeo(`${hub.label} searches`, hub.description, {
  canonicalPath: `/roles/${hub.slug}`,
})
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Role hub"
      :title="hub.label"
      :description="hub.description"
    >
      <template #actions>
        <BaseButton variant="secondary" to="/roles">
          All role hubs
        </BaseButton>
        <BaseButton to="/auth/sign-up">
          Create your profile
        </BaseButton>
      </template>
    </PageIntro>

    <div class="mt-8 gap-4 grid sm:grid-cols-3">
      <MetricTile label="Public profiles" :value="profiles.length" />
      <MetricTile label="Public startup searches" :value="opportunities.length" />
      <MetricTile label="Next step" value="Proposal-ready" />
    </div>

    <section class="mt-10">
      <PageIntro
        eyebrow="Profiles"
        :title="`Public ${hub.label} profiles`"
        description="These members opted into public discovery. Direct contact still stays inside CoFoundry."
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
        description="Role pages are only useful if they show real founder demand, not just generic content."
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
          Related browse paths
        </h2>
        <div class="mt-6 gap-4 grid">
          <NuxtLink
            v-for="entry in relatedIndustries"
            :key="`industry-${entry.slug}`"
            :to="`/industries/${entry.slug}`"
            class="panel-inset p-4 transition hover:border-[var(--accent)]"
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
            class="panel-inset p-4 transition hover:border-[var(--accent)]"
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
          Trust and deal-room context
        </h2>
        <div class="mt-6 gap-4 grid">
          <NuxtLink
            :to="`/trust/${visibilityGuide.slug}`"
            class="panel-inset p-4 transition hover:border-[var(--accent)]"
          >
            <p class="font-semibold">
              {{ visibilityGuide.title }}
            </p>
            <p class="muted text-sm leading-6 mt-2">
              {{ visibilityGuide.description }}
            </p>
          </NuxtLink>
          <NuxtLink
            :to="`/contracts/${founderAgreementGuide.slug}`"
            class="panel-inset p-4 transition hover:border-[var(--accent)]"
          >
            <p class="font-semibold">
              {{ founderAgreementGuide.title }}
            </p>
            <p class="muted text-sm leading-6 mt-2">
              {{ founderAgreementGuide.description }}
            </p>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
