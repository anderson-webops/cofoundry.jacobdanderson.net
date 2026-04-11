<script setup lang="ts">
import { contactSchema } from "~/shared/utils/validation"

usePageSeo("Contact")

const toastStore = useToastStore()

const form = reactive({
  name: "",
  email: "",
  company: "",
  subject: "",
  message: "",
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
      message: "Thanks. We received your note and the demo endpoint accepted it successfully.",
      tone: "success",
    })
    Object.assign(form, {
      name: "",
      email: "",
      company: "",
      subject: "",
      message: "",
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
      title="Talk to the team behind CoFoundry."
      description="Use this form for product feedback, pilot requests, venture studio pricing, or questions about how the founder agreement workflow should fit your process."
    />

    <div class="mt-10 gap-6 grid lg:grid-cols-[0.8fr_1.2fr]">
      <div class="panel p-6">
        <h2 class="text-xl font-semibold">
          What founders usually ask us
        </h2>
        <ul class="muted text-sm leading-7 mt-5 gap-4 grid">
          <li>How should we structure proposals between two pre-incorporation founders?</li>
          <li>Can our venture studio manage multiple opportunities from one workspace?</li>
          <li>How do paid subscriptions affect visibility and proposal workflow access?</li>
        </ul>
      </div>

      <form class="panel p-6 gap-5 grid" @submit.prevent="submitForm">
        <TextInput v-model="form.name" label="Name" :error="errors.name" />
        <TextInput v-model="form.email" label="Email" type="email" :error="errors.email" />
        <TextInput v-model="form.company" label="Company" :error="errors.company" />
        <TextInput v-model="form.subject" label="Subject" :error="errors.subject" />
        <TextareaInput v-model="form.message" label="Message" :error="errors.message" rows="6" />
        <div class="flex items-center justify-end">
          <BaseButton type="submit" :disabled="submitting">
            {{ submitting ? "Sending..." : "Send message" }}
          </BaseButton>
        </div>
      </form>
    </div>
  </div>
</template>
