<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue"
import { navigateTo, useRoute } from "#app"
import { definePageMeta } from "#app/composables/pages"
import { $fetch } from "#build/fetch"
import { NuxtLink } from "#components"
import SelectInput from "~/components/forms/SelectInput.vue"
import TextareaInput from "~/components/forms/TextareaInput.vue"
import TextInput from "~/components/forms/TextInput.vue"
import BaseButton from "~/components/ui/BaseButton.vue"
import { usePageSeo } from "~/composables/usePageSeo"
import { useProductAccess } from "~/composables/useProductAccess"
import { accessRequestSchema, signUpSchema } from "~/shared/utils/validation"
import { useAuthStore } from "~/stores/auth"
import { useToastStore } from "~/stores/toast"

definePageMeta({
  layout: "auth",
  middleware: ["guest"],
})

usePageSeo("Create account")

interface InviteValidation {
  request: { email: string, name: string } | null
  valid: boolean
}

const authStore = useAuthStore()
const toastStore = useToastStore()
const route = useRoute()
const { buildAccessRequestPath, policy } = useProductAccess()
const pricingPath = buildAccessRequestPath("auth-sign-up", "pricing")
const inviteToken = typeof route.query.invite === "string"
  ? route.query.invite.trim()
  : ""
const inviteEmail = typeof route.query.email === "string"
  ? route.query.email.trim()
  : ""
const requestSource = typeof route.query.source === "string"
  ? route.query.source.trim()
  : "auth-sign-up"
const inviteValidation = ref<InviteValidation>({ request: null, valid: false })

if (inviteToken) {
  try {
    inviteValidation.value = await $fetch<InviteValidation>("/api/access-requests/invite", {
      body: {
        email: inviteEmail,
        token: inviteToken,
      },
      method: "POST",
    })
  }
  catch {
    inviteValidation.value = { request: null, valid: false }
  }
}

onMounted(() => {
  if (!inviteToken)
    return

  const sanitizedUrl = new URL(window.location.href)
  sanitizedUrl.searchParams.delete("email")
  sanitizedUrl.searchParams.delete("invite")
  window.history.replaceState(
    window.history.state,
    "",
    `${sanitizedUrl.pathname}${sanitizedUrl.search}`,
  )
})

const form = reactive({
  email: inviteValidation.value.request?.email || inviteEmail,
  inviteToken: inviteToken || undefined,
  name: inviteValidation.value.request?.name || "",
  password: "",
})
const errors = ref<Record<string, string>>({})
const accessForm = reactive({
  company: "",
  companyStage: "not_sure",
  email: inviteEmail,
  name: "",
  role: "founder",
  source: requestSource,
  timeline: "exploring",
  useCase: "",
  website: "",
})
const accessErrors = ref<Record<string, string>>({})
const accessPending = ref(false)
const accessSubmitted = ref(false)
const verificationPending = ref(false)

const shouldShowAccountForm = computed(() => !policy.value.marketingShellOnly || inviteValidation.value.valid)

const roleOptions = [
  { label: "Founder", value: "founder" },
  { label: "Collaborator", value: "collaborator" },
  { label: "Venture studio", value: "studio" },
  { label: "Investor", value: "investor" },
  { label: "Other", value: "other" },
]

const stageOptions = [
  { label: "Idea", value: "idea" },
  { label: "Prototype", value: "prototype" },
  { label: "MVP", value: "mvp" },
  { label: "Revenue", value: "revenue" },
  { label: "Growth", value: "growth" },
  { label: "Not sure", value: "not_sure" },
]

const timelineOptions = [
  { label: "Ready now", value: "now" },
  { label: "Within 30 days", value: "30_days" },
  { label: "Within 90 days", value: "90_days" },
  { label: "Still exploring", value: "exploring" },
]

async function submitForm() {
  errors.value = {}
  const result = signUpSchema.safeParse(form)
  if (!result.success) {
    errors.value = Object.fromEntries(result.error.issues.map(issue => [issue.path[0] as string, issue.message]))
    return
  }

  try {
    const response = await authStore.signUp(result.data)
    if (!response.session) {
      verificationPending.value = true
      toastStore.push({
        title: "Confirm your email",
        message: "Open the verification link sent to your email before signing in.",
        tone: "success",
      })
      return
    }

    toastStore.push({
      title: "Account created",
      message: "Next step: complete your onboarding profile so matching can start.",
      tone: "success",
    })
    await navigateTo(response.session.onboardingCompleted ? "/app" : "/onboarding")
  }
  catch {}
}

async function submitAccessRequest() {
  accessErrors.value = {}
  const result = accessRequestSchema.safeParse(accessForm)
  if (!result.success) {
    accessErrors.value = Object.fromEntries(result.error.issues.map(issue => [issue.path[0] as string, issue.message]))
    return
  }

  accessPending.value = true
  try {
    await $fetch("/api/access-requests", {
      body: result.data,
      method: "POST",
    })
    accessSubmitted.value = true
    toastStore.push({
      title: "Request received",
      message: "Workspace access is subject to review.",
      tone: "success",
    })
  }
  catch (caughtError) {
    accessErrors.value = {
      form: caughtError instanceof Error
        ? caughtError.message
        : "The request could not be submitted.",
    }
  }
  finally {
    accessPending.value = false
  }
}
</script>

