<script setup lang="ts">
import type { ContractRedlineChange } from "~/shared/utils/contract-documents"
import { getSubscriptionEntitlements } from "~/shared/utils/billing"
import { formatDate } from "~/shared/utils/format"
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
const { authStore, subscription, workspaceStore } = useCurrentMember()

const contract = computed(() => getContractById(workspaceStore.data, route.params.id as string))
const version = computed(() => contract.value ? getCurrentContractVersion(workspaceStore.data, contract.value) : undefined)
const proposal = computed(() => contract.value ? getProposalById(workspaceStore.data, contract.value.proposalId) : undefined)
const proposalVersion = computed(() => proposal.value ? getCurrentProposalVersion(workspaceStore.data, proposal.value) : undefined)
const proposalSummary = computed(() => proposalVersion.value ? buildProposalTermsSummary(proposalVersion.value) : [])
const signatures = computed(() => workspaceStore.data.signatures.filter(signature => signature.contractId === route.params.id))
const relationshipHref = computed(() => contract.value && authStore.currentUser ? getRelationshipHrefForContract(workspaceStore.data, authStore.currentUser.id, contract.value.id) : null)
const entitlements = computed(() => getSubscriptionEntitlements(subscription.value || undefined))
const previewOnly = computed(() => !entitlements.value.canSignContracts)
const editDialogOpen = ref(false)
const redlineOpen = ref(false)
const redlinePending = ref(false)
const redlineChanges = ref<ContractRedlineChange[]>([])
const signatureName = ref("")
const signatureError = ref("")

function printContract() {
  if (previewOnly.value) {
    toastStore.push({
      title: "Upgrade required",
      message: "Free keeps agreement drafts visible, but print and export stay on Pro and Team.",
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
      title: "Export requires Pro",
      message: "Agreement export is available on paid plans.",
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
      title: "Certificate requires Pro",
      message: "Agreement certificate downloads are available on paid plans.",
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
  finally {
    redlinePending.value = false
  }
}

function saveContractVersion(payload: any) {
  if (!contract.value)
    return

  workspaceStore.updateContractVersion(contract.value.id, payload)
  editDialogOpen.value = false
  toastStore.push({
    title: "Contract updated",
    message: "A new contract version was saved.",
    tone: "success",
  })
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
      title: "Signatures are paid",
      message: "This draft is visible on Free, but typed signatures are only enabled on Pro and Team.",
      tone: "warning",
    })
    return
  }

  await workspaceStore.signContract(contract.value.id, authStore.currentUser.id, parsed.data.typedName)
  signatureName.value = ""
  toastStore.push({
    title: "Contract signed",
    message: "Your signature was added with a timestamp.",
    tone: "success",
  })
}
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
          This account is currently in preview mode for agreement drafts. You can review the structure and terms here, but printing and signature collection require a paid plan.
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
        </div>

        <div class="mt-5 gap-4 grid">
          <TextInput v-model="signatureName" label="Type your full name to sign" :error="signatureError" />
          <div class="flex flex-wrap gap-3">
            <BaseButton v-if="relationshipHref" :to="relationshipHref">
              Open relationship
            </BaseButton>
            <BaseButton :disabled="previewOnly" @click="signContract">
              {{ previewOnly ? "Signatures require Pro" : "Sign contract" }}
            </BaseButton>
            <BaseButton variant="secondary" @click="editDialogOpen = true">
              Edit new version
            </BaseButton>
            <BaseButton variant="ghost" :disabled="previewOnly" @click="printContract">
              {{ previewOnly ? "Print requires Pro" : "Print / Save PDF" }}
            </BaseButton>
            <BaseButton variant="ghost" :disabled="previewOnly" @click="downloadContract">
              {{ previewOnly ? "Export requires Pro" : "Download agreement" }}
            </BaseButton>
            <BaseButton variant="ghost" :disabled="previewOnly" @click="downloadCertificate">
              {{ previewOnly ? "Certificate requires Pro" : "Download certificate" }}
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
        <BaseBadge :tone="previewOnly ? 'warning' : 'neutral'">
          {{ previewOnly ? "Preview only" : "Signature-ready" }}
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

    <BaseDialog v-model="editDialogOpen" title="Edit contract" description="This creates a new version rather than overwriting the current agreement.">
      <ContractEditorForm :version="version" @submitted="saveContractVersion" />
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
