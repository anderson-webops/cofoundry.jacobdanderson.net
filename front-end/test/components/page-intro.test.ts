import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import PageIntro from "../../src/components/ui/PageIntro.vue"

describe("pageIntro", () => {
  it("renders the title as the page h1 by default", () => {
    const wrapper = mount(PageIntro, {
      props: {
        title: "Founder workspace",
      },
    })

    expect(wrapper.find("h1").text()).toBe("Founder workspace")
    expect(wrapper.find("h2").exists()).toBe(false)
  })

  it("can render secondary section headings without adding another h1", () => {
    const wrapper = mount(PageIntro, {
      props: {
        headingLevel: 2,
        title: "Recommended collaborators",
      },
    })

    expect(wrapper.find("h1").exists()).toBe(false)
    expect(wrapper.find("h2").text()).toBe("Recommended collaborators")
  })
})
