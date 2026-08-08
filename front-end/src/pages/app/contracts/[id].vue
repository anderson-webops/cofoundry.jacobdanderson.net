<script setup lang="ts">
import type {
  ContractLegalReview,
  ContractLegalReviewerType,
  ContractLegalReviewScope,
  ContractVersionPayload,
} from "~/shared/types/domain"
import type { ContractRedlineChange } from "~/shared/utils/contract-documents"
import { hasPaidContractWorkflowSponsor } from "~/shared/utils/billing"
import { formatDate } from "~/shared/utils/format"
import {
  formatContractLegalReviewerType,
  formatContractLegalReviewScope,
  formatContractLegalReviewStatus,
  hasBlockingContractLegalReview,
} from "~/shared/utils/legal-reviews"
import { buildProposalTermsSummary } from "~/shared/utils/proposals"
import { getRelationshipHrefForContract } from "~/shared/utils/relationships"
import { contractSignatureSchema } from "~/shared/utils/validation"
import { getContractById, getCurrentContractVersion, getCurrentProposalVersion, getProposalById } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Contract detail")

const route = useRoute()
const toastStore = useToastStore()
const { authStore, workspaceStore } = useCurrentMember()

const contract = computed(() => getContractById(workspaceStore.data, route.params.id as string))
const version = computed(() => contract.value ? getCurrentContractVersion(workspaceStore.data, contract.value) : undefined)
const proposal = computed(() => contract.value ? getProposalById(workspaceStore.data, contract.value.proposalId) : undefined)
const proposalVersion = computed(() => proposal.value ? getCurrentProposalVersion(workspaceStore.data, proposal.value) : undefined)
const proposalSummary = computed(() => proposalVersion.value ? buildProposalTermsSummary(proposalVersion.value) : [])
const signatures = computed(() => workspaceStore.data.signatures.filter(signature =>
  signature.contractId === route.params.id && signature.contractVersionId === version.value?.id,
))
const relationshipHref = computed(() => contract.value && authStore.currentUser ? getRelationshipHrefForContract(workspaceStore.data, authStore.currentUser.id, contract.value.id) : null)
const previewOnly = computed(() => !contract.value || !hasPaidContractWorkflowSponsor(workspaceStore.data, contract.value))
const editDialogOpen = ref(false)
const editPending = ref(false)
const legalReviewDialogOpen = ref(false)
const legalReviewPending = ref(false)
const legalReviewsLoading = ref(true)
const legalReviews = ref<ContractLegalReview[]>([])
const lastInviteUrl = ref("")
const redlineOpen = ref(false)
const redlinePending = ref(false)
const redlineChanges = ref<ContractRedlineChange[]>([])
const signatureName = ref("")
const signatureError = ref("")
const signaturePending = ref(false)
const currentLegalReviews = computed(() => legalReviews.value.filter(review => review.contractVersionId === version.value?.id))
const priorLegalReviews = computed(() => legalReviews.value.filter(review => review.contractVersionId !== version.value?.id))
const hasCurrentUserSigned = computed(() => signatures.value.some(signature => signature.userId === authStore.currentUser?.id))
const blockingLegalReview = computed(() => version.value
  ? hasBlockingContractLegalReview(legalReviews.value, version.value.id)
  : false)

interface LegalReviewRequestPayload {
  message: string
  reviewerEmail: string
  reviewerName: string
  reviewerOrganization: string
  reviewerType: ContractLegalReviewerType
  scope: ContractLegalReviewScope[]
  shareAuthorized: true
}

function errorMessage(error: unknown, fallback: string) {
  const payload = error as { data?: { message?: string }, statusMessage?: string }
  return payload.data?.message || payload.statusMessage || fallback
}

function legalReviewTone(status: ContractLegalReview["status"]) {
  if (status === "approved")
    return "success" as const
  if (status === "changes_requested")
    return "warning" as const
  if (["canceled", "superseded", "expired"].includes(status))
    return "neutral" as const
  return "accent" as const
}

function contractVersionLabel(contractVersionId: string) {
  const item = workspaceStore.data.contractVersions.find(candidate => candidate.id === contractVersionId)
  return item ? `Version ${item.versionNumber}` : "Prior version"
}

