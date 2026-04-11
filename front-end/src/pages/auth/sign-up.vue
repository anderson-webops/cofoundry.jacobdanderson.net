<script setup lang="ts">
import { signUpSchema } from "~/shared/utils/validation"

definePageMeta({
  layout: "auth",
  middleware: ["guest"],
})

usePageSeo("Create account")

const authStore = useAuthStore()
const toastStore = useToastStore()

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
    <h2 class="text-3xl tracking-tight font-semibold mt-3">
      Start with a clean profile and a serious intent signal.
    </h2>
    <p class="muted text-sm leading-6 mt-3">
      Founder relationships are high-trust and high-consequence. CoFoundry starts by asking enough to make your profile useful.
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
  </div>
</template>
