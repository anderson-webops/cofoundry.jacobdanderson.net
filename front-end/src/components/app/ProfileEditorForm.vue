<script setup lang="ts">
import {
  commitmentOptions,
  companyPreferenceOptions,
  compensationOptions,
  currentWorkStatusOptions,
  deadlockPreferenceOptions,
  decisionModelOptions,
  equityPhilosophyOptions,
  industryOptions,
  leadershipPreferenceOptions,
  nonNegotiableOptions,
  priorObligationOptions,
  remoteOptions,
  roleOptions,
  runwayBucketOptions,
  stageOptions,
  startTimelineOptions,
  valueOptions,
  workStyleOptions,
} from "~/shared/constants/options"
import { formatCompensation } from "~/shared/utils/format"
import { onboardingSchema } from "~/shared/utils/validation"

const props = withDefaults(defineProps<{
  initialValues?: Partial<{
    displayName: string
    photoUrl: string
    headline: string
    bio: string
    location: string
    remotePreference: "remote" | "hybrid" | "in_person"
    primaryRole: string
    roles: string[]
    yearsExperience: number
    industries: string[]
    startupStagePreferences: ("idea" | "prototype" | "mvp" | "revenue" | "growth")[]
    compensationPreferences: ("equity_only" | "cash_and_equity" | "cash_only" | "advisory")[]
    equityExpectationRange: string
    timeCommitment: "nights_weekends" | "part_time" | "full_time"
    weeklyAvailabilityHours: number
    startTimeline: "immediately" | "30_days" | "90_days" | "exploring"
    fullTimeBy: string
    runwayBucket: "under_3_months" | "3_to_6_months" | "6_to_12_months" | "12_plus_months" | "undisclosed"
    currentStatus: "full_time_employed" | "consulting_part_time" | "between_roles" | "full_time_on_startup" | "exploring"
    equityPhilosophy: "equal_unless_strong_reason" | "contribution_weighted" | "dynamic_over_time"
    leadershipPreference: "wants_ceo_role" | "open_to_ceo_role" | "prefers_non_ceo_role"
    decisionModelPreference: "ceo_decides_with_input" | "area_owner_decides" | "consensus_for_big_bets"
    deadlockPreference: "advisor_tiebreaker" | "rotating_decider" | "board_mediator" | "neutral_operator"
    companyPreferences: string[]
    nonNegotiables: string[]
    introCapacity: string
    nonResponsibilities: string[]
    accountabilityMilestones: string[]
    existingAssets: string[]
    existingAssetsNotes: string
    priorObligations: "none_known" | "possible_constraints" | "confirmed_constraints"
    readyToAssignIp: boolean
    linkedin: string
    github: string
    portfolio: string
    website: string
    hasIdea: boolean
    wantsToJoinIdea: boolean
    values: string[]
    workStylePreferences: string[]
    profileVisibility: "public" | "members" | "private"
  }>
  submitLabel?: string
  stepped?: boolean
}>(), {
  initialValues: () => ({}),
  submitLabel: "Save profile",
  stepped: false,
})

const emit = defineEmits<{
  submitted: [payload: ReturnType<typeof onboardingSchema.parse>]
}>()

const step = ref(0)
const errors = ref<Record<string, string>>({})
const nonResponsibilitiesText = ref((props.initialValues.nonResponsibilities || []).join("\n"))
const accountabilityMilestonesText = ref((props.initialValues.accountabilityMilestones || []).join("\n"))
const existingAssetsText = ref((props.initialValues.existingAssets || []).join("\n"))

