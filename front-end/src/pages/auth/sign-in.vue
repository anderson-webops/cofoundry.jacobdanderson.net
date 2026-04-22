<script setup lang="ts">
import { demoAccounts } from "~/shared/constants/app"
import { signInSchema } from "~/shared/utils/validation"

definePageMeta({
  layout: "auth",
  middleware: ["guest"],
})

usePageSeo("Sign in")

const authStore = useAuthStore()
const toastStore = useToastStore()
const { buildAccessRequestPath, policy } = useProductAccess()
const defaultDemoAccount = demoAccounts[0] || { email: "", password: "" }
const accessRequestPath = buildAccessRequestPath("auth-sign-in", "access")
const talkToTeamPath = buildAccessRequestPath("auth-sign-in", "contact")
const defaultCredentials = policy.value.showDemoConveniences
  ? defaultDemoAccount
  : { email: "", password: "" }

const form = reactive({
  email: defaultCredentials.email,
  password: defaultCredentials.password,
})
const errors = ref<Record<string, string>>({})

async function submitForm() {
  errors.value = {}
  const result = signInSchema.safeParse(form)
  if (!result.success) {
    errors.value = Object.fromEntries(result.error.issues.map(issue => [issue.path[0] as string, issue.message]))
    return
  }

  try {
    const session = await authStore.signIn(result.data)
    toastStore.push({
      title: "Signed in",
      message: `Welcome back, ${session.name}.`,
      tone: "success",
    })
    await navigateTo(session.onboardingCompleted ? "/app" : "/onboarding")
  }
  catch {}
}

async function signInWithProvider(provider: "google" | "github") {
  const session = await authStore.signInWithProvider(provider)
  toastStore.push({
    title: `Signed in with ${provider === "google" ? "Google" : "GitHub"}`,
    message: `Signed in as ${session.name}.`,
    tone: "success",
  })
  await navigateTo(session.onboardingCompleted ? "/app" : "/onboarding")
}
</script>

<template>
  <div>
    <p class="section-kicker">
      Sign in
    </p>
    <h2 class="text-3xl tracking-tight font-semibold mt-3">
      {{ policy.marketingShellOnly
        ? "Sign in to an existing workspace."
        : "Sign in to your workspace." }}
    </h2>
    <p class="muted text-sm leading-6 mt-3">
      {{ policy.marketingShellOnly
        ? "Use the email already attached to your approved account or invitation."
        : policy.showDemoConveniences
          ? "Use a review account or your own credentials to continue."
          : "Use your account credentials to continue discovery, messaging, proposals, and agreements." }}
    </p>

    <form class="mt-8 gap-4 grid" @submit.prevent="submitForm">
      <TextInput
        v-model="form.email"
        label="Email"
        type="email"
        :helper="policy.marketingShellOnly ? 'Use the email on your existing account or invitation.' : undefined"
        :error="errors.email || authStore.error"
      />
      <TextInput v-model="form.password" label="Password" type="password" :error="errors.password" />
      <BaseButton type="submit" block :disabled="authStore.pending">
        {{ authStore.pending ? "Signing in..." : "Sign in" }}
      </BaseButton>
    </form>

    <template v-if="policy.marketingShellOnly">
      <div class="panel-inset mt-8 p-5">
        <p class="text-sm font-semibold">
          Need access first?
        </p>
        <div class="muted text-sm leading-6 mt-3 gap-3 grid">
          <div>Browse public profiles, startup searches, trust pages, and founder guides first.</div>
          <div>Request access when you want discovery, messaging, proposals, and agreements inside the workspace.</div>
          <div>Contact the team for pricing or studio setup.</div>
        </div>
      </div>

      <div class="mt-8 flex flex-wrap gap-3">
        <BaseButton variant="secondary" :to="accessRequestPath">
          Request access
        </BaseButton>
        <BaseButton variant="secondary" to="/find-cofounder">
          Browse public directory
        </BaseButton>
        <BaseButton variant="secondary" :to="talkToTeamPath">
          Talk to the team
        </BaseButton>
      </div>
    </template>
    <template v-else>
      <template v-if="policy.showDemoConveniences">
        <div class="muted text-xs tracking-[0.18em] my-6 flex gap-3 uppercase items-center">
          <span class="bg-[var(--line)] flex-1 h-px" />
          <span>Or continue with</span>
          <span class="bg-[var(--line)] flex-1 h-px" />
        </div>

        <div class="gap-3 grid md:grid-cols-2">
          <BaseButton variant="secondary" block @click="signInWithProvider('google')">
            <span class="i-carbon-logo-google" />
            Google
          </BaseButton>
          <BaseButton variant="secondary" block @click="signInWithProvider('github')">
            <span class="i-carbon-logo-github" />
            GitHub
          </BaseButton>
        </div>

        <div class="panel-inset mt-8 p-4">
          <p class="text-sm font-semibold">
            Review accounts
          </p>
          <div class="muted text-sm mt-3 gap-2 grid">
            <button
              v-for="account in demoAccounts"
              :key="account.email"
              type="button"
              class="px-3 py-2 text-left rounded-2xl bg-[var(--panel-strong)] flex items-center justify-between"
              @click="form.email = account.email; form.password = account.password"
            >
              <span>{{ account.label }}</span>
              <span>{{ account.email }}</span>
            </button>
          </div>
        </div>
      </template>

      <p class="muted text-sm mt-6">
        New to CoFoundry?
        <NuxtLink to="/auth/sign-up" class="text-[var(--accent)] font-semibold">
          Create an account
        </NuxtLink>
      </p>
    </template>
  </div>
</template>
