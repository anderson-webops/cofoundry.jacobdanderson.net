<script setup lang="ts">
import type { MessageAttachment } from "~/shared/types/domain"
import { formatDate } from "~/shared/utils/format"
import { buildParticipantProfiles, getMessagesForConversation, getSubscriptionEntitlements } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Conversation")

const route = useRoute()
const toastStore = useToastStore()
const { authStore, subscription, workspaceStore } = useCurrentMember()

const conversation = computed(() => workspaceStore.data.conversations.find(item => item.id === route.params.id))
const messages = computed(() => conversation.value ? getMessagesForConversation(workspaceStore.data, conversation.value.id) : [])
const participants = computed(() => conversation.value ? buildParticipantProfiles(workspaceStore.data, conversation.value.participantIds) : [])
const otherParticipant = computed(() => participants.value.find(item => item.userId !== authStore.currentUser?.id) || null)
const entitlements = computed(() => getSubscriptionEntitlements(subscription.value || undefined))

const draftMessage = ref("")
const attachments = ref<MessageAttachment[]>([])
const proposalDialogOpen = ref(false)

watchEffect(() => {
  if (conversation.value && authStore.currentUser)
    workspaceStore.markConversationRead(conversation.value.id, authStore.currentUser.id)
})

watch(draftMessage, (value) => {
  if (!authStore.currentUser || !conversation.value)
    return

  workspaceStore.setTyping(conversation.value.id, authStore.currentUser.id, Boolean(value))
})

function captureFiles(event: Event) {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files || [])
  attachments.value = files.map(file => ({
    id: crypto.randomUUID(),
    name: file.name,
    url: "#",
    sizeLabel: `${Math.max(1, Math.round(file.size / 1024))} KB`,
  }))
}

function sendMessage() {
  if (!conversation.value || !authStore.currentUser || !draftMessage.value.trim())
    return

  workspaceStore.sendMessage(conversation.value.id, authStore.currentUser.id, draftMessage.value.trim(), attachments.value)
  workspaceStore.setTyping(conversation.value.id, authStore.currentUser.id, false)
  draftMessage.value = ""
  attachments.value = []
}

function createProposal(payload: any) {
  if (!conversation.value || !authStore.currentUser || !otherParticipant.value)
    return

  const opportunityId = workspaceStore.data.opportunities.find(item => item.ownerUserId === authStore.currentUser?.id)?.id
    || workspaceStore.data.opportunities.find(item => item.ownerUserId === otherParticipant.value?.userId)?.id
    || null

  const proposalId = workspaceStore.createProposal(
    authStore.currentUser.id,
    otherParticipant.value.userId,
    conversation.value.id,
    opportunityId,
    `${otherParticipant.value.displayName} collaboration proposal`,
    payload,
  )
  proposalDialogOpen.value = false
  toastStore.push({
    title: "Proposal sent",
    message: "The proposal was added to the workflow and logged in the conversation.",
    tone: "success",
  })
  navigateTo(`/app/proposals/${proposalId}`)
}
</script>

<template>
  <div v-if="conversation && otherParticipant" class="gap-6 grid xl:grid-cols-[320px_minmax(0,1fr)]">
    <section class="gap-4 grid">
      <PageIntro
        eyebrow="Conversation"
        :title="otherParticipant.displayName"
        :description="otherParticipant.headline"
      />
      <div class="panel p-5">
        <h2 class="text-lg font-semibold">
          Participant summary
        </h2>
        <p class="muted text-sm leading-6 mt-3">
          {{ otherParticipant.bio }}
        </p>
      </div>
      <div class="panel p-5">
        <h2 class="text-lg font-semibold">
          Workflow tools
        </h2>
        <p class="muted text-sm leading-6 mt-3">
          Proposal and contract workflow works best on Pro and Team plans.
        </p>
        <div class="mt-4 flex flex-wrap gap-3">
          <BaseButton @click="proposalDialogOpen = true">
            Create proposal
          </BaseButton>
          <BaseButton v-if="!entitlements.canUseProposals" variant="secondary" to="/app/billing">
            Upgrade plan
          </BaseButton>
        </div>
      </div>
    </section>

    <section class="panel flex flex-col min-h-[70vh] overflow-hidden">
      <div class="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold">
            {{ otherParticipant.displayName }}
          </p>
          <p class="muted text-sm">
            {{ conversation.typingByUserIds.includes(otherParticipant.userId) ? "Typing…" : "Matched conversation" }}
          </p>
        </div>
        <BaseButton variant="ghost" to="/app/proposals">
          Proposals
        </BaseButton>
      </div>

      <div class="px-5 py-5 flex-1 overflow-y-auto space-y-4">
        <div
          v-for="message in messages"
          :key="message.id"
          class="p-4 border rounded-[1.25rem] max-w-2xl"
          :class="message.senderUserId === authStore.currentUser?.id ? 'ml-auto border-transparent bg-[var(--accent-soft)]' : 'border-[var(--line)] bg-[var(--panel-strong)]'"
        >
          <p class="text-sm leading-7">
            {{ message.body }}
          </p>
          <div v-if="message.attachments.length" class="mt-3 flex flex-wrap gap-2">
            <span v-for="attachment in message.attachments" :key="attachment.id" class="pill">
              {{ attachment.name }} · {{ attachment.sizeLabel }}
            </span>
          </div>
          <p class="muted text-xs mt-3">
            {{ formatDate(message.createdAt) }}
          </p>
        </div>
      </div>

      <div class="p-5 border-t border-[var(--line)]">
        <TextareaInput v-model="draftMessage" label="Message" helper="Attachments are mocked in local mode and stored as metadata in the conversation." rows="4" />
        <div class="mt-4 flex flex-wrap gap-3 items-center justify-between">
          <input type="file" multiple class="muted text-sm" @change="captureFiles">
          <div class="flex gap-3">
            <BaseButton variant="secondary" @click="proposalDialogOpen = true">
              Proposal
            </BaseButton>
            <BaseButton @click="sendMessage">
              Send message
            </BaseButton>
          </div>
        </div>
      </div>
    </section>

    <BaseDialog v-model="proposalDialogOpen" title="Create proposal" description="Move the conversation into a structured collaboration proposal.">
      <ProposalEditorForm submit-label="Send proposal" @submitted="createProposal" />
    </BaseDialog>
  </div>

  <EmptyState
    v-else
    icon="i-carbon-chat"
    title="Conversation not found"
    description="This conversation may not exist or may not belong to your account."
  >
    <BaseButton to="/app/messages">
      Back to messages
    </BaseButton>
  </EmptyState>
</template>
