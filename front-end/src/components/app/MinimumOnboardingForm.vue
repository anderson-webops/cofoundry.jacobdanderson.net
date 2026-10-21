<script setup lang="ts">
import { reactive, ref } from "vue"
import { commitmentOptions, companyPreferenceOptions, equityPhilosophyOptions, industryOptions, remoteOptions, roleOptions, runwayBucketOptions, startTimelineOptions } from "~/shared/constants/options"
import { minimumOnboardingSchema } from "~/shared/utils/validation"

const props = withDefaults(defineProps<{
  initialValues?: Partial<{
    intentMode: "start" | "join" | "explore"
    displayName: string
    photoUrl: string
    headline: string
    bio: string
    location: string
    remotePreference: "remote" | "hybrid" | "in_person"
    primaryRole: string
    roles: string[]
    industries: string[]
    timeCommitment: "nights_weekends" | "part_time" | "full_time"
    weeklyAvailabilityHours: number
    startTimeline: "immediately" | "30_days" | "90_days" | "exploring"
    fullTimeBy: string
    runwayBucket: "under_3_months" | "3_to_6_months" | "6_to_12_months" | "12_plus_months" | "undisclosed"
    equityPhilosophy: "equal_unless_strong_reason" | "contribution_weighted" | "dynamic_over_time"
    companyPreferences: string[]
    profileVisibility: "public" | "members" | "private"
  }>
  submitLabel?: string
}>(), {
  initialValues: () => ({}),
  submitLabel: "Unlock match preview",
})

const emit = defineEmits<{
  submitted: [payload: ReturnType<typeof minimumOnboardingSchema.parse>]
}>()

const step = ref(0)
const errors = ref<Record<string, string>>({})

const form = reactive({
  intentMode: props.initialValues.intentMode || "start",
  displayName: props.initialValues.displayName || "",
  photoUrl: props.initialValues.photoUrl || "",
  headline: props.initialValues.headline || "",
  bio: props.initialValues.bio || "",
  location: props.initialValues.location || "",
  remotePreference: props.initialValues.remotePreference || "remote",
  primaryRole: props.initialValues.primaryRole || props.initialValues.roles?.[0] || "",
  roles: props.initialValues.roles || [],
  industries: props.initialValues.industries || [],
  timeCommitment: props.initialValues.timeCommitment || "part_time",
  weeklyAvailabilityHours: String(props.initialValues.weeklyAvailabilityHours || 10),
  startTimeline: props.initialValues.startTimeline || "exploring",
  fullTimeBy: props.initialValues.fullTimeBy || "",
  runwayBucket: props.initialValues.runwayBucket || "undisclosed",
  equityPhilosophy: props.initialValues.equityPhilosophy || "equal_unless_strong_reason",
  companyPreferences: props.initialValues.companyPreferences || [],
  profileVisibility: props.initialValues.profileVisibility || "members",
})

const steps = [
  { title: "Intent" },
  { title: "Commitment" },
  { title: "Fit" },
]

const fieldsByStep = [
  ["intentMode", "displayName", "photoUrl", "location", "profileVisibility"],
  ["headline", "bio", "primaryRole", "roles", "timeCommitment", "weeklyAvailabilityHours", "startTimeline", "fullTimeBy", "runwayBucket", "equityPhilosophy", "remotePreference"],
  ["industries", "companyPreferences"],
]

const intentOptions = [
  {
    value: "start",
    title: "Start a company",
  },
  {
    value: "join",
    title: "Join a founding team",
  },
  {
    value: "explore",
    title: "Explore both paths",
  },
] as const

function parseForm() {
  return minimumOnboardingSchema.safeParse({
    ...form,
    roles: Array.from(new Set([form.primaryRole, ...form.roles].filter(Boolean))),
    weeklyAvailabilityHours: Number(form.weeklyAvailabilityHours),
  })
}

function fieldErrorsFor(issues: { path: PropertyKey[], message: string }[]) {
  return Object.fromEntries(issues.map(issue => [issue.path[0] as string, issue.message]))
}

function stepForField(field: string) {
  const stepIndex = fieldsByStep.findIndex(fields => fields.includes(field))
  return stepIndex >= 0 ? stepIndex : 0
}

function validateCurrentStep() {
  const parsed = parseForm()
  if (parsed.success) {
    errors.value = {}
    return true
  }

  const currentFields = new Set(fieldsByStep[step.value])
  const currentIssues = parsed.error.issues.filter(issue => currentFields.has(issue.path[0] as string))
  errors.value = fieldErrorsFor(currentIssues)

  return currentIssues.length === 0
}

function validateForSubmit() {
  const parsed = parseForm()
  if (!parsed.success) {
    const firstField = parsed.error.issues[0]?.path[0]
    errors.value = fieldErrorsFor(parsed.error.issues)
    step.value = typeof firstField === "string" ? stepForField(firstField) : 0
    return null
  }

  errors.value = {}
  return parsed.data
}

