<script setup lang="ts">
import { computed } from "vue"
import { createError, useRoute } from "#app"
import { NuxtLink } from "#components"
import OpportunityCard from "~/components/app/OpportunityCard.vue"
import ProfileCard from "~/components/app/ProfileCard.vue"
import BaseButton from "~/components/ui/BaseButton.vue"
import PageIntro from "~/components/ui/PageIntro.vue"
import { usePageSeo } from "~/composables/usePageSeo"
import { useProductAccess } from "~/composables/useProductAccess"
import { usePublicDirectory } from "~/composables/usePublicDirectory"
import { pickRelatedHubEntries } from "~/shared/utils/directory"

const route = useRoute()
const slug = String(route.params.slug)
const directory = await usePublicDirectory()
const hub = directory.roleHubs.find(entry => entry.slug === slug)

if (!hub)
  throw createError({ statusCode: 404, statusMessage: "Role hub not found" })

const profiles = directory.profiles.filter(entry => entry.roleSlugs.includes(slug))
const opportunities = directory.opportunities.filter(entry => entry.roleSlugs.includes(slug))
const relatedIndustries = pickRelatedHubEntries(directory.industryHubs, "", 3)
const relatedStages = pickRelatedHubEntries(directory.stageHubs, "", 3)
const { buildAccessRequestPath, policy } = useProductAccess()
const roleHubCta = computed(() => policy.value.accountsEnabled
  ? { label: "Create your profile", to: "/auth/sign-up" }
  : {
      label: "Request access",
      to: buildAccessRequestPath(`role-hub-${hub.slug}`, "access")
    })

usePageSeo(`${hub.label} searches`, hub.description, {
  canonicalPath: `/roles/${hub.slug}`,
})
</script>

<template>
  <div class="page-shell page-section">
    <PageIntro
      eyebrow="Role hub"
      :title="hub.label"
    >
      <template #actions>
        <BaseButton variant="secondary" to="/roles">
          All role hubs
        </BaseButton>
        <BaseButton :to="roleHubCta.to">
          {{ roleHubCta.label }}
        </BaseButton>
      </template>
    </PageIntro>

    <section class="mt-10">
      <PageIntro
        eyebrow="Profiles"
        :heading-level="2"
        :title="`Public ${hub.label} profiles`"
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
        Related browse paths
      </h2>
      <div class="mt-4 flex flex-wrap gap-2">
        <NuxtLink
          v-for="entry in relatedIndustries"
          :key="`industry-${entry.slug}`"
          :to="`/industries/${entry.slug}`"
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
