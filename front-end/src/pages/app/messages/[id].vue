<script setup lang="ts">
import type { MessageAttachment } from "~/shared/types/domain"
import { buildSubscriptionUsage, formatUsageQuota, getSubscriptionEntitlements } from "~/shared/utils/billing"
import { formatContactRevealStage, formatDate, formatProposalRelationshipType, formatProposalStatus } from "~/shared/utils/format"
import { buildConversationRiskFlags, buildMessageRiskFlags, canOpenProposalWorkflow } from "~/shared/utils/formation"
import { buildParticipantProfiles, getCurrentProposalVersion, getMatchByConversation, getMessagesForConversation, getProfileByUserId, getProposalByConversation, getTrialForMatch } from "~/shared/utils/workspace"

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
const currentProfile = computed(() => authStore.currentUser ? getProfileByUserId(workspaceStore.data, authStore.currentUser.id) : null)
const entitlements = computed(() => getSubscriptionEntitlements(subscription.value || undefined))
const usage = computed(() => authStore.currentUser ? buildSubscriptionUsage(workspaceStore.data, authStore.currentUser.id, subscription.value || undefined) : null)
const match = computed(() => conversation.value ? getMatchByConversation(workspaceStore.data, conversation.value.id) : undefined)
const trial = computed(() => match.value ? getTrialForMatch(workspaceStore.data, match.value.id) : undefined)
const proposal = computed(() => conversation.value ? getProposalByConversation(workspaceStore.data, conversation.value.id) : undefined)
const proposalVersion = computed(() => proposal.value ? getCurrentProposalVersion(workspaceStore.data, proposal.value) : undefined)
const incomingMessages = computed(() => messages.value.filter(message => message.senderUserId && message.senderUserId !== authStore.currentUser?.id))
const latestIncomingMessage = computed(() => incomingMessages.value.at(-1))
const conversationFlags = computed(() => buildConversationRiskFlags(incomingMessages.value))

const draftMessage = ref("")
const attachments = ref<MessageAttachment[]>([])
const proposalDialogOpen = ref(false)
const profileReportDialogOpen = ref(false)
const messageReportDialogOpen = ref(false)
const draftFlags = computed(() => buildMessageRiskFlags(draftMessage.value))
const proposalGateOpen = computed(() => currentProfile.value && otherParticipant.value ? canOpenProposalWorkflow(currentProfile.value, otherParticipant.value) : false)

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

async function sendMessage() {
  if (!conversation.value || !authStore.currentUser || !draftMessage.value.trim())
    return

  await workspaceStore.sendMessage(conversation.value.id, authStore.currentUser.id, draftMessage.value.trim(), attachments.value)
  workspaceStore.setTyping(conversation.value.id, authStore.currentUser.id, false)
  draftMessage.value = ""
  attachments.value = []
}

async function createProposal(payload: any) {
  if (!conversation.value || !authStore.currentUser || !otherParticipant.value)
    return

  if (!currentProfile.value || !proposalGateOpen.value) {
    toastStore.push({
      title: "Alignment check incomplete",
      message: "Both sides need commitment, governance, and IP readiness filled out before a new proposal can be sent.",
      tone: "warning",
    })
    return
  }

  if (usage.value?.proposals.exhausted) {
    toastStore.push({
      title: "Proposal-send limit reached",
      message: "This plan has reached its monthly proposal-send capacity. Upgrade to keep running structured deal rooms without pausing the search.",
      tone: "warning",
    })
    return
  }

  const opportunityId = workspaceStore.data.opportunities.find(item => item.ownerUserId === authStore.currentUser?.id)?.id
    || workspaceStore.data.opportunities.find(item => item.ownerUserId === otherParticipant.value?.userId)?.id
    || null

  const proposalId = await workspaceStore.createProposal(
    authStore.currentUser.id,
    otherParticipant.value.userId,
    conversation.value.id,
    opportunityId,
    `${otherParticipant.value.displayName} collaboration proposal`,
    payload,
  )
  if (!proposalId)
    return

  proposalDialogOpen.value = false
  toastStore.push({
    title: "Proposal sent",
    message: "The proposal was added and logged in the conversation.",
    tone: "success",
  })
  navigateTo(`/app/proposals/${proposalId}`)
}