<template>
  <div>
    <template v-if="!shouldShowAccountForm">
      <h1 class="text-3xl tracking-tight font-semibold">
        Request workspace access.
      </h1>

      <div v-if="inviteToken" class="panel-inset mt-8 p-5 border border-[var(--warning)]">
        <p class="text-sm text-[var(--warning)] font-semibold">
          This invite link is no longer valid.
        </p>
        <p class="muted text-sm leading-6 mt-2">
          Request access again or contact the team if you expected this invite to work.
        </p>
      </div>

      <div v-if="accessSubmitted" class="panel-inset mt-8 p-5">
        <p class="text-sm font-semibold">
          Request received.
        </p>
        <p class="muted text-sm leading-6 mt-2">
          Workspace access is subject to review.
        </p>
        <div class="mt-5 flex flex-wrap gap-3">
          <BaseButton variant="secondary" to="/auth/sign-in">
            Sign in
          </BaseButton>
          <BaseButton variant="secondary" to="/find-cofounder">
            Browse public directory
          </BaseButton>
        </div>
      </div>

      <form v-else class="mt-8 gap-4 grid" @submit.prevent="submitAccessRequest">
        <TextInput v-model="accessForm.name" label="Full name" :error="accessErrors.name" required />
        <TextInput v-model="accessForm.email" label="Email" type="email" :error="accessErrors.email" required />
        <TextInput v-model="accessForm.company" label="Company or project" helper="Use the company name, project name, or problem space if there is no company yet." :error="accessErrors.company" />
        <div class="gap-4 grid sm:grid-cols-3">
          <SelectInput v-model="accessForm.role" label="Role" :options="roleOptions" :error="accessErrors.role" />
          <SelectInput v-model="accessForm.companyStage" label="Stage" :options="stageOptions" :error="accessErrors.companyStage" />
          <SelectInput v-model="accessForm.timeline" label="Timeline" :options="timelineOptions" :error="accessErrors.timeline" />
        </div>
        <TextareaInput
          v-model="accessForm.useCase"
          label="What do you need CoFoundry for?"
          placeholder="Share enough context for an operator to understand the founder/collaborator search, team setup, proposal workflow, or agreement workflow you want to use."
          helper="Minimum 40 characters."
          :rows="6"
          :error="accessErrors.useCase"
        />
        <input v-model="accessForm.website" class="hidden" autocomplete="off" tabindex="-1" aria-hidden="true">
        <p v-if="accessErrors.form" class="field-error">
          {{ accessErrors.form }}
        </p>
        <BaseButton type="submit" block :disabled="accessPending">
          {{ accessPending ? "Submitting request..." : "Request access" }}
        </BaseButton>
      </form>

      <div class="mt-8 flex flex-wrap gap-3">
        <BaseButton variant="secondary" :to="pricingPath">
          View pricing
        </BaseButton>
        <BaseButton variant="secondary" to="/auth/sign-in">
          Sign in
        </BaseButton>
        <BaseButton variant="secondary" to="/find-cofounder">
          Browse public directory
        </BaseButton>
      </div>
    </template>
    <template v-else-if="verificationPending">
      <h1 class="text-3xl tracking-tight font-semibold">
        Check your email.
      </h1>
      <p class="muted text-sm leading-6 mt-3">
        Confirm your email address using the link we sent before signing in.
      </p>
      <BaseButton class="mt-8" to="/auth/sign-in">
        Go to sign in
      </BaseButton>
    </template>
    <template v-else>
      <h1 class="text-3xl tracking-tight font-semibold">
        {{ inviteValidation.valid ? "Create your invited account." : "Create your account." }}
      </h1>
      <p v-if="inviteValidation.valid" class="muted text-sm leading-6 mt-3">
        This invite is tied to the approved email below.
      </p>

      <form class="mt-8 gap-4 grid" @submit.prevent="submitForm">
        <TextInput v-model="form.name" label="Full name" :error="errors.name" />
        <TextInput v-model="form.email" label="Email" type="email" :error="errors.email || authStore.error" />
        <TextInput v-model="form.password" label="Password" type="password" helper="Use at least 12 characters." :error="errors.password" />
        <BaseButton type="submit" block :disabled="authStore.pending">
          {{ authStore.pending ? "Creating account..." : "Create account" }}
        </BaseButton>
      </form>

      <p class="muted text-sm mt-6">
        Already have an account?
        <NuxtLink to="/auth/sign-in" class="text-[var(--accent)] font-semibold">
          Sign in
        </NuxtLink>
      </p>
    </template>
  </div>
</template>
