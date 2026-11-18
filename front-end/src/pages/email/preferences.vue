<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useHead, useRoute, useRuntimeConfig } from "#app"
import { $fetch } from "#build/fetch"
import BaseButton from "~/components/ui/BaseButton.vue"
import PageIntro from "~/components/ui/PageIntro.vue"
import { usePageSeo } from "~/composables/usePageSeo"

type PreferenceCategory = "digest" | "workflow"

const route = useRoute()
const runtimeConfig = useRuntimeConfig()

usePageSeo("Email Preferences")
useHead({
  meta: [
    { name: "robots", content: "noindex, nofollow" },
  ],
})

const token = computed(() => {
  const value = route.query.token
  return typeof value === "string"
    ? value
    : ""
})

onMounted(() => {
  if (!token.value)
    return

  const sanitizedUrl = new URL(window.location.href)
  sanitizedUrl.searchParams.delete("token")
  window.history.replaceState(
    window.history.state,
    "",
    `${sanitizedUrl.pathname}${sanitizedUrl.search}`,
  )
})

const status = ref<"idle" | "submitting" | "success" | "error">("idle")
const result = ref<{ category: PreferenceCategory, email: string } | null>(null)
const errorMessage = ref("")

const resultLabel = computed(() => {
  if (!result.value)
    return "optional CoFoundry email"

  return result.value.category === "digest"
    ? "scheduled unread digest email"
    : "relationship workflow email"
})

async function turnOffEmail() {
  if (!token.value) {
    status.value = "error"
    errorMessage.value = "This email preference link is missing or incomplete."
    return
  }

  status.value = "submitting"
  errorMessage.value = ""

  try {
    const response = await $fetch<{ category: PreferenceCategory, email: string }>("/api/notifications/preferences", {
      method: "POST",
      body: {
        token: token.value,
      },
    })
    result.value = {
      category: response.category,
      email: response.email,
    }
    status.value = "success"
  }
  catch (error: unknown) {
    const payload = error as { data?: { message?: string }, statusMessage?: string }
    status.value = "error"
    errorMessage.value = payload.data?.message || payload.statusMessage || "This email preference link could not be applied."
  }
}
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Email preferences"
      title="Manage optional CoFoundry email."
    />

    <div class="mt-10 max-w-3xl">
      <div class="panel p-6 md:p-8">
        <div v-if="status === 'success'" class="gap-5 grid">
          <div>
            <p class="text-xl font-semibold">
              {{ resultLabel }} is turned off.
            </p>
            <p class="muted text-sm leading-6 mt-3">
              We updated optional email preferences for {{ result?.email }}. Service-critical account, security, billing, trust, and support notices may still be sent separately.
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <BaseButton to="/app/settings">
              Open settings
            </BaseButton>
            <BaseButton variant="ghost" to="/contact?topic=account">
              Contact support
            </BaseButton>
          </div>
        </div>

        <div v-else class="gap-5 grid">
          <div>
            <p class="text-xl font-semibold">
              Turn off this optional email type?
            </p>
            <p class="muted text-sm leading-6 mt-3">
              This only changes optional CoFoundry product email for the address attached to the signed link. You can re-enable email from workspace settings after signing in.
            </p>
          </div>

          <div v-if="status === 'error'" class="text-sm text-[var(--text)] p-4 border border-red-500/25 rounded-3xl bg-red-500/10">
            {{ errorMessage }}
          </div>

          <div class="flex flex-wrap gap-3">
            <BaseButton :disabled="status === 'submitting' || !token" @click="turnOffEmail">
              {{ status === "submitting" ? "Updating..." : "Turn off optional email" }}
            </BaseButton>
            <BaseButton variant="ghost" to="/app/settings">
              Open settings instead
            </BaseButton>
          </div>

          <p class="muted text-xs leading-5">
            Need help? Email <a :href="`mailto:${runtimeConfig.public.supportEmail}`" class="text-[var(--text)] underline underline-offset-4">{{ runtimeConfig.public.supportEmail }}</a>.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
