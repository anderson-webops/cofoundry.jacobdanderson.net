<script setup lang="ts">
import { signUpSchema } from "~/shared/utils/validation"

definePageMeta({
  layout: "auth",
  middleware: ["guest"],
})

usePageSeo("Create account")

const authStore = useAuthStore()
const toastStore = useToastStore()
const { buildAccessRequestPath, policy } = useProductAccess()
const accessRequestPath = buildAccessRequestPath("auth-sign-up", "access")
const pricingPath = buildAccessRequestPath("auth-sign-up", "pricing")

const form = reactive({
  name: "",
  email: "",
  password: "",
})
const errors = ref<Record<string, string>>({})

async function submitForm() {
  errors.value = {}
  const result = signUpSchema.safeParse(form)
  if (!result.success) {
    errors.value = Object.fromEntries(result.error.issues.map(issue => [issue.path[0] as string, issue.message]))
    return
  }

  try {
    const session = await authStore.signUp(result.data)
    toastStore.push({
      title: "Account created",
      message: "Next step: complete your onboarding profile so matching can start.",
      tone: "success",
    })
    await navigateTo(session.onboardingCompleted ? "/app" : "/onboarding")
  }
  catch {}
}
</script>

<template>
  <div>
    <p class="section-kicker">
      Create account
    </p>
    <template v-if="policy.marketingShellOnly">
      <h2 class="text-3xl tracking-tight font-semibold mt-3">
        Request workspace access.
      </h2>
      <p class="muted text-sm leading-6 mt-3">
        Public pages are open now. Member workspaces are being opened deliberately.
      </p>

      <div class="panel-inset mt-8 p-5">
        <p class="text-sm font-semibold">
          Include these details in your request
        </p>
        <div class="muted text-sm leading-6 mt-3 gap-3 grid">
          <div>Your role in the search: founder, collaborator, or venture studio lead.</div>
          <div>The company or problem space you are actively working on.</div>
          <div>Whether you need individual access, team setup, or pricing detail.</div>
        </div>
      </div>

      <div class="mt-8 flex flex-wrap gap-3">
        <BaseButton :to="accessRequestPath">
          Request access
        </BaseButton>
        <BaseButton variant="secondary" :to="pricingPath">
          Talk about pricing
        </BaseButton>
        <BaseButton variant="secondary" to="/auth/sign-in">
          Sign in
        </BaseButton>
        <BaseButton variant="secondary" to="/find-cofounder">
          Browse public directory
        </BaseButton>
      </div>
    </template>
    <template v-else>
      <h2 class="text-3xl tracking-tight font-semibold mt-3">
        Create your account.
      </h2>
      <p class="muted text-sm leading-6 mt-3">
        Start with the basics now. You can finish the rest of your profile during onboarding.
      </p>

      <form class="mt-8 gap-4 grid" @submit.prevent="submitForm">
        <TextInput v-model="form.name" label="Full name" :error="errors.name" />
        <TextInput v-model="form.email" label="Email" type="email" :error="errors.email || authStore.error" />
        <TextInput v-model="form.password" label="Password" type="password" helper="Use at least 8 characters." :error="errors.password" />
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