async function startTrial() {
  if (!authStore.currentUser || !match.value)
    return

  await workspaceStore.startTrialCollaboration(match.value.id, authStore.currentUser.id)
  toastStore.push({
    title: "Trial started",
    message: "The conversation now has a structured trial-collaboration sprint attached to it.",
    tone: "success",
  })
}

async function acknowledgeTrial() {
  if (!authStore.currentUser || !trial.value)
    return

  await workspaceStore.acknowledgeTrialCollaboration(trial.value.id, authStore.currentUser.id)
  toastStore.push({
    title: "Trial acknowledged",
    message: "Your acknowledgement was recorded on the sprint plan.",
    tone: "success",
  })
}

function onProfileReportCreated() {
  toastStore.push({
    title: "Profile reported",
    message: "The moderation queue now has the relevant trust and conversation context.",
    tone: "success",
  })
}

function onMessageReportCreated() {
  toastStore.push({
    title: "Message reported",
    message: "The message was added to the moderation queue for review.",
    tone: "success",
  })
}

function openProposalWorkflow() {
  if (proposal.value)
    return

  if (!proposalGateOpen.value) {
    toastStore.push({
      title: "Alignment check incomplete",
      message: "Add commitment, governance, and IP readiness details on both profiles before opening a new deal room.",
      tone: "warning",
    })
    return
  }

  if (usage.value?.proposals.exhausted) {
    toastStore.push({
      title: "Proposal-send limit reached",
      message: "Free keeps a small number of structured proposal sends available. Upgrade when you need a higher-velocity search process.",
      tone: "warning",
    })
    return
  }

  if (!proposal.value)
    proposalDialogOpen.value = true
}

