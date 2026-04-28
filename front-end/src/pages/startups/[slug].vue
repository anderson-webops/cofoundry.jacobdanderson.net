<script setup lang="ts">
import { workspaceSeed } from "~/shared/data/seed"
import { buildPublicProfileSlug, getPublicOpportunityBySlug, slugifySegment } from "~/shared/utils/directory"
import { formatCommitment, formatCompensation, formatOpportunityVerificationStatus, formatRemotePreference, formatStage } from "~/shared/utils/format"
import { getOpportunityVerificationTone } from "~/shared/utils/formation"

const route = useRoute()
const slug = String(route.params.slug)
const entry = getPublicOpportunityBySlug(workspaceSeed, slug)
const { getIntroCta } = useProductAccess()

if (!entry)
  throw createError({ statusCode: 404, statusMessage: "Public startup search not found" })

const { opportunity, ownerProfile } = entry
const introCta = computed(() => getIntroCta(`startup-search-${entry.slug}`))

usePageSeo(opportunity.startupName, opportunity.oneLinePitch, {
  canonicalPath: `/startups/${entry.slug}`,
})
</script>

<template>
  <div class="page-shell page-section">
    <PageIntro
      eyebrow="Public startup search"
      :title="opportunity.startupName"
      :description="opportunity.oneLinePitch"
    >
      <template #actions>
        <BaseButton variant="secondary" to="/startups">
          All startup searches
        </BaseButton>
        <BaseButton :to="introCta.to">
          {{ introCta.label }}
        </BaseButton>
      </template>
    </PageIntro>

    <div class="mt-10 gap-6 grid xl:grid-cols-[1.05fr_0.95fr]">
      <section class="panel p-6">
        <div class="flex flex-wrap gap-2">
          <BaseBadge tone="accent">
            {{ formatStage(opportunity.stage) }}
          </BaseBadge>
          <BaseBadge tone="neutral">
            {{ formatRemotePreference(opportunity.remotePreference) }}
          </BaseBadge>
          <BaseBadge tone="neutral">
            {{ formatCommitment(opportunity.expectedCommitment) }}
          </BaseBadge>
          <BaseBadge tone="neutral">
            {{ formatCompensation(opportunity.compensationStructure) }}
          </BaseBadge>
          <BaseBadge :tone="getOpportunityVerificationTone(opportunity.verificationStatus)">
            {{ formatOpportunityVerificationStatus(opportunity.verificationStatus) }}
          </BaseBadge>
        </div>

        <div class="surface-row-list mt-6">
          <div class="surface-row">
            <h2 class="text-lg font-semibold">
              Problem
            </h2>
            <p class="muted text-sm leading-7 mt-3">
              {{ opportunity.problem }}
            </p>
          </div>
          <div class="surface-row">
            <h2 class="text-lg font-semibold">
              Target users
            </h2>
            <p class="muted text-sm leading-7 mt-3">
              {{ opportunity.targetUsers }}
            </p>
          </div>
          <div class="surface-row">
            <h2 class="text-lg font-semibold">
              Traction
            </h2>
            <p class="muted text-sm leading-7 mt-3">
              {{ opportunity.traction }}
            </p>
          </div>
        </div>
      </section>

      <section>
        <div class="panel p-6">
          <h2 class="text-lg font-semibold">
            Founder and roles
          </h2>
          <p class="font-semibold mt-4">
            {{ ownerProfile.displayName }}
          </p>
          <p class="muted text-sm leading-6 mt-2">
            {{ ownerProfile.headline }}
          </p>
          <div class="mt-4">
            <TrustSignalStrip :profile="ownerProfile" />
          </div>
          <div class="mt-4 flex flex-wrap gap-4">
            <NuxtLink :to="`/people/${buildPublicProfileSlug(ownerProfile)}`" class="text-sm text-[var(--accent)] inline-flex">
              View public founder profile
            </NuxtLink>
            <a
              v-if="opportunity.officialWebsite"
              :href="opportunity.officialWebsite"
              target="_blank"
              rel="ugc nofollow noopener noreferrer"
              class="text-sm text-[var(--accent)] inline-flex"
            >
              Official website
            </a>
          </div>
          <div class="surface-divider mt-5">
            <p class="text-sm font-semibold">
              Roles needed
            </p>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <NuxtLink
              v-for="role in opportunity.rolesNeeded"
              :key="role"
              :to="`/roles/${slugifySegment(role)}`"
              class="pill"
            >
              {{ role }}
            </NuxtLink>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <NuxtLink
              v-for="industry in opportunity.industries"
              :key="industry"
              :to="`/industries/${slugifySegment(industry)}`"
              class="pill"
            >
              {{ industry }}
            </NuxtLink>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
