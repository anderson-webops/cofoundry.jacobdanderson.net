<script setup lang="ts">
import type { Profile } from "~/shared/types/domain"
import { formatCommitment, formatEquityPhilosophy, formatRemotePreference, formatRunwayBucket } from "~/shared/utils/format"
import { buildResponsivenessLabel } from "~/shared/utils/formation"

const props = defineProps<{
  profile: Profile
  skills: string[]
}>()

const profileRoleLabel = computed(() => {
  if (props.profile.hasIdea && props.profile.wantsToJoinIdea)
    return "Founder / Collaborator"

  return props.profile.hasIdea ? "Founder" : "Collaborator"
})
</script>

<template>
  <article class="panel p-5 flex flex-col gap-5 h-full">
    <div class="flex gap-4 items-start justify-between">
      <div>
        <h3 class="text-lg font-semibold">
          {{ profile.displayName }}
        </h3>
        <p class="muted text-sm mt-1">
          {{ profile.headline }}
        </p>
      </div>
      <BaseBadge :tone="profile.hasIdea ? 'accent' : 'neutral'">
        {{ profileRoleLabel }}
      </BaseBadge>
    </div>

    <div class="flex flex-wrap gap-2">
      <BaseBadge tone="neutral">
        {{ formatRemotePreference(profile.remotePreference) }}
      </BaseBadge>
      <BaseBadge tone="neutral">
        {{ formatCommitment(profile.timeCommitment) }}
      </BaseBadge>
      <BaseBadge tone="neutral">
        {{ profile.location }}
      </BaseBadge>
    </div>

    <p class="muted text-sm leading-6">
      {{ profile.bio }}
    </p>

    <TrustSignalStrip :profile="profile" compact />

    <div class="flex flex-wrap gap-2">
      <span v-for="skill in skills.slice(0, 4)" :key="skill" class="pill">
        {{ skill }}
      </span>
    </div>

    <div class="muted text-sm gap-2 grid">
      <div>Industries: {{ profile.industries.join(", ") }}</div>
      <div>Company fit: {{ profile.intent.companyPreferences.slice(0, 2).join(", ") }}</div>
      <div>Commitment: {{ profile.commitmentProfile.weeklyAvailabilityHours }}h/week · {{ formatRunwayBucket(profile.commitmentProfile.runwayBucket) }}</div>
      <div>Responsiveness: {{ buildResponsivenessLabel(profile) }}</div>
      <div>Equity philosophy: {{ formatEquityPhilosophy(profile.governancePreferences.equityPhilosophy) }}</div>
      <div>Equity range: {{ profile.equityExpectationRange }}</div>
    </div>

    <div class="mt-auto flex flex-wrap gap-3">
      <slot />
    </div>
  </article>
</template>
