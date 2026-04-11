<script setup lang="ts">
import { formatRelativeDate } from "~/shared/utils/format"
import { buildParticipantProfiles } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Messages")

const { authStore, workspaceStore } = useCurrentMember()

const conversations = computed(() => authStore.currentUser
  ? workspaceStore.data.conversations
      .filter(conversation => conversation.participantIds.includes(authStore.currentUser!.id))
      .sort((left, right) => new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime())
  : [])

function conversationTitle(conversationId: string) {
  const conversation = workspaceStore.data.conversations.find(item => item.id === conversationId)
  if (!conversation || !authStore.currentUser)
    return "Conversation"

  const profiles = buildParticipantProfiles(workspaceStore.data, conversation.participantIds)
  return profiles.find(profile => profile.userId !== authStore.currentUser?.id)?.displayName || "Conversation"
}
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Messages"
      title="Matched conversations"
      description="Messages unlock after mutual interest. Proposal and contract updates also show up as system messages here."
    />

    <div v-if="conversations.length" class="gap-4 grid lg:grid-cols-2">
      <ConversationCard
        v-for="conversation in conversations"
        :key="conversation.id"
        :title="conversationTitle(conversation.id)"
        :preview="workspaceStore.getConversationPreview(conversation.id)?.body || 'No messages yet.'"
        :unread-count="conversation.unreadCountByUser[authStore.currentUser!.id] || 0"
        :href="`/app/messages/${conversation.id}`"
        :when="formatRelativeDate(conversation.lastMessageAt)"
      />
    </div>

    <EmptyState
      v-else
      icon="i-carbon-chat"
      title="No conversations yet"
      description="Matches unlock messaging. Start by browsing profiles or startup opportunities and sending a connect request."
    >
      <BaseButton to="/app/discover">
        Find people
      </BaseButton>
    </EmptyState>
  </div>
</template>
