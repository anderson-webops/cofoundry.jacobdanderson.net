<script setup lang="ts">
import { getCurrentProposalVersion, getProposalsForUser } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Proposals")

const { authStore, workspaceStore } = useCurrentMember()

const proposals = computed(() => authStore.currentUser ? getProposalsForUser(workspaceStore.data, authStore.currentUser.id) : [])
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Deal rooms"
      title="Proposal negotiations"
    />

    <div v-if="proposals.length" class="gap-4 grid lg:grid-cols-2">
      <ProposalCard
        v-for="proposal in proposals"
        :key="proposal.id"
        :proposal="proposal"
        :version="getCurrentProposalVersion(workspaceStore.data, proposal)"
        :href="`/app/proposals/${proposal.id}`"
      />
    </div>

    <EmptyState
      v-else
      icon="i-carbon-document-signed"
      title="No deal rooms yet"
      description="Start from a matched conversation once the first call and trial sprint have produced enough clarity to propose real terms."
    >
      <BaseButton to="/app/messages">
        Open messages
      </BaseButton>
    </EmptyState>
  </div>
</template>
