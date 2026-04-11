<script setup lang="ts">
import type { Profile } from "~/shared/types/domain"
import { formatRelativeDate, formatTrustTier } from "~/shared/utils/format"
import { buildProfileTrustScore, buildProfileTrustTier, isRecentlyActive } from "~/shared/utils/formation"

const props = withDefaults(defineProps<{
  profile: Profile
  compact?: boolean
}>(), {
  compact: false,
})

const trustScore = computed(() => buildProfileTrustScore(props.profile))
const trustTier = computed(() => buildProfileTrustTier(props.profile))
const recentlyActive = computed(() => isRecentlyActive(props.profile.trustSignals.lastActiveAt))
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <BaseBadge :tone="trustTier === 'level_c' ? 'success' : trustTier === 'level_b' ? 'accent' : 'neutral'">
      {{ formatTrustTier(trustTier) }}
    </BaseBadge>
    <BaseBadge tone="accent">
      Trust {{ trustScore }}
    </BaseBadge>
    <BaseBadge :tone="profile.trustSignals.builderProofs.length ? 'success' : 'neutral'">
      {{ profile.trustSignals.builderProofs.length }} proof{{ profile.trustSignals.builderProofs.length === 1 ? "" : "s" }}
    </BaseBadge>
    <BaseBadge v-if="profile.trustSignals.phoneVerified" tone="neutral">
      Phone verified
    </BaseBadge>
    <BaseBadge v-if="profile.trustSignals.linkedInVerified || profile.trustSignals.workDomainVerified" tone="neutral">
      Professional identity
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
