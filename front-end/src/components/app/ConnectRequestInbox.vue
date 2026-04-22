<script setup lang="ts">
import type { ConnectDeclineReason, ConnectRequest, Profile } from "~/shared/types/domain"
import { connectDeclineReasonOptions } from "~/shared/constants/options"
import { formatConnectDeclineReason, formatConnectRequestNextStep, formatDate } from "~/shared/utils/format"
import { buildConnectRequestDueCopy, buildResponsivenessLabel } from "~/shared/utils/formation"

interface ConnectRequestItem {
  request: ConnectRequest
  counterpart: Profile
}

defineProps<{
  mode: "incoming" | "outgoing"
  items: ConnectRequestItem[]
}>()

const emit = defineEmits<{
  accept: [requestId: string]
  decline: [requestId: string, reason: ConnectDeclineReason]
}>()

const declineReasons = reactive<Record<string, ConnectDeclineReason>>({})

function selectedReason(requestId: string) {
  return declineReasons[requestId] || "timing"
}

function decline(requestId: string) {
  emit("decline", requestId, selectedReason(requestId))
}
</script>

<template>
  <div class="gap-4 grid">
    <article
      v-for="item in items"
      :id="`${mode === 'incoming' ? 'intro' : 'request'}-${item.request.id}`"
      :key="item.request.id"
      class="panel p-5 gap-4 grid scroll-mt-28"
    >
      <div class="flex gap-4 items-start justify-between">
        <div>
          <p class="text-sm font-semibold">
            {{ item.counterpart.displayName }}
          </p>
          <p class="muted text-sm leading-6 mt-1">
            {{ item.counterpart.headline }}
          </p>
        </div>
        <BaseBadge :tone="item.request.status === 'accepted' ? 'success' : item.request.status === 'declined' ? 'warning' : 'accent'">
          {{ item.request.status === "pending" ? buildConnectRequestDueCopy(item.request) : item.request.status === "declined" ? formatConnectDeclineReason(item.request.declineReason || "timing") : "Accepted" }}
        </BaseBadge>
      </div>

      <TrustSignalStrip :profile="item.counterpart" compact />

      <div class="panel-inset p-4">
        <p class="text-sm font-semibold">
          {{ item.request.structuredIntro.roleContext }}
        </p>
        <div class="muted text-sm leading-6 mt-3 gap-2 grid">
          <div><span class="text-[var(--text)] font-semibold">Why fit:</span> {{ item.request.structuredIntro.whyFit }}</div>
          <div><span class="text-[var(--text)] font-semibold">Why now:</span> {{ item.request.structuredIntro.whyNow }}</div>
          <div><span class="text-[var(--text)] font-semibold">Next step:</span> {{ formatConnectRequestNextStep(item.request.structuredIntro.proposedNextStep) }}</div>
        </div>
      </div>

      <div class="muted text-sm leading-6 gap-2 grid">
        <div>Sent {{ formatDate(item.request.createdAt) }}</div>
        <div>{{ buildResponsivenessLabel(item.counterpart) }}</div>
      </div>

      <div v-if="mode === 'incoming' && item.request.status === 'pending'" class="gap-3 grid md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
        <SelectInput
          v-model="declineReasons[item.request.id]"
          label="Decline reason"
          :options="connectDeclineReasonOptions"
        />
        <BaseButton variant="secondary" @click="decline(item.request.id)">
          Decline
        </BaseButton>
        <BaseButton @click="emit('accept', item.request.id)">
          Accept
        </BaseButton>
      </div>

      <div v-else-if="mode === 'outgoing' && item.request.status === 'pending'" class="muted text-sm leading-6">
        Waiting on a reply. High-signal intros tend to convert faster when the role scope and next step are concrete.
      </div>
    </article>
  </div>
</template>