async function loadLegalReviews() {
  if (!contract.value)
    return

  legalReviewsLoading.value = true
  try {
    const response = await $fetch<{ reviews: ContractLegalReview[] }>(`/api/contracts/${contract.value.id}/legal-reviews`)
    legalReviews.value = response.reviews
  }
  catch (error: unknown) {
    toastStore.push({
      title: "Legal review status unavailable",
      message: errorMessage(error, "The agreement loaded, but its legal review history could not be refreshed."),
      tone: "warning",
    })
  }
  finally {
    legalReviewsLoading.value = false
  }
}

function printContract() {
  if (previewOnly.value) {
    toastStore.push({
      title: "Paid sponsor required",
      message: "Printing unlocks when either agreement participant has an active Pro or Team plan.",
      tone: "warning",
    })
    return
  }

  if (import.meta.client)
    window.print()
}

function downloadContract() {
  if (!contract.value)
    return

  if (previewOnly.value) {
    toastStore.push({
      title: "Paid sponsor required",
      message: "Agreement export unlocks when either participant has an active Pro or Team plan.",
      tone: "warning",
    })
    return
  }

  if (import.meta.client)
    window.location.assign(`/api/contracts/${contract.value.id}/export`)
}

function downloadCertificate() {
  if (!contract.value)
    return

  if (previewOnly.value) {
    toastStore.push({
      title: "Paid sponsor required",
      message: "Agreement certificates unlock when either participant has an active Pro or Team plan.",
      tone: "warning",
    })
    return
  }

  if (import.meta.client)
    window.location.assign(`/api/contracts/${contract.value.id}/certificate`)
}

async function loadRedline() {
  if (!contract.value)
    return

  redlinePending.value = true

  try {
    const response = await $fetch<{ changes: ContractRedlineChange[] }>(`/api/contracts/${contract.value.id}/redline`)
    redlineChanges.value = response.changes
    redlineOpen.value = true
  }
  catch (error: unknown) {
    toastStore.push({
      title: "Redline unavailable",
      message: errorMessage(error, "The version comparison could not be loaded."),
      tone: "danger",
    })
  }
  finally {
    redlinePending.value = false
  }
}

async function saveContractVersion(payload: ContractVersionPayload) {
  if (!contract.value || !authStore.currentUser)
    return

  editPending.value = true
  try {
    const contractVersionId = await workspaceStore.updateContractVersion(contract.value.id, payload, authStore.currentUser.id)
    if (!contractVersionId)
      throw new Error("The agreement revision was not persisted.")
    editDialogOpen.value = false
    redlineOpen.value = false
    lastInviteUrl.value = ""
    await loadLegalReviews()
    toastStore.push({
      title: "Agreement updated",
      message: "A new authoritative version was saved. Earlier signatures and legal reviews remain attached to their original version.",
      tone: "success",
    })
  }
  catch (error: unknown) {
    toastStore.push({
      title: "Agreement not updated",
      message: errorMessage(error, "The new agreement version could not be saved."),
      tone: "danger",
    })
  }
  finally {
    editPending.value = false
  }
}

async function requestLegalReview(payload: LegalReviewRequestPayload) {
  if (!contract.value)
    return

  legalReviewPending.value = true
  try {
    const response = await $fetch<{
      delivery: "manual" | "sent"
      inviteUrl: string
      review: ContractLegalReview
    }>(`/api/contracts/${contract.value.id}/legal-reviews`, {
      body: payload,
      method: "POST",
    })
    legalReviews.value = [response.review, ...legalReviews.value]
    lastInviteUrl.value = response.inviteUrl
    legalReviewDialogOpen.value = false
    toastStore.push({
      title: response.delivery === "sent" ? "Review invite sent" : "Review invite ready",
      message: response.delivery === "sent"
        ? `A version-bound review link was sent to ${response.review.reviewerEmail}.`
        : "Email delivery is not configured or did not complete. Use the secure copy-link action to share the invite manually.",
      tone: response.delivery === "sent" ? "success" : "warning",
    })
  }
  catch (error: unknown) {
    toastStore.push({
      title: "Review not requested",
      message: errorMessage(error, "The legal review invite could not be created."),
      tone: "danger",
    })
  }
  finally {
    legalReviewPending.value = false
  }
}

async function cancelLegalReview(review: ContractLegalReview) {
  if (!contract.value)
    return

  try {
    const response = await $fetch<{ review: ContractLegalReview }>(`/api/contracts/${contract.value.id}/legal-reviews/${review.id}/cancel`, {
      body: {},
      method: "POST",
    })
    legalReviews.value = legalReviews.value.map(item => item.id === review.id ? response.review : item)
    if (lastInviteUrl.value)
      lastInviteUrl.value = ""
    toastStore.push({
      title: "Review canceled",
      message: "The bearer link no longer authorizes review access.",
      tone: "success",
    })
  }
  catch (error: unknown) {
    toastStore.push({
      title: "Review not canceled",
      message: errorMessage(error, "The legal review could not be canceled."),
      tone: "danger",
    })
  }
}

