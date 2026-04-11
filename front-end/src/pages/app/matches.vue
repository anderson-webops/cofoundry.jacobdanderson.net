<script setup lang="ts">
import { formatDate } from "~/shared/utils/format"
import { buildParticipantProfiles, getConversationByMatch, getMatchesForUser } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Matches")

const { authStore, workspaceStore } = useCurrentMember()

const matches = computed(() => authStore.currentUser ? getMatchesForUser(workspaceStore.data, authStore.currentUser.id) : [])

function matchPartner(match: ReturnType<typeof getMatchesForUser>[number]) {
  if (!authStore.currentUser)
    return null

  const profiles = buildParticipantProfiles(workspaceStore.data, match.participantIds)
  return profiles.find(item => item.userId !== authStore.currentUser?.id) || null
}

function latestPreview(match: ReturnType<typeof getMatchesForUser>[number]) {
  const conversation = getConversationByMatch(workspaceStore.data, match)
  return conversation ? workspaceStore.getConversationPreview(conversation.id)?.body : ""
}
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Matches"
      title="Mutual interest unlocks messaging."
      description="Founders and collaborators only get direct access after both sides opt in. That keeps outreach higher signal and the discovery layer calmer."
    />

    <div v-if="matches.length" class="gap-4 grid lg:grid-cols-2">
      <article v-for="match in matches" :key="match.id" class="panel p-6">
        <div class="flex gap-4 items-start justify-between">
          <div>
            <h2 class="text-xl font-semibold">
              {{ matchPartner(match)?.displayName }}
            </h2>
            <p class="muted text-sm mt-2">
              {{ matchPartner(match)?.headline }}
            </p>
          </div>
          <BaseBadge tone="accent">
            Match
          </BaseBadge>
        </div>
        <p class="muted text-sm leading-6 mt-4">
          {{ latestPreview(match) }}
        </p>
        <div class="mt-5 flex items-center justify-between">
          <span class="muted text-sm">Matched on {{ formatDate(match.createdAt) }}</span>
          <BaseButton :to="`/app/messages/${match.conversationId}`">
            Open conversation
          </BaseButton>
        </div>
      </article>
    </div>

    <EmptyState
      v-else
      icon="i-carbon-ibm-cloud-direct-link-1"
      title="No matches yet"
      description="Send a few focused connect requests or express interest in an opportunity to start opening conversations."
    >
      <BaseButton to="/app/discover">
        Go to discovery
      </BaseButton>
    </EmptyState>
  </div>
</template>
