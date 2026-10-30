<script setup lang="ts">
import { contactSchema } from "~/shared/utils/validation"

usePageSeo(
  "Contact the CoFoundry team",
  "Contact CoFoundry for support, workspace access, pricing, partnerships, or help with an existing account.",
  {
    canonicalPath: "/contact",
  },
)

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
    case "legal-review":
      return {
        subject: "Agreement review workflow help",
        message: "I need product or document-sharing help with an agreement review. I understand CoFoundry does not provide legal advice or select counsel.",
      }
    default:
      return {
        subject: "",
        message: "",
      }
  }
}

const topicDefaults = getTopicDefaults(typeof route.query.topic === "string"
  ? route.query.topic
  : "")

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
      message: "We received your message.",
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
      title="Contact CoFoundry."
    />

    <div class="mt-10 max-w-3xl">
      <div class="mb-5 flex justify-end">
        <BaseButton variant="secondary" :href="`mailto:${runtimeConfig.public.supportEmail}`">
          {{ runtimeConfig.public.supportEmail }}
        </BaseButton>
      </div>
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
