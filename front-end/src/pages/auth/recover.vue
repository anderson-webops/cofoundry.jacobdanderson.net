<script setup lang="ts">
import { accessRequestSchema } from "~/shared/utils/validation"

definePageMeta({
  layout: "auth",
  middleware: ["guest"],
})

usePageSeo("Account access help")

const route = useRoute()
const toastStore = useToastStore()
const initialEmail = typeof route.query.email === "string"
  ? route.query.email.trim()
  : ""
const initialSource = typeof route.query.source === "string"
  ? route.query.source.trim()
  : "auth-recovery"

const form = reactive({
  company: "",
  companyStage: "not_sure" as const,
  email: initialEmail,
  name: "",
  role: "other" as const,
  source: initialSource || "auth-recovery",
  timeline: "now" as const,
  useCase: "",
  website: "",
})
const errors = ref<Record<string, string>>({})
const submitted = ref(false)
const submitting = ref(false)

function buildQueuePayload() {
  return {
    ...form,
    useCase: [
      "Account access help request.",
      form.useCase.trim(),
      "",
      "Operator note: verify account ownership before issuing a new invite, changing account access, or advising on password reset.",
    ].join("\n").trim(),
  }
}

async function submitRecoveryRequest() {
  errors.value = {}
  if (form.useCase.trim().length < 20) {
    errors.value = {
      useCase: "Include enough detail for an operator to verify and route the account issue.",
    }
    return
  }

  const result = accessRequestSchema.safeParse(buildQueuePayload())
  if (!result.success) {
    errors.value = Object.fromEntries(result.error.issues.map(issue => [issue.path[0] as string, issue.message]))
    return
  }

  submitting.value = true

  try {
    await $fetch("/api/access-requests", {
      body: result.data,
      method: "POST",
    })
    submitted.value = true
    toastStore.push({
      title: "Request received",
      message: "We received your account-help request.",
      tone: "success",
    })
  }
  catch (caughtError) {
    errors.value = {
      form: caughtError instanceof Error
        ? caughtError.message
        : "The account-help request could not be submitted.",
    }
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-3xl tracking-tight font-semibold">
      Recover workspace access.
    </h1>
    <p class="muted text-sm leading-6 mt-3">
      The team will verify account ownership before changing access. Do not include passwords or secret reset links.
    </p>

    <div v-if="submitted" class="panel-inset mt-8 p-5">
      <p class="text-sm font-semibold">
        Request received.
      </p>
      <p class="muted text-sm leading-6 mt-2">
        Do not share passwords or secret reset links in follow-up messages.
      </p>
      <div class="mt-5 flex flex-wrap gap-3">
        <BaseButton variant="secondary" to="/auth/sign-in">
          Back to sign in
        </BaseButton>
        <BaseButton variant="secondary" to="/contact?topic=account">
          Contact support
        </BaseButton>
      </div>
    </div>

    <form v-else class="mt-8 gap-4 grid" @submit.prevent="submitRecoveryRequest">
      <TextInput v-model="form.name" label="Name" :error="errors.name" />
      <TextInput v-model="form.email" label="Account email" type="email" :error="errors.email" />
      <TextInput v-model="form.company" label="Company or project" :error="errors.company" />
      <TextareaInput
        v-model="form.useCase"
        label="What happened?"
        :error="errors.useCase"
        :rows="5"
        placeholder="Tell us whether you lost an invite, cannot remember which email you used, need a password reset, or are seeing an error after signing in."
      />
      <input v-model="form.website" type="text" name="website" autocomplete="off" tabindex="-1" class="sr-only" aria-hidden="true">
      <p v-if="errors.form" class="text-sm text-[var(--danger)]">
        {{ errors.form }}
      </p>
      <div class="flex flex-wrap gap-3">
        <BaseButton type="submit" :disabled="submitting">
          {{ submitting ? "Submitting..." : "Request account help" }}
        </BaseButton>
        <BaseButton variant="secondary" to="/auth/sign-in">
          Back to sign in
        </BaseButton>
      </div>
    </form>
  </div>
</template>
