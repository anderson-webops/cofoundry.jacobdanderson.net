<script setup lang="ts">
import type { StartupOpportunity } from "~/shared/types/domain"
import { computed } from "vue"
import { formatCommitment, formatCompensation, formatOpportunityVerificationStatus, formatStage } from "~/shared/utils/format"
import { getOpportunityVerificationTone } from "~/shared/utils/formation"

const props = withDefaults(defineProps<{
  opportunity: StartupOpportunity
  headingLevel?: 2 | 3
}>(), {
  headingLevel: 3,
})

const headingTag = computed(() => `h${props.headingLevel}`)

const rolesLabel = computed(() => {
  const roles = props.opportunity.rolesNeeded
  if (!roles.length)
    return "Not listed"

  return roles.length > 2 ? `${roles.slice(0, 2).join(", ")} +${roles.length - 2}` : roles.join(", ")
})

const facts = computed(() => [
  { label: "Looking for", value: rolesLabel.value },
  { label: "Stage", value: formatStage(props.opportunity.stage) },
  { label: "Commitment", value: formatCommitment(props.opportunity.expectedCommitment) },
  { label: "Compensation", value: formatCompensation(props.opportunity.compensationStructure) },
])
</script>

<template>
  <article class="panel p-5 flex flex-col gap-5 h-full">
    <div class="flex gap-4 items-start justify-between">
      <div class="min-w-0">
        <component :is="headingTag" class="text-lg leading-snug font-semibold">
          {{ opportunity.startupName }}
        </component>
        <p class="muted text-sm leading-6 mt-0.5 line-clamp-2">
          {{ opportunity.oneLinePitch }}
        </p>
      </div>
      <BaseBadge :tone="getOpportunityVerificationTone(opportunity.verificationStatus)" class="shrink-0">
        {{ formatOpportunityVerificationStatus(opportunity.verificationStatus) }}
      </BaseBadge>
    </div>

    <CardFacts :facts="facts" />

    <div v-if="$slots.default" class="mt-auto pt-4 border-t border-[var(--line)] flex flex-wrap gap-3">
      <slot />
    </div>
  </article>
</template>