function quotaText(key: "proposals" | "contractDrafts") {
  const quota = usage.value?.[key]
  return quota ? formatUsageQuota(quota) : ""
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
          Trust and intent
        </h2>
        <div class="mt-4">
          <TrustSignalStrip :profile="otherParticipant" />
        </div>
        <div class="muted text-sm leading-6 mt-4 gap-2 grid">
          <div>Contact reveal rule: {{ formatContactRevealStage(otherParticipant.privacy.contactRevealStage) }}</div>
          <div>Keep sensitive information on-platform until that gate is satisfied.</div>
        </div>
        <p class="muted text-sm leading-6 mt-4">
          {{ otherParticipant.bio }}
        </p>
        <div class="mt-4">
          <BaseButton variant="ghost" @click="profileReportDialogOpen = true">
            Report profile
          </BaseButton>
        </div>
      </div>
      <SafetyFlagsPanel :flags="conversationFlags" title="Conversation warning" />
      <FirstCallAgenda :profile="otherParticipant" />
      <AlignmentCheckPanel v-if="currentProfile" :current-profile="currentProfile" :counterpart-profile="otherParticipant" />
      <div class="panel p-5">
        <h2 class="text-lg font-semibold">
          Proposal and agreement tools
        </h2>
        <p class="muted text-sm leading-6 mt-3">
          Free keeps the proposal and agreement tools visible, but the higher-intent actions are metered. Use the first call and trial sprint to qualify the relationship, then spend proposal and agreement capacity where the fit is real.
        </p>
        <div v-if="usage" class="mt-4 gap-3 grid">
          <div class="panel-inset p-4">
            <p class="text-sm font-semibold">
              Proposal sends
            </p>
            <p class="muted text-sm leading-6 mt-2">
              {{ quotaText("proposals") }}. Deal rooms are metered because they mark the point where a conversation turns into real terms.
            </p>
          </div>
          <div class="panel-inset p-4">
            <p class="text-sm font-semibold">
              Agreement drafts
            </p>
            <p class="muted text-sm leading-6 mt-2">
              {{ quotaText("contractDrafts") }}. Free can preview agreement drafts, while Pro and Team unlock signature-ready agreements and print-friendly export.
            </p>
          </div>
        </div>
        <div v-if="proposal && proposalVersion" class="panel-inset mt-4 p-4">
          <div class="flex gap-3 items-start justify-between">
            <div>
              <p class="text-sm font-semibold">
                Active deal room
              </p>
              <p class="muted text-sm leading-6 mt-2">
                {{ proposal.title }}
              </p>
            </div>
            <BaseBadge :tone="proposal.status === 'accepted' ? 'success' : proposal.status === 'countered' ? 'warning' : 'accent'">
              {{ formatProposalStatus(proposal.status) }}
            </BaseBadge>
          </div>
          <div class="muted text-sm leading-6 mt-3 gap-1 grid">
            <div>{{ formatProposalRelationshipType(proposalVersion.relationshipType) }} · {{ proposalVersion.roleTitle }}</div>
            <div>{{ proposalVersion.equity }} · {{ proposalVersion.cashCompensation }}</div>
          </div>
        </div>
        <div v-if="trial" class="mt-4">
          <TrialCollaborationCard :trial="trial" :acknowledged="trial.acknowledgedByUserIds.includes(authStore.currentUser!.id)">
            <div class="flex flex-wrap gap-3">
              <BaseButton
                v-if="!trial.acknowledgedByUserIds.includes(authStore.currentUser!.id)"
                variant="secondary"
                @click="acknowledgeTrial"
              >
                Acknowledge trial
              </BaseButton>
              <BaseButton variant="secondary" to="/app/matches">
                Match details
              </BaseButton>
            </div>
          </TrialCollaborationCard>
        </div>
        <div class="mt-4 flex flex-wrap gap-3">
          <BaseButton v-if="!trial" variant="secondary" @click="startTrial">
            Start trial
          </BaseButton>
          <BaseButton v-if="proposal" :to="`/app/proposals/${proposal.id}`">
            Open deal room
          </BaseButton>
          <BaseButton v-else @click="openProposalWorkflow">
            {{ proposalGateOpen ? "Create proposal" : "Finish alignment check" }}
          </BaseButton>
          <BaseButton v-if="usage?.proposals.exhausted || !entitlements.canSignContracts" variant="secondary" to="/app/billing">
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
        <BaseButton variant="ghost" :to="proposal ? `/app/proposals/${proposal.id}` : '/app/proposals'">
          {{ proposal ? "Deal room" : "Proposals" }}
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
        <TextareaInput v-model="draftMessage" label="Message" helper="Attachments are mocked in local mode and stored as metadata in the conversation." :rows="4" />
        <div class="mt-4">
          <SafetyFlagsPanel :flags="draftFlags" title="Draft warning" />
        </div>
        <div class="mt-4 flex flex-wrap gap-3 items-center justify-between">
          <input type="file" multiple class="muted text-sm" @change="captureFiles">
          <div class="flex gap-3">
            <BaseButton v-if="latestIncomingMessage" variant="ghost" @click="messageReportDialogOpen = true">
              Report message
            </BaseButton>
            <BaseButton
              variant="secondary"
              :to="proposal ? `/app/proposals/${proposal.id}` : undefined"
              @click="openProposalWorkflow"
            >
              {{ proposal ? "Open deal room" : proposalGateOpen ? "Proposal" : "Alignment gate" }}
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

    <ReportIssueDialog
      v-model="profileReportDialogOpen"
      title="Report profile"
      target-type="profile"
      :target-id="otherParticipant.id"
      :subject-label="otherParticipant.displayName"
      description="Use this for impersonation, solicitation, or any profile that feels misleading or unsafe."
      @created="onProfileReportCreated"
    />

    <ReportIssueDialog
      v-if="latestIncomingMessage"
      v-model="messageReportDialogOpen"
      title="Report message"
      target-type="message"
      :target-id="latestIncomingMessage.id"
      :subject-label="`latest message from ${otherParticipant.displayName}`"
      description="Use this when a message asks for fees, pushes you off-platform too quickly, or appears impersonation-related."
      @created="onMessageReportCreated"
    />
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
