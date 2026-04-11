<script setup lang="ts">
import type { Profile } from "~/shared/types/domain"
import { formatRelativeDate, formatTrustTier } from "~/shared/utils/format"
import { buildProfileReadiness, buildProfileTrustTier, buildVerifiedLinkCount, isRecentlyActive } from "~/shared/utils/formation"

const props = withDefaults(defineProps<{
  profile: Profile
  compact?: boolean
}>(), {
  compact: false,
})

const readiness = computed(() => buildProfileReadiness(props.profile))
const trustTier = computed(() => buildProfileTrustTier(props.profile))
const verifiedLinkCount = computed(() => buildVerifiedLinkCount(props.profile))
const recentlyActive = computed(() => isRecentlyActive(props.profile.trustSignals.lastActiveAt))
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <BaseBadge :tone="trustTier === 'level_c' ? 'success' : trustTier === 'level_b' ? 'accent' : 'neutral'">
      {{ formatTrustTier(trustTier) }}
    </BaseBadge>
    <BaseBadge :tone="readiness.trustReady ? 'success' : 'accent'">
      {{ readiness.trustCompletedCount }}/{{ readiness.trustTotalCount }} trust-critical signals
    </BaseBadge>
    <BaseBadge :tone="profile.trustSignals.builderProofs.length ? 'success' : 'neutral'">
      {{ profile.trustSignals.builderProofs.length }} evidence card{{ profile.trustSignals.builderProofs.length === 1 ? "" : "s" }}
    </BaseBadge>
    <BaseBadge v-if="profile.trustSignals.phoneVerified" tone="neutral">
      Phone verified
    </BaseBadge>
    <BaseBadge v-if="verifiedLinkCount" :tone="verifiedLinkCount >= 2 ? 'success' : 'neutral'">
      {{ verifiedLinkCount }} verified link{{ verifiedLinkCount === 1 ? "" : "s" }}
    </BaseBadge>
    <BaseBadge v-if="profile.trustSignals.governmentIdVerified && !compact" tone="success">
      ID verified
    </BaseBadge>
    <BaseBadge tone="neutral">
      {{ profile.trustSignals.replyRatePercent }}% replies
    </BaseBadge>
    <BaseBadge :tone="profile.trustSignals.medianReplyHours <= 24 ? 'success' : 'neutral'">
      ~{{ profile.trustSignals.medianReplyHours }}h response
    </BaseBadge>
    <BaseBadge v-if="!compact" :tone="recentlyActive ? 'success' : 'warning'">
      {{ recentlyActive ? "Recently active" : formatRelativeDate(profile.trustSignals.lastActiveAt) }}
    </BaseBadge>
  </div>
</template>