async function resendLegalReview(review: ContractLegalReview) {
  if (!contract.value)
    return

  try {
    const response = await $fetch<{ delivery: "manual" | "sent", inviteUrl: string }>(`/api/contracts/${contract.value.id}/legal-reviews/${review.id}/resend`, {
      body: {},
      method: "POST",
    })
    lastInviteUrl.value = response.inviteUrl
    toastStore.push({
      title: response.delivery === "sent" ? "Invite resent" : "Share link ready",
      message: response.delivery === "sent"
        ? `The review invite was sent again to ${review.reviewerEmail}.`
        : "Use the copy-link action to share this confidential invite manually.",
      tone: response.delivery === "sent" ? "success" : "warning",
    })
  }
  catch (error: unknown) {
    toastStore.push({
      title: "Invite not resent",
      message: errorMessage(error, "The review invite could not be resent."),
      tone: "danger",
    })
  }
}

async function copyInviteLink() {
  if (!lastInviteUrl.value || !import.meta.client)
    return

  try {
    await navigator.clipboard.writeText(lastInviteUrl.value)
    toastStore.push({
      title: "Secure link copied",
      message: "Share it only with the named reviewer. Anyone holding the link can open this agreement version until it expires or is canceled.",
      tone: "success",
    })
  }
  catch {
    toastStore.push({
      title: "Copy unavailable",
      message: "Your browser did not allow clipboard access. Select the invite link manually.",
      tone: "warning",
    })
  }
}

async function signContract() {
  signatureError.value = ""
  const parsed = contractSignatureSchema.safeParse({ typedName: signatureName.value })
  if (!parsed.success) {
    signatureError.value = parsed.error.issues[0]?.message || "Type your full name to sign."
    return
  }

  if (!contract.value || !authStore.currentUser)
    return

  if (previewOnly.value) {
    toastStore.push({
      title: "Paid sponsor required",
      message: "Typed signatures unlock when either agreement participant has an active Pro or Team plan.",
      tone: "warning",
    })
    return
  }

  if (blockingLegalReview.value) {
    toastStore.push({
      title: "Legal review is active",
      message: "Complete or cancel the current version's legal review before signing.",
      tone: "warning",
    })
    return
  }

  signaturePending.value = true
  try {
    await workspaceStore.signContract(contract.value.id, authStore.currentUser.id, parsed.data.typedName)
    signatureName.value = ""
    toastStore.push({
      title: "Agreement signed",
      message: "Your signature was added to the current version with a timestamp.",
      tone: "success",
    })
  }
  catch (error: unknown) {
    toastStore.push({
      title: "Signature not recorded",
      message: errorMessage(error, "The agreement changed or could not accept your signature. Refresh and review the current version before trying again."),
      tone: "danger",
    })
  }
  finally {
    signaturePending.value = false
  }
}

onMounted(loadLegalReviews)
watch(() => workspaceStore.lastSyncedAt, (current, previous) => {
  if (current && current !== previous)
    void loadLegalReviews()
})
</script>

