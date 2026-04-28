<script setup lang="ts">
import { formatRelativeDate } from "~/shared/utils/format"
import {
  buildInboxSnapshot,
  getContractsNeedingSignature,
  getPendingIncomingConnectRequestsForUser,
  getPendingOutgoingConnectRequestsForUser,
  getProposalsNeedingResponse,
  getUnreadConversationsForUser,
  getUnreadNotificationsForUser,
} from "~/shared/utils/inbox"
import {
  buildParticipantProfiles,
  getCurrentContractVersion,
  getCurrentProposalVersion,
  getProfileByUserId,
} from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Inbox")

const toastStore = useToastStore()
const { authStore, workspaceStore } = useCurrentMember()
const currentUserId = computed(() => authStore.currentUser?.id || "")

const inboxSnapshot = computed(() => currentUserId.value ? buildInboxSnapshot(workspaceStore.data, currentUserId.value) : null)
const incomingRequests = computed(() => {
  if (!currentUserId.value)
    return []

  return getPendingIncomingConnectRequestsForUser(workspaceStore.data, currentUserId.value)
    .map((request) => {
      const counterpart = getProfileByUserId(workspaceStore.data, request.fromUserId)
      return counterpart ? { request, counterpart } : null
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
})
const outgoingRequests = computed(() => {
  if (!currentUserId.value)
    return []

  return getPendingOutgoingConnectRequestsForUser(workspaceStore.data, currentUserId.value)
    .map((request) => {
      const counterpart = getProfileByUserId(workspaceStore.data, request.toUserId)
      return counterpart ? { request, counterpart } : null
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
})
const unreadConversations = computed(() => currentUserId.value ? getUnreadConversationsForUser(workspaceStore.data, currentUserId.value) : [])
const proposalsNeedingResponse = computed(() => currentUserId.value ? getProposalsNeedingResponse(workspaceStore.data, currentUserId.value) : [])
const contractsNeedingSignature = computed(() => currentUserId.value ? getContractsNeedingSignature(workspaceStore.data, currentUserId.value) : [])
const unreadNotifications = computed(() => currentUserId.value ? getUnreadNotificationsForUser(workspaceStore.data, currentUserId.value) : [])
const hasDetailQueues = computed(() => Boolean(
  incomingRequests.value.length
  || unreadConversations.value.length
  || proposalsNeedingResponse.value.length
  || contractsNeedingSignature.value.length
  || unreadNotifications.value.length
  || outgoingRequests.value.length,
))

function conversationTitle(conversationId: string) {
  const conversation = workspaceStore.data.conversations.find(item => item.id === conversationId)
  if (!conversation || !authStore.currentUser)
    return "Conversation"

  const profiles = buildParticipantProfiles(workspaceStore.data, conversation.participantIds)
  return profiles.find(profile => profile.userId !== authStore.currentUser?.id)?.displayName || "Conversation"
}

async function acceptConnectRequest(requestId: string) {
  const conversationId = await workspaceStore.respondToConnectRequest(requestId, "accepted")
  toastStore.push({
    title: "Intro accepted",
    message: "Messaging is unlocked. Move straight into the proposed next step while intent is still fresh.",
    tone: "success",
  })

  if (conversationId)
    navigateTo(`/app/messages/${conversationId}`)
}

async function declineConnectRequest(requestId: string, reason: "timing" | "domain_mismatch" | "commitment_mismatch" | "values_mismatch" | "role_mismatch") {
  await workspaceStore.respondToConnectRequest(requestId, "declined", reason)
  toastStore.push({
    title: "Intro closed",
    message: "The other side now gets an explicit reason instead of silence.",
    tone: "info",
  })
}

async function markNotificationRead(notificationId: string) {
  await workspaceStore.markNotificationRead(notificationId)
}
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Inbox"
      title="Work the queue, not just the tools"
      description="This is the operating surface for structured intros, replies, proposal terms, signatures, and system updates that still need action."
    >
      <template #actions>
        <BaseBadge tone="accent">
          {{ inboxSnapshot?.actions.length || 0 }} live item{{ inboxSnapshot?.actions.length === 1 ? "" : "s" }}
        </BaseBadge>
      </template>
    </PageIntro>

    <div class="panel p-6">
      <div class="flex flex-wrap gap-3 items-start justify-between">
        <div class="max-w-2xl">
          <h2 class="text-xl font-semibold">
            Action queue
          </h2>
          <p class="muted text-sm leading-6 mt-2">
            Work these from top to bottom before opening more surface area. The order favors direct replies, explicit terms, and signatures over passive browsing.
          </p>
        </div>
        <BaseButton variant="secondary" to="/app/discover">
          Find new fits
        </BaseButton>
      </div>

      <div v-if="inboxSnapshot?.actions.length" class="surface-row-list mt-5">
        <NuxtLink
          v-for="item in inboxSnapshot.actions"
          :key="item.id"
          :to="item.href"
          class="surface-row block transition hover:-translate-y-0.5"
          @click="item.kind === 'notification' ? markNotificationRead(item.id.replace('notification:', '')) : undefined"
        >
          <div class="flex gap-3 items-start justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap gap-2 items-center">
                <p class="text-sm font-semibold">
                  {{ item.title }}
                </p>
                <BaseBadge :tone="item.badgeTone">
                  {{ item.badgeLabel }}
                </BaseBadge>
              </div>
              <p class="muted text-sm leading-6 mt-2">
                {{ item.summary }}
              </p>
            </div>
            <span class="muted text-xs whitespace-nowrap">
              {{ formatRelativeDate(item.createdAt) }}
            </span>
          </div>
        </NuxtLink>
      </div>

      <EmptyState
        v-else
        class="mt-6"
        icon="i-carbon-task"
        title="The queue is clear"
        description="There is nothing urgent on you right now. This is the moment to search deliberately or tighten one live relationship instead of opening too many threads."
      >
        <BaseButton to="/app/discover">
          Open discover
        </BaseButton>
      </EmptyState>
    </div>

    <details v-if="hasDetailQueues" class="panel overflow-hidden">
      <summary class="text-lg font-semibold p-6 cursor-pointer">
        View by category
      </summary>
      <div class="px-6 pb-6 gap-5 grid md:gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div class="gap-5 grid">
          <section v-if="incomingRequests.length" class="panel p-6">
            <div class="flex flex-wrap gap-3 items-start justify-between">
              <div class="max-w-2xl">
                <h2 class="text-lg font-semibold">
                  Inbound intros
                </h2>
                <p class="muted text-sm leading-6 mt-2">
                  Strong networks decay when good intros sit unanswered. Accept quickly when the fit is real, and decline explicitly when it is not.
                </p>
              </div>
              <BaseBadge :tone="incomingRequests.length ? 'warning' : 'neutral'">
                {{ incomingRequests.length }} pending
              </BaseBadge>
            </div>

            <ConnectRequestInbox
              v-if="incomingRequests.length"
              class="mt-5"
              mode="incoming"
              :items="incomingRequests"
              @accept="acceptConnectRequest"
              @decline="declineConnectRequest"
            />
          </section>

          <section v-if="unreadConversations.length" class="panel p-6">
            <div class="flex flex-wrap gap-3 items-start justify-between">
              <div class="max-w-2xl">
                <h2 class="text-lg font-semibold">
                  Conversations needing a reply
                </h2>
                <p class="muted text-sm leading-6 mt-2">
                  Once mutual interest exists, the biggest failure mode is drift. Keep the next step visible while the context is still fresh.
                </p>
              </div>
              <BaseBadge :tone="unreadConversations.length ? 'accent' : 'neutral'">
                {{ unreadConversations.length }} open
              </BaseBadge>
            </div>

            <div v-if="unreadConversations.length" class="mt-5 gap-4 grid lg:grid-cols-2">
              <ConversationCard
                v-for="conversation in unreadConversations"
                :key="conversation.id"
                :title="conversationTitle(conversation.id)"
                :preview="workspaceStore.getConversationPreview(conversation.id)?.body || 'No messages yet.'"
                :unread-count="conversation.unreadCountByUser[currentUserId] || 0"
                :href="`/app/messages/${conversation.id}`"
                :when="formatRelativeDate(conversation.lastMessageAt)"
              />
            </div>
          </section>
        </div>

        <div class="gap-4 grid">
          <section v-if="proposalsNeedingResponse.length" class="panel p-6">
            <div class="flex flex-wrap gap-3 items-start justify-between">
              <div class="max-w-xl">
                <h2 class="text-lg font-semibold">
                  Proposal decisions
                </h2>
                <p class="muted text-sm leading-6 mt-2">
                  These deal rooms have the latest version or status change on the other side, so the next move belongs to you.
                </p>
              </div>
              <BaseBadge :tone="proposalsNeedingResponse.length ? 'warning' : 'neutral'">
                {{ proposalsNeedingResponse.length }} waiting
              </BaseBadge>
            </div>

            <div v-if="proposalsNeedingResponse.length" class="mt-5 gap-4 grid">
              <ProposalCard
                v-for="proposal in proposalsNeedingResponse"
                :key="proposal.id"
                :proposal="proposal"
                :version="getCurrentProposalVersion(workspaceStore.data, proposal)"
                :href="`/app/proposals/${proposal.id}`"
              />
            </div>
          </section>

          <section v-if="contractsNeedingSignature.length" class="panel p-6">
            <div class="flex flex-wrap gap-3 items-start justify-between">
              <div class="max-w-xl">
                <h2 class="text-lg font-semibold">
                  Agreement signatures
                </h2>
                <p class="muted text-sm leading-6 mt-2">
                  Agreement drafts should not linger once the terms are already clear. Sign or revise while the intent is still current.
                </p>
              </div>
              <BaseBadge :tone="contractsNeedingSignature.length ? 'warning' : 'neutral'">
                {{ contractsNeedingSignature.length }} waiting
              </BaseBadge>
            </div>

            <div v-if="contractsNeedingSignature.length" class="mt-5 gap-4 grid">
              <ContractCard
                v-for="contract in contractsNeedingSignature"
                :key="contract.id"
                :contract="contract"
                :version="getCurrentContractVersion(workspaceStore.data, contract)"
                :href="`/app/contracts/${contract.id}`"
              />
            </div>
          </section>

          <section v-if="unreadNotifications.length" class="panel p-6">
            <div class="flex flex-wrap gap-3 items-start justify-between">
              <div class="max-w-xl">
                <h2 class="text-lg font-semibold">
                  Other updates
                </h2>
                <p class="muted text-sm leading-6 mt-2">
                  These are product events that still matter, but do not outrank a direct reply, proposal response, or required signature.
                </p>
              </div>
              <BaseBadge :tone="unreadNotifications.length ? 'accent' : 'neutral'">
                {{ unreadNotifications.length }} unread
              </BaseBadge>
            </div>

            <div v-if="unreadNotifications.length" class="mt-5 gap-3 grid">
              <NuxtLink
                v-for="notification in unreadNotifications"
                :key="notification.id"
                :to="notification.href"
                class="panel-inset p-4 block transition hover:-translate-y-0.5"
                @click="markNotificationRead(notification.id)"
              >
                <div class="flex gap-3 items-start justify-between">
                  <div class="min-w-0">
                    <p class="text-sm font-semibold">
                      {{ notification.title }}
                    </p>
                    <p class="muted text-sm leading-6 mt-2">
                      {{ notification.body }}
                    </p>
                  </div>
                  <span class="muted text-xs whitespace-nowrap">
                    {{ formatRelativeDate(notification.createdAt) }}
                  </span>
                </div>
              </NuxtLink>
            </div>
          </section>

          <section v-if="outgoingRequests.length" class="panel p-6">
            <div class="flex flex-wrap gap-3 items-start justify-between">
              <div class="max-w-xl">
                <h2 class="text-lg font-semibold">
                  Waiting on replies
                </h2>
                <p class="muted text-sm leading-6 mt-2">
                  These outbound intros are still live. Do not chase volume here; the better move is to keep new outreach precise.
                </p>
              </div>
              <BaseBadge :tone="outgoingRequests.length ? 'accent' : 'neutral'">
                {{ outgoingRequests.length }} open
              </BaseBadge>
            </div>

            <ConnectRequestInbox
              v-if="outgoingRequests.length"
              class="mt-5"
              mode="outgoing"
              :items="outgoingRequests"
              @accept="acceptConnectRequest"
              @decline="declineConnectRequest"
            />
          </section>
        </div>
      </div>
    </details>
  </div>
</template>
