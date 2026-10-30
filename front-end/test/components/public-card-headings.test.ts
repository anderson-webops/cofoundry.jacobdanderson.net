import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import { workspaceSeed } from "../../shared/data/seed"
import OpportunityCard from "../../src/components/app/OpportunityCard.vue"
import ProfileCard from "../../src/components/app/ProfileCard.vue"

const profile = workspaceSeed.profiles.find(entry => entry.userId === "user_olivia")!
const opportunity = workspaceSeed.opportunities.find(entry => entry.slug === "ledgerloop")!

function stubs() {
  return {
    BaseBadge: { template: "<span><slot /></span>" },
    ProfileAvatar: { template: "<div />" },
  }
}

describe("public card headings", () => {
  it("renders profile cards as h3 by default with proof nested below", () => {
    const wrapper = mount(ProfileCard, {
      global: {
        stubs: stubs()
      },
      props: {
        profile,
        skills: ["Product Strategy"],
      },
    })

    expect(wrapper.find("h3").text()).toBe(profile.displayName)
    expect(wrapper.find("h4").text()).toBe(profile.trustSignals.builderProofs[0]!.title)
  })

  it("can render profile cards as h2 on standalone public listing pages", () => {
    const wrapper = mount(ProfileCard, {
      global: {
        stubs: stubs()
      },
      props: {
        headingLevel: 2,
        profile,
        skills: ["Product Strategy"],
      },
    })

    expect(wrapper.find("h2").text()).toBe(profile.displayName)
    expect(wrapper.find("h3").text()).toBe(profile.trustSignals.builderProofs[0]!.title)
    expect(wrapper.find("h4").exists()).toBe(false)
  })

  it("renders opportunity cards as h3 by default", () => {
    const wrapper = mount(OpportunityCard, {
      global: {
        stubs: stubs()
      },
      props: {
        opportunity,
      },
    })

    expect(wrapper.find("h3").text()).toBe(opportunity.startupName)
    expect(wrapper.find("h2").exists()).toBe(false)
  })

  it("can render opportunity cards as h2 on standalone public listing pages", () => {
    const wrapper = mount(OpportunityCard, {
      global: {
        stubs: stubs()
      },
      props: {
        headingLevel: 2,
        opportunity,
      },
    })

    expect(wrapper.find("h2").text()).toBe(opportunity.startupName)
    expect(wrapper.find("h3").exists()).toBe(false)
  })
})
