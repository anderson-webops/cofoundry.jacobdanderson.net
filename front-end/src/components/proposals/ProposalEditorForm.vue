<script setup lang="ts">
import { proposalRelationshipOptions } from "~/shared/constants/options"
import { proposalSchema } from "~/shared/utils/validation"

type ProposalFormPayload = ReturnType<typeof proposalSchema.parse>

const props = withDefaults(defineProps<{
  initialValues?: Partial<ProposalFormPayload>
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
  relationshipType: props.initialValues.relationshipType || "cofounder",
  roleTitle: props.initialValues.roleTitle || "",
  weeklyTimeCommitment: String(props.initialValues.weeklyTimeCommitment || 40),
  startDate: props.initialValues.startDate || "",
  fullTimeTrigger: props.initialValues.fullTimeTrigger || "",
  ceoDecision: props.initialValues.ceoDecision || "",
  trialScope: props.initialValues.trialScope || "",
  trialIpHandling: props.initialValues.trialIpHandling || "",
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
    <div class="panel-inset p-4 gap-4 grid">
      <div>
        <h3 class="text-sm font-semibold">
          Partnership shape
        </h3>
        <p class="field-helper mt-1">
          Make the company relationship explicit before anyone starts negotiating around the edges.
        </p>
      </div>
      <div class="gap-4 grid md:grid-cols-2">
        <SelectInput v-model="form.relationshipType" label="Relationship type" :options="proposalRelationshipOptions" :error="errors.relationshipType" />
        <TextInput v-model="form.roleTitle" label="Role title" :error="errors.roleTitle" />
      </div>
      <div class="gap-4 grid md:grid-cols-2">
        <TextInput v-model="form.weeklyTimeCommitment" label="Weekly hours" type="number" :error="errors.weeklyTimeCommitment" />
        <TextInput v-model="form.startDate" label="Start date" type="date" :error="errors.startDate" />
      </div>
      <TextareaInput
        v-model="form.fullTimeTrigger"
        label="Full-time trigger"
        helper="State what has to happen before both sides treat this as a full-time commitment."
        :error="errors.fullTimeTrigger"
        :rows="3"
      />
      <TextareaInput
        v-model="form.ceoDecision"
        label="CEO / lead operator decision"
        helper="Call out who is the final decision-maker on company-level questions."
        :error="errors.ceoDecision"
        :rows="3"
      />
    </div>

    <div class="panel-inset p-4 gap-4 grid">
      <div>
        <h3 class="text-sm font-semibold">
          Scope and trial
        </h3>
        <p class="field-helper mt-1">
          Treat the proposal as a staged deal room, not just a message with numbers.
        </p>
      </div>
      <TextareaInput
        v-model="responsibilitiesText"
        label="Responsibilities"
        helper="One responsibility per line."
        :error="errors.responsibilities"
        :rows="5"
      />
      <TextareaInput
        v-model="form.trialScope"
        label="Trial scope"
        helper="Define the short working sprint that proves the collaboration before long-term terms lock in."
        :error="errors.trialScope"
        :rows="4"
      />
      <TextareaInput
        v-model="form.trialIpHandling"
        label="Trial IP handling"
        helper="Explain what happens to prototypes, customer work, and documents if the trial ends without a long-term agreement."
        :error="errors.trialIpHandling"
        :rows="4"
      />
    </div>

    <div class="panel-inset p-4 gap-4 grid">
      <div>
        <h3 class="text-sm font-semibold">
          Economics and governance
        </h3>
        <p class="field-helper mt-1">
          These are the terms most likely to create ambiguity if they stay vague.
        </p>
      </div>
      <div class="gap-4 grid md:grid-cols-2">
        <TextInput v-model="form.cashCompensation" label="Cash compensation" :error="errors.cashCompensation" />
        <TextInput v-model="form.equity" label="Equity" :error="errors.equity" />
      </div>
      <div class="gap-4 grid md:grid-cols-2">
        <TextInput v-model="form.vestingSchedule" label="Vesting schedule" :error="errors.vestingSchedule" />
        <TextInput v-model="form.cliff" label="Cliff" :error="errors.cliff" />
      </div>
      <div class="panel-inset p-4">
        <p class="text-sm font-semibold">
          Vesting explainer
        </p>
        <p class="muted text-sm leading-6 mt-2">
          CoFoundry treats vesting as founder protection, not legal trivia. A one-year cliff typically means 0% is vested before the first anniversary, then vesting continues on the schedule you set above.
        </p>
      </div>
      <TextareaInput v-model="form.decisionRights" label="Decision rights" :error="errors.decisionRights" :rows="4" />
    </div>

    <div class="panel-inset p-4 gap-4 grid">
      <div>
        <h3 class="text-sm font-semibold">
          IP, confidentiality, and off-ramp
        </h3>
        <p class="field-helper mt-1">
          CoFoundry keeps this explicit so nobody mistakes the template for unstated assumptions.
        </p>
      </div>
      <label class="pill w-fit">
        <input v-model="form.ipAssignmentRequired" type="checkbox">
        <span>IP assignment required</span>
      </label>
      <TextareaInput v-model="form.confidentiality" label="Confidentiality" :error="errors.confidentiality" :rows="4" />
      <TextareaInput v-model="form.exitTerms" label="Exit terms" :error="errors.exitTerms" :rows="4" />
      <TextareaInput
        v-model="form.notes"
        label="Notes"
        helper="Use this for decision logs, unresolved terms, or context counsel should see later."
        :error="errors.notes"
        :rows="4"
      />
    </div>
    <div class="flex justify-end">
      <BaseButton type="submit">
        {{ submitLabel }}
      </BaseButton>
    </div>
  </form>
</template>
