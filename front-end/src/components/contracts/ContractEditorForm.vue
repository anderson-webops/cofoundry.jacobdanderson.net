<script setup lang="ts">
import type { ContractVersion, ContractVersionPayload } from "~/shared/types/domain"
import { contractVersionSchema } from "~/shared/utils/validation"

const props = defineProps<{
  submitting?: boolean
  version: ContractVersion
}>()

const emit = defineEmits<{
  submitted: [payload: ContractVersionPayload]
}>()

const form = reactive({
  roleTitle: props.version.roleTitle,
  scope: props.version.scope,
  timeCommitment: props.version.timeCommitment,
  compensation: props.version.compensation,
  equity: props.version.equity,
  vesting: props.version.vesting,
  ipAssignment: props.version.ipAssignment,
  confidentiality: props.version.confidentiality,
  decisionMaking: props.version.decisionMaking,
  termination: props.version.termination,
  disputeResolution: props.version.disputeResolution,
  notes: props.version.notes,
})
const errors = ref<Record<string, string>>({})

function submitForm() {
  errors.value = {}
  const parsed = contractVersionSchema.safeParse(form)
  if (!parsed.success) {
    errors.value = Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0] || "form"), issue.message]))
    return
  }

  emit("submitted", parsed.data)
}
</script>

<template>
  <form class="gap-4 grid" @submit.prevent="submitForm">
    <TextInput v-model="form.roleTitle" label="Agreement title" :error="errors.roleTitle" />
    <TextareaInput v-model="form.scope" label="Scope" :rows="4" :error="errors.scope" />
    <TextareaInput v-model="form.timeCommitment" label="Time commitment" :rows="3" :error="errors.timeCommitment" />
    <div class="gap-4 grid md:grid-cols-2">
      <TextareaInput v-model="form.compensation" label="Compensation" :rows="3" :error="errors.compensation" />
      <TextareaInput v-model="form.equity" label="Equity" :rows="3" :error="errors.equity" />
    </div>
    <TextareaInput v-model="form.vesting" label="Vesting / Cliff" :rows="3" :error="errors.vesting" />
    <TextareaInput v-model="form.ipAssignment" label="IP assignment" :rows="3" :error="errors.ipAssignment" />
    <TextareaInput v-model="form.confidentiality" label="Confidentiality" :rows="3" :error="errors.confidentiality" />
    <TextareaInput v-model="form.decisionMaking" label="Decision-making" :rows="3" :error="errors.decisionMaking" />
    <TextareaInput v-model="form.termination" label="Termination" :rows="3" :error="errors.termination" />
    <TextareaInput v-model="form.disputeResolution" label="Dispute resolution" :rows="3" :error="errors.disputeResolution" />
    <TextareaInput
      v-model="form.notes"
      label="Revision note and legal context"
      :rows="3"
      :error="errors.notes"
      helper="Summarize what changed and preserve any context the other party or counsel should see."
    />
    <div class="flex justify-end">
      <BaseButton type="submit" :disabled="submitting">
        {{ submitting ? "Saving..." : "Save new version" }}
      </BaseButton>
    </div>
  </form>
</template>
