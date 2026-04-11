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
const defaultDemoAccount = demoAccounts[0] || { email: "", password: "" }

const form = reactive({
  email: defaultDemoAccount.email,
  password: defaultDemoAccount.password,
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
    title: `${provider === "google" ? "Google" : "GitHub"} demo sign-in`,
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
      Pick up the founder conversation where you left it.
    </h2>
    <p class="muted text-sm leading-6 mt-3">
      Local development ships with seeded demo accounts. Real auth can use Supabase when keys are configured.
    </p>

    <form class="mt-8 gap-4 grid" @submit.prevent="submitForm">
      <TextInput v-model="form.email" label="Email" type="email" :error="errors.email || authStore.error" />
      <TextInput v-model="form.password" label="Password" type="password" :error="errors.password" />
      <BaseButton type="submit" block :disabled="authStore.pending">
        {{ authStore.pending ? "Signing in..." : "Sign in" }}
      </BaseButton>
    </form>

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
        Demo accounts
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

    <p class="muted text-sm mt-6">
      New to CoFoundry?
      <NuxtLink to="/auth/sign-up" class="text-[var(--accent)] font-semibold">
        Create an account
      </NuxtLink>
    </p>
  </div>
</template>
