<script setup lang="ts">
import type { ProposalSectionKey, ProposalSectionState } from "~/shared/types/domain"
import { buildSubscriptionUsage, formatUsageQuota, getSubscriptionEntitlements } from "~/shared/utils/billing"
import { formatDate, formatProposalRelationshipType, formatProposalSectionKey, formatProposalSectionState, formatProposalStatus } from "~/shared/utils/format"
import { buildProposalSectionSummaries, buildProposalTermsSummary, buildProposalTimeline, buildProposalUnresolvedItems, getProposalStatusTone } from "~/shared/utils/proposals"
import { getCurrentProposalVersion, getProfileByUserId, getProposalById, getProposalComments, getProposalVersions } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Proposal detail")

const route = useRoute()
const toastStore = useToastStore()
const { authStore, subscription, workspaceStore } = useCurrentMember()

const proposalSections: ProposalSectionKey[] = [
  "partnership",
  "scope",
  "trial",
  "economics",
  "decision_rights",
  "ip_confidentiality",
  "exit",
]

const commentSectionOptions: { label: string, value: ProposalSectionKey }[] = proposalSections.map(section => ({
  label: formatProposalSectionKey(section),
  value: section,
}))

const proposal = computed(() => getProposalById(workspaceStore.data, route.params.id as string))
const version = computed(() => proposal.value ? getCurrentProposalVersion(workspaceStore.data, proposal.value) : undefined)
const versions = computed(() => proposal.value ? getProposalVersions(workspaceStore.data, proposal.value.id) : [])
const comments = computed(() => proposal.value ? getProposalComments(workspaceStore.data, proposal.value.id) : [])
const sections = computed(() => proposal.value && version.value ? buildProposalSectionSummaries(version.value, comments.value, proposal.value.status) : [])
const unresolvedSections = computed(() => buildProposalUnresolvedItems(sections.value))
const timeline = computed(() => proposal.value ? buildProposalTimeline(proposal.value, versions.value) : [])
const termsSummary = computed(() => version.value ? buildProposalTermsSummary(version.value) : [])
const authorProfile = computed(() => proposal.value ? getProfileByUserId(workspaceStore.data, proposal.value.createdByUserId) : null)
const recipientProfile = computed(() => proposal.value ? getProfileByUserId(workspaceStore.data, proposal.value.recipientUserId) : null)
const contractId = computed(() => workspaceStore.data.contracts.find(contract => contract.proposalId === route.params.id)?.id)
const entitlements = computed(() => getSubscriptionEntitlements(subscription.value || undefined))
const usage = computed(() => authStore.currentUser ? buildSubscriptionUsage(workspaceStore.data, authStore.currentUser.id, subscription.value || undefined) : null)

const commentBody = ref("")
const commentSection = ref<ProposalSectionKey>("partnership")
const counterDialogOpen = ref(false)

async function updateStatus(status: "accepted" | "rejected" | "viewed") {
  if (!proposal.value || !authStore.currentUser)
    return

  await workspaceStore.updateProposalStatus(proposal.value.id, status, authStore.currentUser.id)
  toastStore.push({
    title: "Proposal updated",
    message: `Proposal marked as ${status}.`,
    tone: "success",
  })
}

async function submitCounter(payload: any) {
  if (!proposal.value || !authStore.currentUser)
    return

  await workspaceStore.createProposalCounterVersion(proposal.value.id, authStore.currentUser.id, payload)
  counterDialogOpen.value = false
  toastStore.push({
    title: "Counter proposal saved",
    message: "A new version was created and logged in the conversation.",
    tone: "success",
  })
}

async function addComment() {
  if (!proposal.value || !version.value || !authStore.currentUser || !commentBody.value.trim())
    return

  await workspaceStore.addProposalComment(proposal.value.id, version.value.id, authStore.currentUser.id, commentSection.value, commentBody.value.trim())
  commentBody.value = ""
}

async function createContract() {
  if (!proposal.value || !authStore.currentUser)
    return

  if (usage.value?.contractDrafts.exhausted) {
    toastStore.push({
      title: "Agreement-draft limit reached",
      message: "This plan has already used its agreement-draft capacity for the month. Upgrade to keep moving accepted proposals into editable agreements.",
      tone: "warning",
    })
    return
  }

  const nextContractId = await workspaceStore.createContractFromProposal(proposal.value.id, authStore.currentUser.id)
  if (!nextContractId)
    return

  toastStore.push({
    title: "Contract draft created",
    message: "The accepted proposal now has an editable agreement draft.",
    tone: "success",
  })
  navigateTo(`/app/contracts/${nextContractId}`)
}

