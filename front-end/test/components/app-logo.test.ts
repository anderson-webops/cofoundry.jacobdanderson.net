import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import AppLogo from "../../src/components/marketing/AppLogo.vue"

describe("appLogo", () => {
  it("renders CoFoundry branding and links home", () => {
    const wrapper = mount(AppLogo, {
      global: {
        stubs: {
          NuxtLink: {
            props: ["to"],
            template: "<a :href=\"to\"><slot /></a>",
          },
        },
      },
    })

    expect(wrapper.text()).toContain("CoFoundry")
    expect(wrapper.html()).toContain("href=\"/\"")
    expect(wrapper.text()).not.toContain("Stakes")
  })
})
