<script setup lang="ts">
import type { ContractVersion } from "~/shared/types/domain"

const props = defineProps<{
  version: ContractVersion
}>()

const emit = defineEmits<{
  submitted: [payload: Partial<ContractVersion>]
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

function submitForm() {
  emit("submitted", form)
}
</script>

<template>
  <form class="gap-4 grid" @submit.prevent="submitForm">
    <TextInput v-model="form.roleTitle" label="Agreement title" />
    <TextareaInput v-model="form.scope" label="Scope" rows="4" />
    <TextareaInput v-model="form.timeCommitment" label="Time commitment" rows="3" />
    <div class="gap-4 grid md:grid-cols-2">
      <TextareaInput v-model="form.compensation" label="Compensation" rows="3" />
      <TextareaInput v-model="form.equity" label="Equity" rows="3" />
    </div>
    <TextareaInput v-model="form.vesting" label="Vesting / Cliff" rows="3" />
    <TextareaInput v-model="form.ipAssignment" label="IP assignment" rows="3" />
    <TextareaInput v-model="form.confidentiality" label="Confidentiality" rows="3" />
    <TextareaInput v-model="form.decisionMaking" label="Decision-making" rows="3" />
    <TextareaInput v-model="form.termination" label="Termination" rows="3" />
    <TextareaInput v-model="form.disputeResolution" label="Dispute resolution" rows="3" />
    <TextareaInput v-model="form.notes" label="Notes" rows="3" />
    <div class="flex justify-end">
      <BaseButton type="submit">
        Save new version
      </BaseButton>
    </div>
  </form>
</template>