function sectionTone(state: ProposalSectionState) {
  if (state === "agreed")
    return "success"

  if (state === "countered")
    return "warning"

  return "neutral"
}

function contractQuotaText() {
  return usage.value ? formatUsageQuota(usage.value.contractDrafts) : ""
}
</script>

<template>
  <div v-if="proposal && version" class="gap-5 grid md:gap-6 xl:grid-cols-[0.86fr_1.14fr]">
    <section class="gap-5 grid">
      <PageIntro
        eyebrow="Deal room"
        :title="proposal.title"
        :description="`Between ${authorProfile?.displayName} and ${recipientProfile?.displayName}`"
      >
        <template #actions>
          <BaseBadge :tone="getProposalStatusTone(proposal.status)">
            {{ formatProposalStatus(proposal.status) }}
          </BaseBadge>
        </template>
      </PageIntro>

      <div class="panel p-5">
        <div class="flex gap-4 items-start justify-between">
          <div>
            <h2 class="text-lg font-semibold">
              Proposal actions
            </h2>
            <p class="muted text-sm leading-6 mt-3">
              Version {{ version.versionNumber }} · updated {{ formatDate(version.createdAt) }}.
            </p>
          </div>
          <BaseBadge tone="neutral">
            Version {{ version.versionNumber }}
          </BaseBadge>
        </div>
        <div v-if="usage?.contractDrafts.exhausted" class="surface-divider mt-4">
          <p class="text-sm font-semibold">
            Agreement draft limit reached
          </p>
          <p class="muted text-sm leading-6 mt-2">
            {{ contractQuotaText() }}. Upgrade before generating another agreement draft from this proposal.
          </p>
        </div>
        <div class="mt-5 flex flex-wrap gap-3">
          <BaseButton variant="secondary" @click="updateStatus('viewed')">
            Mark viewed
          </BaseButton>
          <BaseButton variant="secondary" @click="counterDialogOpen = true">
            Counter terms
          </BaseButton>
          <BaseButton @click="updateStatus('accepted')">
            Accept proposal
          </BaseButton>
          <BaseButton variant="danger" @click="updateStatus('rejected')">
            Reject
          </BaseButton>
          <BaseButton v-if="!contractId" variant="secondary" @click="createContract">
            {{ entitlements.canSignContracts ? "Generate agreement" : "Generate agreement preview" }}
          </BaseButton>
          <BaseButton v-else variant="secondary" :to="`/app/contracts/${contractId}`">
            Open agreement
          </BaseButton>
        </div>
      </div>

      <div class="panel p-5">
        <div class="flex gap-4 items-start justify-between">
          <div>
            <h2 class="text-lg font-semibold">
              Open terms
            </h2>
            <p class="muted text-sm leading-6 mt-2">
              These are the sections that still need explicit agreement before this should become a signed template.
            </p>
          </div>
          <BaseBadge :tone="unresolvedSections.length ? 'warning' : 'success'">
            {{ unresolvedSections.length ? `${unresolvedSections.length} active` : "Aligned" }}
          </BaseBadge>
        </div>
        <div v-if="unresolvedSections.length" class="surface-row-list mt-4">
          <div
            v-for="section in unresolvedSections"
            :key="section.id"
            class="surface-row"
          >
            <div class="flex gap-3 items-center justify-between">
              <p class="text-sm font-semibold">
                {{ section.title }}
              </p>
              <BaseBadge :tone="section.state === 'agreed' ? 'success' : section.state === 'countered' ? 'warning' : 'neutral'">
                {{ formatProposalSectionState(section.state) }}
              </BaseBadge>
            </div>
          </div>
        </div>
        <p v-else class="muted text-sm leading-6 mt-4">
          All tracked sections are aligned on the current version.
        </p>
      </div>

      <details class="panel p-5">
        <summary class="text-lg font-semibold cursor-pointer">
          Version history
        </summary>
        <div class="surface-row-list mt-4">
          <div v-for="entry in timeline" :key="entry.id" class="surface-row">
            <div class="flex gap-3 items-center justify-between">
              <div>
                <p class="text-sm font-semibold">
                  Version {{ entry.versionNumber }}
                </p>
                <p class="muted text-sm mt-1">
                  {{ entry.summary }}
                </p>
              </div>
              <BaseBadge :tone="entry.current ? 'accent' : 'neutral'">
                {{ entry.current ? "Current" : "History" }}
              </BaseBadge>
            </div>
            <p class="muted text-xs mt-3">
              {{ getProfileByUserId(workspaceStore.data, entry.createdByUserId)?.displayName }} · {{ formatDate(entry.createdAt) }}
            </p>
          </div>
        </div>
      </details>

      <details class="panel p-5">
        <summary class="text-lg font-semibold cursor-pointer">
          Clause comments
        </summary>
        <div class="surface-row-list mt-4">
          <div v-for="comment in comments" :key="comment.id" class="surface-row">
            <div class="flex gap-3 items-center justify-between">
              <p class="text-sm font-semibold">
                {{ getProfileByUserId(workspaceStore.data, comment.authorUserId)?.displayName }}
              </p>
              <BaseBadge tone="neutral">
                {{ formatProposalSectionKey(comment.section) }}
              </BaseBadge>
            </div>
            <p class="muted text-sm leading-6 mt-3">
              {{ comment.body }}
            </p>
          </div>
        </div>

        <div class="mt-5 gap-4 grid">
          <SelectInput v-model="commentSection" label="Section" :options="commentSectionOptions" />
          <TextareaInput
            v-model="commentBody"
            label="Add comment"
            helper="Keep comments attached to a real section so the version history stays useful."
            :rows="4"
          />
          <div class="flex justify-end">
            <BaseButton @click="addComment">
              Add comment
            </BaseButton>
          </div>
        </div>
      </details>
    </section>

    <section class="gap-5 grid">
      <div class="panel p-6">
        <div class="flex gap-4 items-start justify-between">
          <div>
            <p class="muted text-sm">
              Current proposal
            </p>
            <h2 class="text-xl font-semibold mt-2">
              {{ version.roleTitle }}
            </h2>
            <p class="muted text-sm mt-2">
              {{ formatProposalRelationshipType(version.relationshipType) }} · Updated {{ formatDate(version.createdAt) }}
            </p>
          </div>
        </div>

        <div class="surface-row-list mt-6 md:gap-x-6 md:grid md:grid-cols-2">
          <div v-for="item in termsSummary" :key="item.label" class="surface-row md:pr-4">
            <p class="text-sm font-semibold">
              {{ item.label }}
            </p>
            <p class="muted text-sm leading-6 mt-2">
              {{ item.value }}
            </p>
          </div>
        </div>
      </div>

      <div class="gap-4 grid">
        <article
          v-for="section in sections"
          :key="section.id"
          class="panel p-5"
        >
          <div class="flex gap-4 items-start justify-between">
            <div>
              <h3 class="text-lg font-semibold">
                {{ section.title }}
              </h3>
              <p class="muted text-sm leading-6 mt-3">
                {{ section.body }}
              </p>
            </div>
            <BaseBadge :tone="sectionTone(section.state)">
              {{ formatProposalSectionState(section.state) }}
            </BaseBadge>
          </div>
          <ul v-if="section.supporting.length" class="muted text-sm leading-6 mt-4 gap-2 grid">
            <li v-for="item in section.supporting" :key="item">
              {{ item }}
            </li>
          </ul>
          <p v-if="section.commentCount" class="muted text-xs mt-4">
            {{ section.commentCount }} clause comment{{ section.commentCount > 1 ? "s" : "" }} on the current version.
          </p>
        </article>
      </div>
    </section>

    <BaseDialog v-model="counterDialogOpen" title="Counter proposal" description="Create a new version while preserving the full negotiation history.">
      <ProposalEditorForm
        :initial-values="version"
        submit-label="Create counter"
        @submitted="submitCounter"
      />
    </BaseDialog>
  </div>

  <EmptyState
    v-else
    icon="i-carbon-document-signed"
    title="Proposal not found"
    description="The proposal may have been removed or the route is incorrect."
  >
    <BaseButton to="/app/proposals">
      Back to proposals
    </BaseButton>
  </EmptyState>
</template>
