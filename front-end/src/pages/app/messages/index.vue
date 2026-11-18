<script setup lang="ts">
import { computed } from "vue"
import { definePageMeta } from "#app/composables/pages"
import ConversationCard from "~/components/app/ConversationCard.vue"
import BaseButton from "~/components/ui/BaseButton.vue"
import EmptyState from "~/components/ui/EmptyState.vue"
import PageIntro from "~/components/ui/PageIntro.vue"
import { useCurrentMember } from "~/composables/useCurrentMember"
import { usePageSeo } from "~/composables/usePageSeo"
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
      description="Messaging requires a mutual match."
    >
      <BaseButton to="/app/discover">
        Find people
      </BaseButton>
    </EmptyState>
  </div>
</template>
