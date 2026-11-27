<script setup lang="ts">
import { computed } from "vue"
import { createError, useRoute } from "#app"
import { NuxtLink } from "#components"
import TrustSignalStrip from "~/components/app/TrustSignalStrip.vue"
import BaseBadge from "~/components/ui/BaseBadge.vue"
import BaseButton from "~/components/ui/BaseButton.vue"
import PageIntro from "~/components/ui/PageIntro.vue"
import { usePageSeo } from "~/composables/usePageSeo"
import { useProductAccess } from "~/composables/useProductAccess"
import { usePublicDirectory } from "~/composables/usePublicDirectory"
import { buildPublicProfileSlug, slugifySegment } from "~/shared/utils/directory"
import { formatCommitment, formatCompensation, formatOpportunityVerificationStatus, formatRemotePreference, formatStage } from "~/shared/utils/format"
import { getOpportunityVerificationTone } from "~/shared/utils/formation"

const route = useRoute()
const slug = String(route.params.slug)
const entry = (await usePublicDirectory()).opportunities.find(entry => entry.slug === slug)
const { getIntroCta } = useProductAccess()

if (!entry)
  throw createError({ statusCode: 404, statusMessage: "Public startup search not found" })

const { opportunity, ownerProfile, ownerTrustSummary } = entry
const introCta = computed(() => getIntroCta(`startup-search-${entry.slug}`))

usePageSeo(`${opportunity.startupName} startup search`, opportunity.oneLinePitch, {
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
            <TrustSignalStrip :profile="ownerProfile" :trust-summary="ownerTrustSummary" />
          </div>
          <div class="mt-4 flex flex-wrap gap-4">
            <NuxtLink :to="`/people/${buildPublicProfileSlug(ownerProfile)}`" class="public-action-link text-sm">
              View public founder profile
            </NuxtLink>
            <a
              v-if="opportunity.officialWebsite"
              :href="opportunity.officialWebsite"
              target="_blank"
              rel="ugc nofollow noopener noreferrer"
              class="public-action-link text-sm"
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
