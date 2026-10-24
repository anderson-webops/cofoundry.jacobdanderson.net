<script setup lang="ts">
import type { Proposal, ProposalVersion } from "~/shared/types/domain"
import { computed } from "vue"
import { formatProposalRelationshipType, formatProposalStatus } from "~/shared/utils/format"

const props = defineProps<{
  proposal: Proposal
  version?: ProposalVersion
  href: string
}>()

const facts = computed(() => [
  { label: "Role", value: props.version?.roleTitle || "Not set" },
  { label: "Relationship", value: props.version ? formatProposalRelationshipType(props.version.relationshipType) : "Not set" },
  { label: "Cash", value: props.version?.cashCompensation || "Not set" },
  { label: "Equity", value: props.version?.equity || "Not set" },
])
</script>

<template>
  <NuxtLink :to="href" class="surface-row block transition hover:bg-[var(--accent-soft)]">
    <div class="flex gap-4 items-start justify-between">
      <div>
        <h3 class="text-lg font-semibold">
          {{ proposal.title }}
        </h3>
        <p v-if="version?.summary" class="muted text-sm leading-6 mt-1 line-clamp-2">
          {{ version.summary }}
        </p>
      </div>
      <BaseBadge :tone="proposal.status === 'accepted' ? 'success' : proposal.status === 'rejected' ? 'danger' : 'accent'">
        {{ formatProposalStatus(proposal.status) }}
      </BaseBadge>
    </div>
    <CardFacts class="mt-4 sm:grid-cols-4" :facts="facts" />
  </NuxtLink>
</template>
