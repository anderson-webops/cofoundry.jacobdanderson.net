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
const headingTag = computed(() => `h${props.headingLevel}`)

const profileRoleLabel = computed(() => {
  if (props.profile.hasIdea && props.profile.wantsToJoinIdea)
    return "Founder / Collaborator"

  return props.profile.hasIdea ? "Founder" : "Collaborator"
})

const facts = computed(() => [
  { label: "Commitment", value: formatCommitment(props.profile.timeCommitment) },
  { label: "Works", value: [formatRemotePreference(props.profile.remotePreference), props.profile.location].filter(Boolean).join(" · ") },
  { label: "Top skills", value: props.skills.slice(0, 3).join(", ") || "Not listed" },
  { label: "Profile signals", value: trustReady.value ? `${trustPercent.value}% · complete` : `${trustPercent.value}%` },
])
</script>

<template>
  <article class="panel p-5 flex flex-col gap-5 h-full">
    <div class="flex gap-4 items-start justify-between">
      <div class="flex gap-3.5 min-w-0 items-start">
        <ProfileAvatar :display-name="profile.displayName" :photo-url="profile.photoUrl" size="md" />
        <div class="min-w-0">
          <component :is="headingTag" class="text-lg leading-snug font-semibold">
            {{ profile.displayName }}
          </component>
          <p class="muted text-sm leading-6 mt-0.5 line-clamp-2">
            {{ profile.headline }}
          </p>
        </div>
      </div>
      <BaseBadge :tone="profile.hasIdea ? 'accent' : 'neutral'" class="shrink-0">
        {{ profileRoleLabel }}
      </BaseBadge>
    </div>

    <CardFacts :facts="facts" />

    <div v-if="$slots.default" class="mt-auto pt-4 border-t border-[var(--line)] flex flex-wrap gap-3">
      <slot />
    </div>
  </article>
</template>
