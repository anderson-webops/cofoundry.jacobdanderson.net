<script setup lang="ts">
import { commitmentOptions, compensationOptions, industryOptions, remoteOptions, roleOptions, stageOptions, valueOptions, workStyleOptions } from "~/shared/constants/options"
import { formatCompensation } from "~/shared/utils/format"
import { onboardingSchema } from "~/shared/utils/validation"

const props = withDefaults(defineProps<{
  initialValues?: Partial<{
    displayName: string
    headline: string
    bio: string
    location: string
    remotePreference: "remote" | "hybrid" | "in_person"
    roles: string[]
    yearsExperience: number
    industries: string[]
    startupStagePreferences: ("idea" | "prototype" | "mvp" | "revenue" | "growth")[]
    compensationPreferences: ("equity_only" | "cash_and_equity" | "cash_only" | "advisory")[]
    equityExpectationRange: string
    timeCommitment: "nights_weekends" | "part_time" | "full_time"
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

const form = reactive({
  displayName: props.initialValues.displayName || "",
  headline: props.initialValues.headline || "",
  bio: props.initialValues.bio || "",
  location: props.initialValues.location || "",
  remotePreference: props.initialValues.remotePreference || "remote",
  roles: props.initialValues.roles || [],
  yearsExperience: props.initialValues.yearsExperience || 0,
  industries: props.initialValues.industries || [],
  startupStagePreferences: props.initialValues.startupStagePreferences || [],
  compensationPreferences: props.initialValues.compensationPreferences || [],
  equityExpectationRange: props.initialValues.equityExpectationRange || "",
  timeCommitment: props.initialValues.timeCommitment || "part_time",
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
  { title: "Fit", description: "Stage, commitment, compensation, and industry fit." },
  { title: "Links", description: "Links and relationship intent." },
  { title: "Values", description: "Work style and privacy controls." },
]

function validateForSubmit() {
  const parsed = onboardingSchema.safeParse({
    ...form,
    yearsExperience: Number(form.yearsExperience),
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
    <div v-if="stepped" class="gap-4 grid md:grid-cols-4">
      <div
        v-for="(item, index) in steps"
        :key="item.title"
        class="p-4 border rounded-[1.25rem]"
        :class="index === step ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line)] bg-[var(--panel-inset)]'"
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
      <TextInput v-model="form.headline" label="Headline" :error="errors.headline" helper="State the role you want and the kind of company you want to build." />
      <TextareaInput v-model="form.bio" label="Bio" :error="errors.bio" rows="6" />
      <SelectInput v-model="form.remotePreference" label="Remote preference" :options="remoteOptions" :error="errors.remotePreference" />
      <PillPicker v-model="form.roles" label="Roles" :options="roleOptions" helper="Pick the roles you want to be discovered for." />
      <TextInput v-model="form.yearsExperience" label="Years of experience" type="number" :error="errors.yearsExperience" />
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
    </section>

    <section v-show="!stepped || step === 2" class="gap-4 grid">
      <div class="gap-4 grid md:grid-cols-2">
        <TextInput v-model="form.linkedin" label="LinkedIn" :error="errors.linkedin" />
        <TextInput v-model="form.github" label="GitHub" :error="errors.github" />
      </div>
      <div class="gap-4 grid md:grid-cols-2">
        <TextInput v-model="form.portfolio" label="Portfolio" :error="errors.portfolio" />
        <TextInput v-model="form.website" label="Personal site" :error="errors.website" />
      </div>
      <div class="gap-4 grid md:grid-cols-2">
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
      </div>
    </section>

    <section v-show="!stepped || step === 3" class="gap-4 grid">
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
