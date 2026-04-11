<script setup lang="ts">
import { formatDate } from "~/shared/utils/format"
import { getCurrentProposalVersion, getProfileByUserId, getProposalById } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Proposal detail")

const route = useRoute()
const toastStore = useToastStore()
const { authStore, workspaceStore } = useCurrentMember()

const proposal = computed(() => getProposalById(workspaceStore.data, route.params.id as string))
const version = computed(() => proposal.value ? getCurrentProposalVersion(workspaceStore.data, proposal.value) : undefined)
const comments = computed(() => workspaceStore.data.proposalComments.filter(comment => comment.proposalId === route.params.id))
const authorProfile = computed(() => proposal.value ? getProfileByUserId(workspaceStore.data, proposal.value.createdByUserId) : null)
const recipientProfile = computed(() => proposal.value ? getProfileByUserId(workspaceStore.data, proposal.value.recipientUserId) : null)
const contractId = computed(() => workspaceStore.data.contracts.find(contract => contract.proposalId === route.params.id)?.id)

const commentBody = ref("")
const commentSection = ref("general")
const counterDialogOpen = ref(false)

function updateStatus(status: "accepted" | "rejected" | "viewed") {
  if (!proposal.value || !authStore.currentUser)
    return

  workspaceStore.updateProposalStatus(proposal.value.id, status, authStore.currentUser.id)
  toastStore.push({
    title: "Proposal updated",
    message: `Proposal marked as ${status}.`,
    tone: "success",
  })
}

function submitCounter(payload: any) {
  if (!proposal.value || !authStore.currentUser)
    return

  workspaceStore.createProposalCounterVersion(proposal.value.id, authStore.currentUser.id, payload)
  counterDialogOpen.value = false
  toastStore.push({
    title: "Counter proposal saved",
    message: "A new version was created and logged in the conversation.",
    tone: "success",
  })
}

function addComment() {
  if (!proposal.value || !version.value || !authStore.currentUser || !commentBody.value.trim())
    return

  workspaceStore.addProposalComment(proposal.value.id, version.value.id, authStore.currentUser.id, commentSection.value, commentBody.value.trim())
  commentBody.value = ""
}

function createContract() {
  if (!proposal.value)
    return

  const nextContractId = workspaceStore.createContractFromProposal(proposal.value.id)
  if (!nextContractId)
    return

  toastStore.push({
    title: "Contract draft created",
    message: "The accepted proposal now has an editable agreement draft.",
    tone: "success",
  })
  navigateTo(`/app/contracts/${nextContractId}`)
}
</script>

<template>
  <div v-if="proposal && version" class="gap-6 grid xl:grid-cols-[0.9fr_1.1fr]">
    <section class="gap-4 grid">
      <PageIntro
        eyebrow="Proposal"
        :title="proposal.title"
        :description="`From ${authorProfile?.displayName} to ${recipientProfile?.displayName}`"
      >
        <template #actions>
          <BaseBadge tone="accent">
            {{ proposal.status }}
          </BaseBadge>
        </template>
      </PageIntro>

      <div class="panel p-5">
        <h2 class="text-lg font-semibold">
          Quick actions
        </h2>
        <div class="mt-4 flex flex-wrap gap-3">
          <BaseButton variant="secondary" @click="updateStatus('viewed')">
            Mark viewed
          </BaseButton>
          <BaseButton variant="secondary" @click="counterDialogOpen = true">
            Counter
          </BaseButton>
          <BaseButton @click="updateStatus('accepted')">
            Accept
          </BaseButton>
          <BaseButton variant="danger" @click="updateStatus('rejected')">
            Reject
          </BaseButton>
          <BaseButton v-if="!contractId" variant="secondary" @click="createContract">
            Generate contract
          </BaseButton>
          <BaseButton v-else variant="secondary" :to="`/app/contracts/${contractId}`">
            Open contract
          </BaseButton>
        </div>
      </div>

      <div class="panel p-5">
        <h2 class="text-lg font-semibold">
          Comments
        </h2>
        <div class="mt-4 gap-3 grid">
          <div v-for="comment in comments" :key="comment.id" class="panel-inset p-4">
            <div class="flex gap-3 items-center justify-between">
              <p class="text-sm font-semibold">
                {{ getProfileByUserId(workspaceStore.data, comment.authorUserId)?.displayName }}
              </p>
              <BaseBadge tone="neutral">
                {{ comment.section }}
              </BaseBadge>
            </div>
            <p class="muted text-sm leading-6 mt-3">
              {{ comment.body }}
            </p>
          </div>
        </div>

        <div class="mt-5 gap-4 grid">
          <TextInput v-model="commentSection" label="Section" />
          <TextareaInput v-model="commentBody" label="Add comment" rows="4" />
          <div class="flex justify-end">
            <BaseButton @click="addComment">
              Add comment
            </BaseButton>
          </div>
        </div>
      </div>
    </section>

    <section class="panel p-6">
      <h2 class="text-xl font-semibold">
        Version {{ version.versionNumber }}
      </h2>
      <p class="muted text-sm mt-2">
        Last updated {{ formatDate(version.createdAt) }}
      </p>

      <div class="text-sm leading-7 mt-6 gap-5 grid">
        <div>
          <h3 class="font-semibold">
            Role title
          </h3>
          <p class="muted mt-2">
            {{ version.roleTitle }}
          </p>
        </div>
        <div>
          <h3 class="font-semibold">
            Responsibilities
          </h3>
          <ul class="muted mt-2 gap-2 grid">
            <li v-for="responsibility in version.responsibilities" :key="responsibility">
              {{ responsibility }}
            </li>
          </ul>
        </div>
        <div class="gap-4 grid md:grid-cols-2">
          <div class="panel-inset p-4">
            <p class="font-semibold">
              Cash compensation
            </p>
            <p class="muted mt-2">
              {{ version.cashCompensation }}
            </p>
          </div>
          <div class="panel-inset p-4">
            <p class="font-semibold">
              Equity
            </p>
            <p class="muted mt-2">
              {{ version.equity }}
            </p>
          </div>
        </div>
        <div>
          <h3 class="font-semibold">
            Decision rights
          </h3>
          <p class="muted mt-2">
            {{ version.decisionRights }}
          </p>
        </div>
        <div>
          <h3 class="font-semibold">
            Confidentiality and exit
          </h3>
          <p class="muted mt-2">
            {{ version.confidentiality }}
          </p>
          <p class="muted mt-3">
            {{ version.exitTerms }}
          </p>
        </div>
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
