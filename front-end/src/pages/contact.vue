<script setup lang="ts">
import { contactSchema } from "~/shared/utils/validation"

usePageSeo("Contact")

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const toastStore = useToastStore()

function getTopicDefaults(topic: string) {
  switch (topic) {
    case "access":
      return {
        subject: "Workspace access",
        message: "I would like access to CoFoundry when workspace accounts open for my use case.",
      }
    case "intro":
      return {
        subject: "Intro access request",
        message: "I found a profile or startup search on CoFoundry and would like access to send an intro through the platform.",
      }
    case "pricing":
      return {
        subject: "Pricing and team plans",
        message: "I would like more detail on CoFoundry pricing, rollout timing, or team/studio access.",
      }
    case "account":
      return {
        subject: "Account access help",
        message: "I need help accessing an existing CoFoundry account or invite.",
      }
    default:
      return {
        subject: "",
        message: "",
      }
  }
}

const topicDefaults = getTopicDefaults(typeof route.query.topic === "string" ? route.query.topic : "")

const form = reactive({
  name: "",
  email: "",
  company: "",
  subject: topicDefaults.subject,
  message: topicDefaults.message,
  website: "",
})
const errors = ref<Record<string, string>>({})
const submitting = ref(false)

async function submitForm() {
  errors.value = {}
  const result = contactSchema.safeParse(form)
  if (!result.success) {
    errors.value = Object.fromEntries(result.error.issues.map(issue => [issue.path[0] as string, issue.message]))
    return
  }

  submitting.value = true

  try {
    await $fetch("/api/contact", {
      method: "POST",
      body: result.data,
    })
    toastStore.push({
      title: "Message sent",
      message: "Thanks. We received your note and the team will follow up shortly.",
      tone: "success",
    })
    Object.assign(form, {
      name: "",
      email: "",
      company: "",
      subject: topicDefaults.subject,
      message: topicDefaults.message,
      website: "",
    })
  }
  catch (error: unknown) {
    toastStore.push({
      title: "Message not sent",
      message: (error as { data?: { message?: string }, statusMessage?: string })?.data?.message
        || (error as { statusMessage?: string })?.statusMessage
        || "The message could not be sent right now. Please try again later.",
      tone: "danger",
    })
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Contact"
      title="Contact CoFoundry."
      description="Use this form for support, access, pricing, or partnership questions."
    />

    <div class="mt-10 max-w-3xl">
      <p class="muted text-sm leading-6 mb-5">
        Use the form below, or email <a :href="`mailto:${runtimeConfig.public.supportEmail}`" class="text-[var(--text)] underline underline-offset-4">{{ runtimeConfig.public.supportEmail }}</a>. We reply through the address you provide.
      </p>
      <form class="panel p-6 gap-5 grid" @submit.prevent="submitForm">
        <TextInput v-model="form.name" label="Name" :error="errors.name" />
        <TextInput v-model="form.email" label="Email" type="email" :error="errors.email" />
        <TextInput v-model="form.company" label="Company" :error="errors.company" />
        <TextInput v-model="form.subject" label="Subject" :error="errors.subject" />
        <TextareaInput v-model="form.message" label="Message" :error="errors.message" :rows="6" />
        <input v-model="form.website" type="text" name="website" autocomplete="off" tabindex="-1" class="sr-only" aria-hidden="true">
        <div class="flex items-center justify-end">
          <BaseButton type="submit" :disabled="submitting">
            {{ submitting ? "Sending..." : "Send message" }}
          </BaseButton>
        </div>
      </form>
    </div>
  </div>
</template>