const form = reactive({
  displayName: props.initialValues.displayName || "",
  photoUrl: props.initialValues.photoUrl || "",
  headline: props.initialValues.headline || "",
  bio: props.initialValues.bio || "",
  location: props.initialValues.location || "",
  remotePreference: props.initialValues.remotePreference || "remote",
  primaryRole: props.initialValues.primaryRole || props.initialValues.roles?.[0] || "",
  roles: props.initialValues.roles || [],
  yearsExperience: String(props.initialValues.yearsExperience || 0),
  industries: props.initialValues.industries || [],
  startupStagePreferences: props.initialValues.startupStagePreferences || [],
  compensationPreferences: props.initialValues.compensationPreferences || [],
  equityExpectationRange: props.initialValues.equityExpectationRange || "",
  timeCommitment: props.initialValues.timeCommitment || "part_time",
  weeklyAvailabilityHours: String(props.initialValues.weeklyAvailabilityHours || 10),
  startTimeline: props.initialValues.startTimeline || "exploring",
  fullTimeBy: props.initialValues.fullTimeBy || "",
  runwayBucket: props.initialValues.runwayBucket || "undisclosed",
  currentStatus: props.initialValues.currentStatus || "exploring",
  equityPhilosophy: props.initialValues.equityPhilosophy || "equal_unless_strong_reason",
  leadershipPreference: props.initialValues.leadershipPreference || "open_to_ceo_role",
  decisionModelPreference: props.initialValues.decisionModelPreference || "area_owner_decides",
  deadlockPreference: props.initialValues.deadlockPreference || "advisor_tiebreaker",
  companyPreferences: props.initialValues.companyPreferences || [],
  nonNegotiables: props.initialValues.nonNegotiables || [],
  introCapacity: props.initialValues.introCapacity || "",
  existingAssetsNotes: props.initialValues.existingAssetsNotes || "",
  priorObligations: props.initialValues.priorObligations || "none_known",
  readyToAssignIp: props.initialValues.readyToAssignIp ?? true,
  linkedin: props.initialValues.linkedin || "",
  github: props.initialValues.github || "",
  portfolio: props.initialValues.portfolio || "",
  website: props.initialValues.website || "",
  hasIdea: props.initialValues.hasIdea ?? true,
  wantsToJoinIdea: props.initialValues.wantsToJoinIdea ?? false,
  values: props.initialValues.values || [],
  workStylePreferences: props.initialValues.workStylePreferences || [],
  profileVisibility: props.initialValues.profileVisibility || "members",
})

const steps = [
  { title: "Basics", description: "Identity, summary, and role signal." },
  { title: "Fit", description: "Stage, commitment, timing, and company fit." },
  { title: "Alignment", description: "Governance, scope boundaries, and IP readiness." },
  { title: "Links", description: "Links and relationship intent." },
  { title: "Values", description: "Work style and privacy controls." },
]

function validateForSubmit() {
  const parsed = onboardingSchema.safeParse({
    ...form,
    roles: Array.from(new Set([form.primaryRole, ...form.roles].filter(Boolean))),
    yearsExperience: Number(form.yearsExperience),
    weeklyAvailabilityHours: Number(form.weeklyAvailabilityHours),
    nonResponsibilities: nonResponsibilitiesText.value.split("\n").map(item => item.trim()).filter(Boolean),
    accountabilityMilestones: accountabilityMilestonesText.value.split("\n").map(item => item.trim()).filter(Boolean),
    existingAssets: existingAssetsText.value.split("\n").map(item => item.trim()).filter(Boolean),
  })

  if (!parsed.success) {
    errors.value = Object.fromEntries(parsed.error.issues.map(issue => [issue.path[0] as string, issue.message]))
    return null
  }

  errors.value = {}
  return parsed.data
}

function nextStep() {
  step.value = Math.min(step.value + 1, steps.length - 1)
}

function previousStep() {
  step.value = Math.max(step.value - 1, 0)
}

function submitForm() {
  const parsed = validateForSubmit()
  if (!parsed)
    return

  emit("submitted", parsed)
}
</script>

