<script setup lang="ts">
import { proposalSchema } from "~/shared/utils/validation"

const props = withDefaults(defineProps<{
  initialValues?: Partial<{
    roleTitle: string
    responsibilities: string[]
    weeklyTimeCommitment: number
    startDate: string
    cashCompensation: string
    equity: string
    vestingSchedule: string
    cliff: string
    decisionRights: string
    ipAssignmentRequired: boolean
    confidentiality: string
    exitTerms: string
    notes: string
  }>
  submitLabel?: string
}>(), {
  initialValues: () => ({}),
  submitLabel: "Save proposal",
})

const emit = defineEmits<{
  submitted: [payload: ReturnType<typeof proposalSchema.parse>]
}>()

const errors = ref<Record<string, string>>({})
const responsibilitiesText = ref((props.initialValues.responsibilities || []).join("\n"))
const form = reactive({
  roleTitle: props.initialValues.roleTitle || "",
  weeklyTimeCommitment: String(props.initialValues.weeklyTimeCommitment || 40),
  startDate: props.initialValues.startDate || "",
  cashCompensation: props.initialValues.cashCompensation || "",
  equity: props.initialValues.equity || "",
  vestingSchedule: props.initialValues.vestingSchedule || "",
  cliff: props.initialValues.cliff || "",
  decisionRights: props.initialValues.decisionRights || "",
  ipAssignmentRequired: props.initialValues.ipAssignmentRequired ?? true,
  confidentiality: props.initialValues.confidentiality || "",
  exitTerms: props.initialValues.exitTerms || "",
  notes: props.initialValues.notes || "",
})

function submitForm() {
  const payload = {
    ...form,
    responsibilities: responsibilitiesText.value.split("\n").map(item => item.trim()).filter(Boolean),
    weeklyTimeCommitment: Number(form.weeklyTimeCommitment),
  }

  const parsed = proposalSchema.safeParse(payload)
  if (!parsed.success) {
    errors.value = Object.fromEntries(parsed.error.issues.map(issue => [issue.path[0] as string, issue.message]))
    return
  }

  errors.value = {}
  emit("submitted", parsed.data)
}
</script>

<template>
  <form class="gap-4 grid" @submit.prevent="submitForm">
    <TextInput v-model="form.roleTitle" label="Role title" :error="errors.roleTitle" />
    <TextareaInput v-model="responsibilitiesText" label="Responsibilities" helper="One responsibility per line." :error="errors.responsibilities" :rows="5" />
    <div class="gap-4 grid md:grid-cols-2">
      <TextInput v-model="form.weeklyTimeCommitment" label="Weekly hours" type="number" :error="errors.weeklyTimeCommitment" />
      <TextInput v-model="form.startDate" label="Start date" type="date" :error="errors.startDate" />
    </div>
    <div class="gap-4 grid md:grid-cols-2">
      <TextInput v-model="form.cashCompensation" label="Cash compensation" :error="errors.cashCompensation" />
      <TextInput v-model="form.equity" label="Equity" :error="errors.equity" />
    </div>
    <div class="gap-4 grid md:grid-cols-2">
      <TextInput v-model="form.vestingSchedule" label="Vesting schedule" :error="errors.vestingSchedule" />
      <TextInput v-model="form.cliff" label="Cliff" :error="errors.cliff" />
    </div>
    <TextareaInput v-model="form.decisionRights" label="Decision rights" :error="errors.decisionRights" :rows="4" />
    <label class="pill w-fit">
      <input v-model="form.ipAssignmentRequired" type="checkbox">
      <span>IP assignment required</span>
    </label>
    <TextareaInput v-model="form.confidentiality" label="Confidentiality" :error="errors.confidentiality" :rows="4" />
    <TextareaInput v-model="form.exitTerms" label="Exit terms" :error="errors.exitTerms" :rows="4" />
    <TextareaInput v-model="form.notes" label="Notes" :error="errors.notes" :rows="4" />
    <div class="flex justify-end">
      <BaseButton type="submit">
        {{ submitLabel }}
      </BaseButton>
    </div>
  </form>
</template>
