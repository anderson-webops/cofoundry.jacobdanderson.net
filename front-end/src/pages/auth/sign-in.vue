<script setup lang="ts">
import { signInSchema } from "~/shared/utils/validation"

definePageMeta({
  layout: "auth",
  middleware: ["guest"],
})

usePageSeo("Sign in")

const authStore = useAuthStore()
const toastStore = useToastStore()
const route = useRoute()
const { buildAccessRequestPath, policy } = useProductAccess()
const accessRequestPath = buildAccessRequestPath("auth-sign-in", "access")
const talkToTeamPath = buildAccessRequestPath("auth-sign-in", "contact")

const form = reactive({
  email: "",
  password: "",
})
const errors = ref<Record<string, string>>({})
const oauthErrorMessage = computed(() => {
  const code = typeof route.query.error === "string" ? route.query.error : ""
  const messages: Record<string, string> = {
    account_inactive: "That account is not active. Contact the team if you think this is wrong.",
    oauth_failed: "Provider sign-in could not be completed. Use email/password or request account help.",
    oauth_provider_disabled: "That provider is not enabled for this deployment yet.",
    oauth_unavailable: "Provider sign-in is not available in this environment.",
  }

  return messages[code] || ""
})

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
        : "Use your account credentials to continue discovery, messaging, proposals, and agreements." }}
    </p>

    <div v-if="oauthErrorMessage" class="bg-[color:color-mix(in_srgb,var(--danger)_10%,transparent)] text-sm text-[var(--danger)] mt-5 p-4 border border-[color:color-mix(in_srgb,var(--danger)_28%,transparent)] rounded-3xl">
      {{ oauthErrorMessage }}
    </div>

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
    <p class="muted text-sm mt-4">
      Cannot sign in or lost your invite?
      <NuxtLink to="/auth/recover" class="text-[var(--accent)] font-semibold">
        Request account help
      </NuxtLink>
    </p>

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
      <p class="muted text-sm mt-6">
        New to CoFoundry?
        <NuxtLink to="/auth/sign-up" class="text-[var(--accent)] font-semibold">
          Create an account
        </NuxtLink>
      </p>
    </template>
  </div>
</template>
