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
  <div class="page-shell py-16 md:py-20">
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

        <div class="mt-6 gap-6 grid">
          <div>
            <h2 class="text-lg font-semibold">
              Problem
            </h2>
            <p class="muted text-sm leading-7 mt-3">
              {{ opportunity.problem }}
            </p>
          </div>
          <div>
            <h2 class="text-lg font-semibold">
              Target users
            </h2>
            <p class="muted text-sm leading-7 mt-3">
              {{ opportunity.targetUsers }}
            </p>
          </div>
          <div>
            <h2 class="text-lg font-semibold">
              Traction
            </h2>
            <p class="muted text-sm leading-7 mt-3">
              {{ opportunity.traction }}
            </p>
          </div>
        </div>
      </section>

      <section class="gap-6 grid">
        <div class="panel p-6">
          <h2 class="text-lg font-semibold">
            Roles needed
          </h2>
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

        <div class="panel p-6">
          <h2 class="text-lg font-semibold">
            Founder context
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
          <NuxtLink :to="`/people/${buildPublicProfileSlug(ownerProfile)}`" class="text-sm text-[var(--accent)] mt-4 inline-flex">
            View public founder profile
          </NuxtLink>
        </div>

        <div class="panel p-6">
          <h2 class="text-lg font-semibold">
            Public listing rules
          </h2>
          <div class="muted text-sm leading-6 mt-4 gap-2 grid">
            <div>Contact stays gated until a qualified intro happens inside CoFoundry.</div>
            <div>Verification state is shown so public pages do not flatten every listing into the same trust level.</div>
            <div v-if="opportunity.officialWebsite">
              Official website:
              <a :href="opportunity.officialWebsite" target="_blank" rel="ugc nofollow noopener noreferrer" class="underline underline-offset-4">
                {{ opportunity.officialWebsite }}
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
