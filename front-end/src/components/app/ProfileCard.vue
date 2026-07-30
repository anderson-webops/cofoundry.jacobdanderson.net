<script setup lang="ts">
import type { Profile } from "~/shared/types/domain"
import type { PublicTrustSummary } from "~/shared/utils/directory"
import { computed } from "vue"
import { formatCommitment, formatRemotePreference } from "~/shared/utils/format"
import { buildProfileReadiness } from "~/shared/utils/formation"

const props = withDefaults(defineProps<{
  profile: Profile
  skills: string[]
  trustSummary?: PublicTrustSummary
  headingLevel?: 2 | 3
}>(), {
  headingLevel: 3,
})

const readiness = computed(() => buildProfileReadiness(props.profile))
const trustPercent = computed(() => props.trustSummary?.percent ?? readiness.value.trustPercent)
const trustReady = computed(() => props.trustSummary?.ready ?? readiness.value.trustReady)
const leadProof = computed(() => props.profile.trustSignals.builderProofs[0] || null)
const headingTag = computed(() => `h${props.headingLevel}`)
const proofHeadingTag = computed(() => `h${props.headingLevel + 1}`)

const profileRoleLabel = computed(() => {
  if (props.profile.hasIdea && props.profile.wantsToJoinIdea)
    return "Founder / Collaborator"

  return props.profile.hasIdea ? "Founder" : "Collaborator"
})
</script>

<template>
  <article class="panel p-5 flex flex-col gap-4 h-full">
    <div class="flex gap-4 items-start justify-between">
      <div class="flex gap-4 items-start">
        <ProfileAvatar :display-name="profile.displayName" :photo-url="profile.photoUrl" size="md" />
        <div>
          <component :is="headingTag" class="text-lg font-semibold">
            {{ profile.displayName }}
          </component>
          <p class="muted text-sm mt-1">
            {{ profile.headline }}
          </p>
        </div>
      </div>
      <BaseBadge :tone="profile.hasIdea ? 'accent' : 'neutral'">
        {{ profileRoleLabel }}
      </BaseBadge>
    </div>

    <div class="flex flex-wrap gap-2">
      <BaseBadge :tone="trustReady ? 'success' : 'accent'">
        {{ trustPercent }}% profile signals
      </BaseBadge>
    </div>

    <p class="muted text-sm leading-6">
      {{ formatRemotePreference(profile.remotePreference) }} · {{ formatCommitment(profile.timeCommitment) }} · {{ profile.location }}
    </p>

    <div v-if="leadProof" class="surface-divider">
      <p class="section-kicker">
        Featured proof
      </p>
      <component :is="proofHeadingTag" class="text-base font-semibold mt-2">
        {{ leadProof.title }}
      </component>
      <p class="text-sm mt-3">
        {{ leadProof.outcome }}
      </p>
    </div>

    <div class="flex flex-wrap gap-2">
      <span v-for="skill in skills.slice(0, 3)" :key="skill" class="pill">
        {{ skill }}
      </span>
    </div>

    <div class="mt-auto flex flex-wrap gap-3">
      <slot />
    </div>
  </article>
</template>
