<script setup lang="ts">
import type { Proposal, ProposalVersion } from "~/shared/types/domain"
import { formatProposalRelationshipType, formatProposalStatus } from "~/shared/utils/format"

defineProps<{
  proposal: Proposal
  version?: ProposalVersion
  href: string
}>()
</script>

<template>
  <NuxtLink :to="href" class="panel p-5 block transition hover:-translate-y-0.5">
    <div class="flex gap-4 items-start justify-between">
      <div>
        <h3 class="text-lg font-semibold">
          {{ proposal.title }}
        </h3>
        <p class="muted text-sm mt-2">
          {{ version?.summary }}
        </p>
      </div>
      <BaseBadge :tone="proposal.status === 'accepted' ? 'success' : proposal.status === 'rejected' ? 'danger' : 'accent'">
        {{ formatProposalStatus(proposal.status) }}
      </BaseBadge>
    </div>
    <div class="muted text-sm mt-4 gap-2 grid">
      <div>Relationship: {{ version ? formatProposalRelationshipType(version.relationshipType) : "Not set" }}</div>
      <div>Role: {{ version?.roleTitle }}</div>
      <div>Economics: {{ version?.cashCompensation }} · {{ version?.equity }}</div>
    </div>
  </NuxtLink>
</template>