<template>
  <form class="gap-8 grid" @submit.prevent="submitForm">
    <div v-if="stepped" class="gap-3 grid md:grid-cols-5">
      <div
        v-for="(item, index) in steps"
        :key="item.title"
        class="step-card"
        :class="index === step ? 'step-card-active' : ''"
      >
        <p class="text-sm font-semibold">
          {{ item.title }}
        </p>
        <p class="muted text-xs leading-5 mt-2">
          {{ item.description }}
        </p>
      </div>
    </div>

    <section v-show="!stepped || step === 0" class="gap-4 grid">
      <div class="gap-4 grid md:grid-cols-2">
        <TextInput v-model="form.displayName" label="Name" :error="errors.displayName" />
        <TextInput v-model="form.location" label="Location" :error="errors.location" />
      </div>
      <TextInput
        v-model="form.photoUrl"
        label="Profile photo URL"
        type="url"
        helper="Use a clear headshot or recognizable profile image. This counts toward profile readiness."
        :error="errors.photoUrl"
      />
      <TextInput v-model="form.headline" label="Headline" :error="errors.headline" helper="State the role you want and the kind of company you want to build." />
      <TextareaInput v-model="form.bio" label="Bio" :error="errors.bio" :rows="6" />
      <SelectInput v-model="form.remotePreference" label="Remote preference" :options="remoteOptions" :error="errors.remotePreference" />
      <div class="gap-4 grid md:grid-cols-2">
        <SelectInput v-model="form.primaryRole" label="Primary role" :options="roleOptions.map(role => ({ label: role, value: role }))" :error="errors.primaryRole" />
        <TextInput v-model="form.yearsExperience" label="Years of experience" type="number" :error="errors.yearsExperience" />
      </div>
      <PillPicker v-model="form.roles" label="Role coverage" :options="roleOptions" helper="Pick the other roles you can credibly own in the first year." />
    </section>

    <section v-show="!stepped || step === 1" class="gap-4 grid">
      <PillPicker v-model="form.industries" label="Industries" :options="industryOptions" />
      <div>
        <span class="field-label">Startup stage preference</span>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="option in stageOptions"
            :key="option.value"
            type="button"
            class="pill"
            :class="form.startupStagePreferences.includes(option.value) ? 'pill-active' : ''"
            @click="form.startupStagePreferences = form.startupStagePreferences.includes(option.value) ? form.startupStagePreferences.filter(item => item !== option.value) : [...form.startupStagePreferences, option.value]"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
      <div>
        <span class="field-label">Compensation preference</span>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="option in compensationOptions"
            :key="option"
            type="button"
            class="pill"
            :class="form.compensationPreferences.includes(option) ? 'pill-active' : ''"
            @click="form.compensationPreferences = form.compensationPreferences.includes(option) ? form.compensationPreferences.filter(item => item !== option) : [...form.compensationPreferences, option]"
          >
            {{ formatCompensation(option) }}
          </button>
        </div>
      </div>
      <div class="gap-4 grid md:grid-cols-2">
        <TextInput v-model="form.equityExpectationRange" label="Equity expectation range" :error="errors.equityExpectationRange" />
        <SelectInput v-model="form.timeCommitment" label="Time commitment" :options="commitmentOptions" :error="errors.timeCommitment" />
      </div>
      <div class="gap-4 grid md:grid-cols-3">
        <TextInput v-model="form.weeklyAvailabilityHours" label="Hours per week" type="number" :error="errors.weeklyAvailabilityHours" />
        <SelectInput v-model="form.startTimeline" label="Start timeline" :options="startTimelineOptions" :error="errors.startTimeline" />
        <TextInput v-model="form.fullTimeBy" label="Full-time by" type="date" :error="errors.fullTimeBy" />
      </div>
      <div class="gap-4 grid md:grid-cols-3">
        <SelectInput v-model="form.runwayBucket" label="Runway" :options="runwayBucketOptions" :error="errors.runwayBucket" />
        <SelectInput v-model="form.currentStatus" label="Current work status" :options="currentWorkStatusOptions" :error="errors.currentStatus" />
        <TextInput
          v-model="form.introCapacity"
          label="Conversation capacity"
          helper="Example: Can take 2 founder conversations this month."
          :error="errors.introCapacity"
        />
      </div>
      <SelectInput
        v-model="form.equityPhilosophy"
        label="Equity philosophy"
        helper="This makes early equity conversations more legible before a proposal starts."
        :options="equityPhilosophyOptions"
        :error="errors.equityPhilosophy"
      />
      <PillPicker
        v-model="form.companyPreferences"
        label="Company preferences"
        :options="companyPreferenceOptions"
        helper="These preferences improve ranking and help other members decide whether the fit is real."
      />
      <PillPicker
        v-model="form.nonNegotiables"
        label="Non-negotiables"
        :options="nonNegotiableOptions"
        helper="State the conditions that should be explicit before anyone reaches for a proposal."
      />
    </section>

    <section v-show="!stepped || step === 2" class="gap-4 grid">
      <div class="gap-4 grid md:grid-cols-2">
        <SelectInput v-model="form.leadershipPreference" label="Leadership preference" :options="leadershipPreferenceOptions" :error="errors.leadershipPreference" />
        <SelectInput v-model="form.decisionModelPreference" label="Decision model" :options="decisionModelOptions" :error="errors.decisionModelPreference" />
      </div>
      <SelectInput
        v-model="form.deadlockPreference"
        label="Deadlock preference"
        helper="How should the team break ties when consensus breaks down?"
        :options="deadlockPreferenceOptions"
        :error="errors.deadlockPreference"
      />
      <TextareaInput
        v-model="nonResponsibilitiesText"
        label="Non-responsibilities"
        helper="One per line. State the things you do not want to own in the first 12 months."
        :rows="4"
        :error="errors.nonResponsibilities"
      />
      <TextareaInput
        v-model="accountabilityMilestonesText"
        label="Accountability milestones"
        helper="One per line. Describe the milestones you expect your role to be judged against."
        :rows="4"
        :error="errors.accountabilityMilestones"
      />
      <TextareaInput
        v-model="existingAssetsText"
        label="Pre-existing assets"
        helper="One per line. List existing code, designs, data, domains, or customer assets that matter before a proposal."
        :rows="4"
        :error="errors.existingAssets"
      />
      <TextareaInput
        v-model="form.existingAssetsNotes"
        label="IP notes"
        helper="Add the context future proposals or counsel would need."
        :rows="4"
        :error="errors.existingAssetsNotes"
      />
      <div class="gap-4 grid md:grid-cols-2">
        <SelectInput v-model="form.priorObligations" label="Employer or invention constraints" :options="priorObligationOptions" :error="errors.priorObligations" />
        <label class="panel-inset p-4 flex gap-3 items-start">
          <input v-model="form.readyToAssignIp" type="checkbox" class="mt-1">
          <span class="text-sm leading-6">I am ready to sign standard confidentiality and IP assignment terms if the proposal is accepted.</span>
        </label>
      </div>
    </section>

    <section v-show="!stepped || step === 3" class="gap-4 grid">
      <div class="gap-4 grid md:grid-cols-2">
        <TextInput v-model="form.linkedin" label="LinkedIn" :error="errors.linkedin" />
        <TextInput v-model="form.github" label="GitHub" :error="errors.github" />
      </div>
      <div class="gap-4 grid md:grid-cols-2">
        <TextInput v-model="form.portfolio" label="Portfolio" :error="errors.portfolio" />
        <TextInput v-model="form.website" label="Personal site" :error="errors.website" />
      </div>
      <div class="gap-4 grid md:grid-cols-3">
        <button type="button" class="panel-inset p-4 text-left" :class="form.hasIdea ? 'ring-2 ring-[var(--accent)]' : ''" @click="form.hasIdea = true; form.wantsToJoinIdea = false">
          <p class="text-sm font-semibold">
            I have an idea
          </p>
          <p class="muted text-sm mt-2">
            You want to find collaborators or co-founders for something you are already building.
          </p>
        </button>
        <button type="button" class="panel-inset p-4 text-left" :class="form.wantsToJoinIdea ? 'ring-2 ring-[var(--accent)]' : ''" @click="form.hasIdea = false; form.wantsToJoinIdea = true">
          <p class="text-sm font-semibold">
            I want to join one
          </p>
          <p class="muted text-sm mt-2">
            You are looking for a startup or founder team to commit to.
          </p>
        </button>
        <button type="button" class="panel-inset p-4 text-left" :class="form.hasIdea && form.wantsToJoinIdea ? 'ring-2 ring-[var(--accent)]' : ''" @click="form.hasIdea = true; form.wantsToJoinIdea = true">
          <p class="text-sm font-semibold">
            I can do either
          </p>
          <p class="muted text-sm mt-2">
            You are open to starting something with the right person or joining a strong founder if the fit is exceptional.
          </p>
        </button>
      </div>
    </section>

    <section v-show="!stepped || step === 4" class="gap-4 grid">
      <PillPicker v-model="form.values" label="Values" :options="valueOptions" />
      <PillPicker v-model="form.workStylePreferences" label="Work-style preferences" :options="workStyleOptions" />
      <SelectInput
        v-model="form.profileVisibility"
        label="Profile privacy"
        :options="[
          { label: 'Public-lite', value: 'public' },
          { label: 'Members only', value: 'members' },
          { label: 'Private', value: 'private' },
        ]"
        :error="errors.profileVisibility"
      />
    </section>

    <div class="flex flex-wrap gap-3 items-center justify-between">
      <div v-if="stepped" class="flex gap-3">
        <BaseButton variant="secondary" :disabled="step === 0" @click="previousStep">
          Back
        </BaseButton>
        <BaseButton v-if="step < steps.length - 1" variant="secondary" @click="nextStep">
          Next
        </BaseButton>
      </div>
      <BaseButton type="submit">
        {{ submitLabel }}
      </BaseButton>
    </div>
  </form>
</template>
