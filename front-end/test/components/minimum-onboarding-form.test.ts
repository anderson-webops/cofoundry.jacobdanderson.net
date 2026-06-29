import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import MinimumOnboardingForm from "../../src/components/app/MinimumOnboardingForm.vue"
import PillPicker from "../../src/components/forms/PillPicker.vue"
import SelectInput from "../../src/components/forms/SelectInput.vue"
import TextareaInput from "../../src/components/forms/TextareaInput.vue"
import TextInput from "../../src/components/forms/TextInput.vue"
import BaseButton from "../../src/components/ui/BaseButton.vue"

function mountMinimumOnboardingForm(initialValueOverrides = {}) {
  return mount(MinimumOnboardingForm, {
    global: {
      components: {
        BaseButton,
        PillPicker,
        SelectInput,
        TextareaInput,
        TextInput,
      },
    },
    props: {
      initialValues: {
        bio: "I want to find a serious founding team with clear customer access and ownership expectations.",
        companyPreferences: ["Workflow software"],
        displayName: "QA Founder",
        equityPhilosophy: "equal_unless_strong_reason",
        fullTimeBy: "",
        headline: "Founder preparing a serious collaboration profile.",
        industries: ["AI"],
        intentMode: "start",
        location: "Austin, TX",
        photoUrl: "https://example.com/qa-founder.jpg",
        primaryRole: "Founder",
        profileVisibility: "members",
        remotePreference: "remote",
        roles: ["Founder"],
        runwayBucket: "undisclosed",
        startTimeline: "exploring",
        timeCommitment: "part_time",
        weeklyAvailabilityHours: 10,
        ...initialValueOverrides,
      },
    },
  })
}

describe("minimumOnboardingForm", () => {
  it("advances early form submits instead of surfacing hidden-step errors", async () => {
    const wrapper = mountMinimumOnboardingForm()

    expect(wrapper.find(".step-card-active").text()).toContain("Intent")
    expect(wrapper.find("button[type=\"submit\"]").exists()).toBe(false)

    await wrapper.find("form").trigger("submit")

    expect(wrapper.find(".step-card-active").text()).toContain("Commitment")
    expect(wrapper.findAll(".field-error")).toHaveLength(0)
    expect(wrapper.emitted("submitted")).toBeUndefined()
  })

  it("blocks progression on the step that owns the missing field", async () => {
    const wrapper = mountMinimumOnboardingForm()

    await wrapper.find("form").trigger("submit")
    await wrapper.find("form").trigger("submit")

    expect(wrapper.find(".step-card-active").text()).toContain("Commitment")
    expect(wrapper.find(".field-error").text()).toBe("Add the date by which this would need to become a full-time decision.")
    expect(wrapper.emitted("submitted")).toBeUndefined()
  })

  it("only exposes the unlock submit action on the final onboarding step", async () => {
    const wrapper = mountMinimumOnboardingForm({ fullTimeBy: "2026-06-01" })

    await wrapper.find("form").trigger("submit")
    await wrapper.find("form").trigger("submit")

    const submit = wrapper.find("button[type=\"submit\"]")
    expect(wrapper.find(".step-card-active").text()).toContain("Fit")
    expect(submit.exists()).toBe(true)
    expect(submit.text()).toBe("Unlock match preview")
  })

  it("renders final-step picker errors when fit tags are missing", async () => {
    const wrapper = mountMinimumOnboardingForm({
      companyPreferences: [],
      fullTimeBy: "2026-06-01",
      industries: [],
    })

    await wrapper.find("form").trigger("submit")
    await wrapper.find("form").trigger("submit")
    await wrapper.find("form").trigger("submit")

    const errors = wrapper.findAll(".field-error").map(error => error.text())
    expect(wrapper.find(".step-card-active").text()).toContain("Fit")
    expect(errors).toContain("Choose at least one industry.")
    expect(errors).toContain("Choose at least one company preference.")
    expect(wrapper.emitted("submitted")).toBeUndefined()
  })
})
