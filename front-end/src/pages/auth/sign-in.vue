<script setup lang="ts">
import { signInSchema } from "~/shared/utils/validation"

definePageMeta({
  layout: "auth",
  middleware: ["guest"],
})

usePageSeo("Sign in")

const authStore = useAuthStore()
const toastStore = useToastStore()
const { buildAccessRequestPath, policy } = useProductAccess()
const accessRequestPath = buildAccessRequestPath("auth-sign-in", "access")
const talkToTeamPath = buildAccessRequestPath("auth-sign-in", "contact")

const form = reactive({
  email: "",
  password: "",
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
      <p class="muted text-sm mt-6">
        New to CoFoundry?
        <NuxtLink to="/auth/sign-up" class="text-[var(--accent)] font-semibold">
          Create an account
        </NuxtLink>
      </p>
    </template>
  </div>
</template>
