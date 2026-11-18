<script setup lang="ts">
import type { Profile } from "~/shared/types/domain"
import type { PublicTrustSummary } from "~/shared/utils/directory"
import { computed } from "vue"
import BaseBadge from "~/components/ui/BaseBadge.vue"
import { formatRelativeDate, formatTrustTier } from "~/shared/utils/format"
import { buildProfileReadiness, buildProfileTrustTier, buildVerifiedLinkCount, isRecentlyActive } from "~/shared/utils/formation"

const props = withDefaults(defineProps<{
  profile: Profile
  compact?: boolean
  trustSummary?: PublicTrustSummary
}>(), {
  compact: false,
})

const readiness = computed(() => buildProfileReadiness(props.profile))
const trustTier = computed(() => props.trustSummary?.tier ?? buildProfileTrustTier(props.profile))
const trustCompletedCount = computed(() => props.trustSummary?.completedCount ?? readiness.value.trustCompletedCount)
const trustTotalCount = computed(() => props.trustSummary?.totalCount ?? readiness.value.trustTotalCount)
const trustReady = computed(() => props.trustSummary?.ready ?? readiness.value.trustReady)
const verifiedLinkCount = computed(() => buildVerifiedLinkCount(props.profile))
const recentlyActive = computed(() => isRecentlyActive(props.profile.trustSignals.lastActiveAt))
const badges = computed(() => {
  const items: { label: string, tone: "success" | "accent" | "neutral" | "warning" }[] = [
    {
      label: formatTrustTier(trustTier.value),
      tone: trustTier.value === "level_c"
        ? "success"
        : trustTier.value === "level_b"
          ? "accent"
          : "neutral",
    },
    {
      label: `${trustCompletedCount.value}/${trustTotalCount.value} profile signals`,
      tone: trustReady.value ? "success" : "accent",
    },
  ]

  if (props.profile.trustSignals.builderProofs.length) {
    items.push({ label: `${props.profile.trustSignals.builderProofs.length} evidence card${props.profile.trustSignals.builderProofs.length === 1
      ? ""
      : "s"}`, tone: "success" })
  }

  if (verifiedLinkCount.value) {
    items.push({
      label: `${verifiedLinkCount.value} verified link${verifiedLinkCount.value === 1
        ? ""
        : "s"}`,
      tone: verifiedLinkCount.value >= 2
        ? "success"
        : "neutral"
    })
  }

  if (!props.compact && props.profile.trustSignals.phoneVerified)
    items.push({ label: "Phone verified", tone: "neutral" })

  if (!props.compact && props.profile.trustSignals.governmentIdVerified)
    items.push({ label: "ID verified", tone: "success" })

  items.push({
    label: `~${props.profile.trustSignals.medianReplyHours}h response`,
    tone: props.profile.trustSignals.medianReplyHours <= 24
      ? "success"
      : "neutral",
  })

  if (!props.compact) {
    items.push({
      label: recentlyActive.value
        ? "Recently active"
        : formatRelativeDate(props.profile.trustSignals.lastActiveAt),
      tone: recentlyActive.value ? "success" : "warning"
    })
  }

  return props.compact
    ? items.slice(0, 4)
    : items.slice(0, 6)
})
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <BaseBadge
      v-for="badge in badges"
      :key="badge.label"
      :tone="badge.tone"
    >
      {{ badge.label }}
    </BaseBadge>
  </div>
</template>
