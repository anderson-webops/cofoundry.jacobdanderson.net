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
      eyebrow="Proposals"
      title="Structured collaboration proposals"
      description="This workflow keeps responsibilities, cash, equity, vesting, decision rights, IP, and exit expectations in the same place."
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
      title="No proposals yet"
      description="Start a proposal from a matched conversation to make the collaboration terms explicit."
    >
      <BaseButton to="/app/messages">
        Open messages
      </BaseButton>
    </EmptyState>
  </div>
</template>
