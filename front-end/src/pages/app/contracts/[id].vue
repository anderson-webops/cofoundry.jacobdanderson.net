<script setup lang="ts">
import { formatDate } from "~/shared/utils/format"
import { contractSignatureSchema } from "~/shared/utils/validation"
import { getContractById, getCurrentContractVersion, getProposalById } from "~/shared/utils/workspace"

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
const signatures = computed(() => workspaceStore.data.signatures.filter(signature => signature.contractId === route.params.id))
const editDialogOpen = ref(false)
const signatureName = ref("")
const signatureError = ref("")

function printContract() {
  if (import.meta.client)
    window.print()
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

function signContract() {
  signatureError.value = ""
  const parsed = contractSignatureSchema.safeParse({ typedName: signatureName.value })
  if (!parsed.success) {
    signatureError.value = parsed.error.issues[0]?.message || "Type your full name to sign."
    return
  }

  if (!contract.value || !authStore.currentUser)
    return

  workspaceStore.signContract(contract.value.id, authStore.currentUser.id, parsed.data.typedName)
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
          <BaseBadge :tone="contract.status === 'signed' ? 'success' : 'accent'">
            {{ contract.status }}
          </BaseBadge>
        </template>
      </PageIntro>

      <div class="panel p-5">
        <h2 class="text-lg font-semibold">
          Important disclaimer
        </h2>
        <p class="muted text-sm leading-7 mt-3">
          This contract is a startup workflow template. It is not legal advice, does not create an attorney-client relationship, and should be reviewed by counsel before execution.
        </p>
      </div>

      <div class="panel p-5">
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
            <BaseButton @click="signContract">
              Sign contract
            </BaseButton>
            <BaseButton variant="secondary" @click="editDialogOpen = true">
              Edit new version
            </BaseButton>
            <BaseButton variant="ghost" @click="printContract">
              Print / Save PDF
            </BaseButton>
          </div>
        </div>
      </div>
    </section>

    <section class="panel p-6">
      <p class="muted text-sm">
        Version {{ version.versionNumber }} · Generated {{ formatDate(version.createdAt) }}
      </p>
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