<template>
  <div v-if="contract && version" class="gap-6 grid xl:grid-cols-[0.85fr_1.15fr]">
    <section class="gap-4 grid">
      <PageIntro
        eyebrow="Contract"
        :title="contract.title"
        description="Editable agreement template generated from proposal terms."
      >
        <template #actions>
          <BaseButton v-if="relationshipHref" variant="secondary" :to="relationshipHref">
            Relationship workspace
          </BaseButton>
          <BaseBadge :tone="contract.status === 'signed' ? 'success' : 'accent'">
            {{ contract.status }}
          </BaseBadge>
        </template>
      </PageIntro>

      <div class="surface-row">
        <p class="muted text-sm leading-7">
          This contract is a startup template. It is not legal advice, does not create an attorney-client relationship, and should be reviewed by counsel before execution.
        </p>
        <p class="muted text-sm leading-7 mt-3">
          Paid plans can download a print-ready agreement packet and a completion certificate with the agreement hash and typed-signature evidence.
        </p>
        <p v-if="previewOnly" class="muted text-sm leading-7 mt-3">
          This agreement is currently in preview mode because neither participant is sponsoring it with an active Pro or Team plan. You can review its structure and terms, but revisions, legal-review handoffs, exports, and signatures remain locked.
        </p>
      </div>

      <details v-if="proposal && proposalSummary.length" class="panel-inset p-5">
        <summary class="text-lg font-semibold cursor-pointer">
          Staged proposal snapshot
        </summary>
        <p class="muted text-sm leading-7 mt-3">
          Source terms for this agreement draft.
        </p>
        <div class="surface-row-list mt-4">
          <div v-for="item in proposalSummary" :key="item.label" class="surface-row">
            <p class="text-sm font-semibold">
              {{ item.label }}
            </p>
            <p class="muted text-sm leading-6 mt-2">
              {{ item.value }}
            </p>
          </div>
        </div>
      </details>

      <div class="panel p-5">
        <div class="flex flex-wrap gap-4 items-start justify-between">
          <div>
            <h2 class="text-lg font-semibold">
              Legal review
            </h2>
            <p class="muted text-sm leading-6 mt-2 max-w-xl">
              Invite in-house or outside counsel to this exact agreement version. An active review pauses signatures until it is completed, canceled, expired, or superseded.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <BaseButton size="sm" variant="secondary" to="/app/legal">
              Find or choose counsel
            </BaseButton>
            <BaseButton size="sm" :disabled="previewOnly" @click="legalReviewDialogOpen = true">
              {{ previewOnly ? "Paid sponsor required" : "Request review" }}
            </BaseButton>
          </div>
        </div>

        <div v-if="legalReviewsLoading" class="muted text-sm mt-5" role="status">
          Refreshing legal review status...
        </div>

        <div v-else-if="currentLegalReviews.length" class="surface-row-list mt-5">
          <div v-for="review in currentLegalReviews" :key="review.id" class="surface-row">
            <div class="flex flex-wrap gap-3 items-start justify-between">
              <div>
                <p class="font-semibold">
                  {{ review.reviewerName }}
                </p>
                <p class="muted text-sm mt-1">
                  {{ review.reviewerOrganization }} · {{ formatContractLegalReviewerType(review.reviewerType) }}
                </p>
              </div>
              <BaseBadge :tone="legalReviewTone(review.status)">
                {{ formatContractLegalReviewStatus(review.status) }}
              </BaseBadge>
            </div>

            <div class="mt-3 flex flex-wrap gap-2">
              <BaseBadge v-for="scope in review.scope" :key="scope" tone="neutral">
                {{ formatContractLegalReviewScope(scope) }}
              </BaseBadge>
            </div>

            <p class="muted text-sm leading-6 mt-3">
              {{ review.message }}
            </p>
            <div v-if="review.reviewerResponse" class="panel-inset mt-4 p-4">
              <p class="text-sm font-semibold">
                Reviewer response
              </p>
              <p class="muted text-sm leading-6 mt-2 whitespace-pre-wrap">
                {{ review.reviewerResponse }}
              </p>
              <p v-if="review.respondedByName" class="muted text-xs leading-5 mt-3">
                Recorded by {{ review.respondedByName }}<template v-if="review.respondedAt">
                  on {{ formatDate(review.respondedAt) }}
                </template>.
              </p>
            </div>
            <p class="muted text-xs leading-5 mt-4">
              Requested {{ formatDate(review.createdAt) }} · Expires {{ formatDate(review.expiresAt) }}
            </p>

            <div v-if="['requested', 'opened', 'changes_requested'].includes(review.status)" class="mt-4 flex flex-wrap gap-2">
              <BaseButton
                v-if="review.requestedByUserId === authStore.currentUser?.id && ['requested', 'opened'].includes(review.status)"
                size="sm"
                variant="ghost"
                @click="resendLegalReview(review)"
              >
                Resend or copy invite
              </BaseButton>
              <BaseButton size="sm" variant="ghost" @click="cancelLegalReview(review)">
                Cancel review and revoke link
              </BaseButton>
            </div>
          </div>
        </div>

        <p v-else class="muted text-sm leading-6 mt-5">
          No legal review has been requested for version {{ version.versionNumber }}. Review is optional, but this template should be evaluated by qualified counsel for the relevant jurisdiction before reliance.
        </p>

        <div v-if="lastInviteUrl" class="panel-inset mt-5 p-4">
          <label class="field-label" for="legal-review-invite-url">
            Confidential reviewer link
          </label>
          <div class="gap-2 grid sm:grid-cols-[minmax(0,1fr)_auto]">
            <input id="legal-review-invite-url" :value="lastInviteUrl" readonly class="field-control min-w-0">
            <BaseButton variant="secondary" @click="copyInviteLink">
              Copy link
            </BaseButton>
          </div>
          <p class="muted text-xs leading-5 mt-2">
            The link is version-bound, expires automatically, and should only be shared with the named reviewer.
          </p>
        </div>

        <details v-if="priorLegalReviews.length" class="mt-5">
          <summary class="text-sm font-semibold cursor-pointer">
            Prior-version legal review history
          </summary>
          <div class="surface-row-list mt-3">
            <div v-for="review in priorLegalReviews" :key="review.id" class="surface-row">
              <div class="flex flex-wrap gap-3 items-center justify-between">
                <p class="text-sm font-semibold">
                  {{ review.reviewerName }} · {{ review.reviewerOrganization }}
                </p>
                <BaseBadge tone="neutral">
                  {{ formatContractLegalReviewStatus(review.status) }}
                </BaseBadge>
              </div>
              <p class="muted text-xs leading-5 mt-2">
                {{ contractVersionLabel(review.contractVersionId) }} · {{ formatDate(review.createdAt) }}
              </p>
            </div>
          </div>
        </details>
      </div>

      <div class="panel p-5 xl:top-24 xl:sticky">
        <h2 class="text-lg font-semibold">
          Signatures
        </h2>
        <div class="mt-4 gap-3 grid">
          <div v-for="signature in signatures" :key="signature.id" class="panel-inset p-4">
            <p class="font-semibold">
              {{ signature.typedName }}
            </p>
            <p class="muted text-sm mt-1">
              {{ formatDate(signature.signedAt) }}
            </p>
          </div>
          <p v-if="!signatures.length" class="muted text-sm leading-6">
            No signatures have been recorded for version {{ version.versionNumber }}.
          </p>
        </div>

        <div class="mt-5 gap-4 grid">
          <p v-if="blockingLegalReview" class="text-sm leading-6 p-3 border border-amber-500/30 rounded-2xl bg-amber-500/10">
            Signing is paused while the current legal review is active. Complete or cancel that review, or create a revised agreement version.
          </p>
          <TextInput v-model="signatureName" label="Type your full name to sign" :error="signatureError" />
          <div class="flex flex-wrap gap-3">
            <BaseButton v-if="relationshipHref" :to="relationshipHref">
              Open relationship
            </BaseButton>
            <BaseButton :disabled="previewOnly || blockingLegalReview || signaturePending || hasCurrentUserSigned || contract.status === 'signed'" @click="signContract">
              {{ previewOnly ? "Paid sponsor required" : blockingLegalReview ? "Review must finish first" : signaturePending ? "Recording signature..." : contract.status === "signed" ? "Agreement fully signed" : hasCurrentUserSigned ? "Your signature is recorded" : "Sign agreement" }}
            </BaseButton>
            <BaseButton variant="secondary" :disabled="previewOnly || editPending" @click="editDialogOpen = true">
              {{ previewOnly ? "Revision requires sponsor" : contract.status === "signed" ? "Create amendment version" : "Edit new version" }}
            </BaseButton>
            <BaseButton variant="ghost" :disabled="previewOnly" @click="printContract">
              {{ previewOnly ? "Print requires sponsor" : "Print / Save PDF" }}
            </BaseButton>
            <BaseButton variant="ghost" :disabled="previewOnly" @click="downloadContract">
              {{ previewOnly ? "Export requires sponsor" : "Download agreement" }}
            </BaseButton>
            <BaseButton variant="ghost" :disabled="previewOnly" @click="downloadCertificate">
              {{ previewOnly ? "Certificate requires sponsor" : "Download certificate" }}
            </BaseButton>
            <BaseButton variant="secondary" :disabled="redlinePending" @click="loadRedline">
              {{ redlinePending ? "Checking..." : "View redline" }}
            </BaseButton>
            <BaseButton v-if="previewOnly" variant="secondary" to="/app/billing">
              Upgrade plan
            </BaseButton>
          </div>
        </div>
      </div>
    </section>

    <section class="panel p-6">
      <div class="flex gap-3 items-center justify-between">
        <p class="muted text-sm">
          Version {{ version.versionNumber }} · Generated {{ formatDate(version.createdAt) }}
        </p>
        <BaseBadge :tone="previewOnly || blockingLegalReview ? 'warning' : contract.status === 'signed' ? 'success' : 'neutral'">
          {{ previewOnly ? "Preview only" : blockingLegalReview ? "Review hold" : contract.status === "signed" ? "Fully signed" : "Signature-ready" }}
        </BaseBadge>
      </div>
      <div v-if="redlineOpen" class="panel-inset mt-5 p-4">
        <div class="flex flex-wrap gap-3 items-start justify-between">
          <div>
            <h2 class="font-semibold">
              Version redline
            </h2>
            <p class="muted text-sm leading-6 mt-2">
              Field-level changes from the immediately prior version.
            </p>
          </div>
          <BaseButton variant="ghost" size="sm" @click="redlineOpen = false">
            Close
          </BaseButton>
        </div>

        <div v-if="redlineChanges.length" class="surface-row-list mt-4">
          <div v-for="change in redlineChanges" :key="change.field" class="surface-row">
            <p class="text-sm font-semibold">
              {{ change.label }}
            </p>
            <p class="muted text-xs tracking-[0.12em] mt-3 uppercase">
              Previous
            </p>
            <p class="muted text-sm leading-6 mt-1">
              {{ change.before }}
            </p>
            <p class="muted text-xs tracking-[0.12em] mt-4 uppercase">
              Current
            </p>
            <p class="text-sm leading-6 mt-1">
              {{ change.after }}
            </p>
          </div>
        </div>

        <p v-else class="muted text-sm leading-6 mt-4">
          No prior version changes were found.
        </p>
      </div>
      <div class="text-sm leading-7 mt-6 gap-5 grid">
        <div>
          <h2 class="font-semibold">
            Parties
          </h2>
          <p class="muted mt-2">
            {{ version.parties.join(" and ") }}
          </p>
        </div>
        <div>
          <h2 class="font-semibold">
            Role and scope
          </h2>
          <p class="muted mt-2">
            {{ version.roleTitle }}
          </p>
          <p class="muted mt-2">
            {{ version.scope }}
          </p>
        </div>
        <div>
          <h2 class="font-semibold">
            Time commitment
          </h2>
          <p class="muted mt-2">
            {{ version.timeCommitment }}
          </p>
        </div>
        <div class="gap-4 grid md:grid-cols-2">
          <div class="panel-inset p-4">
            <p class="font-semibold">
              Compensation
            </p>
            <p class="muted mt-2">
              {{ version.compensation }}
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
          <h2 class="font-semibold">
            Vesting / Cliff
          </h2>
          <p class="muted mt-2">
            {{ version.vesting }}
          </p>
        </div>
        <div>
          <h2 class="font-semibold">
            IP assignment
          </h2>
          <p class="muted mt-2">
            {{ version.ipAssignment }}
          </p>
        </div>
        <div>
          <h2 class="font-semibold">
            Confidentiality
          </h2>
          <p class="muted mt-2">
            {{ version.confidentiality }}
          </p>
        </div>
        <div>
          <h2 class="font-semibold">
            Decision-making
          </h2>
          <p class="muted mt-2">
            {{ version.decisionMaking }}
          </p>
        </div>
        <div>
          <h2 class="font-semibold">
            Termination / disputes
          </h2>
          <p class="muted mt-2">
            {{ version.termination }}
          </p>
          <p class="muted mt-2">
            {{ version.disputeResolution }}
          </p>
        </div>
        <div class="panel-inset p-4">
          <p class="font-semibold">
            Notes
          </p>
          <p class="muted mt-2">
            {{ version.notes }}
          </p>
        </div>
        <div v-if="proposal" class="muted text-sm">
          Generated from proposal: {{ proposal.title }}
        </div>
      </div>
    </section>

    <BaseDialog v-model="editDialogOpen" title="Edit agreement" description="This creates a new authoritative version, resets the current signature state, and supersedes legal review links for earlier versions.">
      <ContractEditorForm :version="version" :submitting="editPending" @submitted="saveContractVersion" />
    </BaseDialog>

    <BaseDialog v-model="legalReviewDialogOpen" title="Request legal review" description="Invite a named legal representative to review only the current agreement version.">
      <ContractLegalReviewRequestForm :submitting="legalReviewPending" @submitted="requestLegalReview" />
    </BaseDialog>
  </div>

  <EmptyState
    v-else
    icon="i-carbon-license-global"
    title="Contract not found"
    description="This contract may have been removed or the route is incorrect."
  >
    <BaseButton to="/app/contracts">
      Back to contracts
    </BaseButton>
  </EmptyState>
</template>