function nextStep() {
  if (!validateCurrentStep())
    return

  step.value = Math.min(step.value + 1, steps.length - 1)
}

function previousStep() {
  step.value = Math.max(step.value - 1, 0)
}

function submitForm() {
  if (step.value < steps.length - 1) {
    nextStep()
    return
  }

  const parsed = validateForSubmit()
  if (!parsed)
    return

  emit("submitted", parsed)
}
</script>

<template>
  <form class="gap-8 grid" @submit.prevent="submitForm">
    <div class="gap-3 grid md:grid-cols-3">
      <div
        v-for="(item, index) in steps"
        :key="item.title"
        class="step-card"
        :class="index === step ? 'step-card-active' : ''"
      >
        <p class="text-sm font-semibold">
          {{ item.title }}
        </p>
      </div>
    </div>

    <section v-show="step === 0" class="gap-5 grid">
      <div class="gap-4 grid md:grid-cols-3">
        <button
          v-for="option in intentOptions"
          :key="option.value"
          type="button"
          class="panel-inset p-5 text-left transition"
          :class="form.intentMode === option.value ? 'ring-2 ring-[var(--accent)] bg-[var(--accent-soft)]' : ''"
          @click="form.intentMode = option.value"
        >
          <p class="text-sm font-semibold">
            {{ option.title }}
          </p>
        </button>
      </div>
      <div class="gap-4 grid md:grid-cols-2">
        <TextInput v-model="form.displayName" label="Name" :error="errors.displayName" required />
        <TextInput v-model="form.location" label="Location or time zone" :error="errors.location" required />
      </div>
      <TextInput
        v-model="form.photoUrl"
        label="Profile photo URL"
        type="url"
        :error="errors.photoUrl"
        required
      />
      <SelectInput
        v-model="form.profileVisibility"
        label="Visibility"
        helper="Members only keeps your profile inside CoFoundry by default."
        :options="[
          { label: 'Public-lite', value: 'public' },
          { label: 'Members only', value: 'members' },
          { label: 'Private', value: 'private' },
        ]"
        :error="errors.profileVisibility"
      />
    </section>

    <section v-show="step === 1" class="gap-5 grid">
      <TextInput
        v-model="form.headline"
        label="One-line summary"
        :error="errors.headline"
        required
      />
      <TextareaInput
        v-model="form.bio"
        label="What are you building or looking for?"
        :rows="5"
        :error="errors.bio"
      />
      <div class="gap-4 grid md:grid-cols-2">
        <SelectInput v-model="form.primaryRole" label="Primary role" :options="roleOptions.map(role => ({ label: role, value: role }))" :error="errors.primaryRole" />
        <PillPicker v-model="form.roles" label="Other roles" :options="roleOptions" :error="errors.roles" />
      </div>
      <div class="gap-4 grid md:grid-cols-3">
        <SelectInput v-model="form.timeCommitment" label="Commitment" :options="commitmentOptions" :error="errors.timeCommitment" />
        <SelectInput v-model="form.startTimeline" label="Start timeline" :options="startTimelineOptions" :error="errors.startTimeline" />
        <SelectInput v-model="form.remotePreference" label="Work mode" :options="remoteOptions" :error="errors.remotePreference" />
      </div>
      <div class="gap-4 grid md:grid-cols-3">
        <TextInput v-model="form.weeklyAvailabilityHours" label="Hours per week" type="number" :error="errors.weeklyAvailabilityHours" />
        <TextInput v-model="form.fullTimeBy" label="Full-time by" type="date" :error="errors.fullTimeBy" />
        <SelectInput v-model="form.runwayBucket" label="Runway" :options="runwayBucketOptions" :error="errors.runwayBucket" />
      </div>
      <SelectInput
        v-model="form.equityPhilosophy"
        label="Equity philosophy"
        :options="equityPhilosophyOptions"
        :error="errors.equityPhilosophy"
      />
    </section>

    <section v-show="step === 2" class="gap-5 grid">
      <PillPicker
        v-model="form.industries"
        label="Industries"
        :options="industryOptions"
        :error="errors.industries"
      />
      <PillPicker
        v-model="form.companyPreferences"
        label="Company preferences"
        :options="companyPreferenceOptions"
        :error="errors.companyPreferences"
      />
      <p class="muted text-sm leading-6">
        Intros require a completed profile and verification.
      </p>
    </section>

    <div class="flex flex-wrap gap-3 items-center justify-between">
      <div class="flex gap-3">
        <BaseButton variant="secondary" :disabled="step === 0" @click="previousStep">
          Back
        </BaseButton>
        <BaseButton v-if="step < steps.length - 1" variant="secondary" @click="nextStep">
          Next
        </BaseButton>
      </div>
      <BaseButton v-if="step === steps.length - 1" type="submit">
        {{ submitLabel }}
      </BaseButton>
    </div>
  </form>
</template>
