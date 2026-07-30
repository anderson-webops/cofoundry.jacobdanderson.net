import type { H3Event } from "h3"
import type Stripe from "stripe"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  resolveStripeCheckoutUser,
  resolveStripePlanFromPriceId,
  resolveStripeSubscriptionOwner,
  toSubscriptionStatus,
} from "../../server/utils/billing-persistence"

describe("stripe billing persistence", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("maps only explicitly configured prices and never silently downgrades unknown prices", () => {
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: {
        stripePriceProMonthly: "price_pro",
        stripePriceTeamMonthly: "price_team",
      },
    }))

    const event = {} as H3Event
    expect(resolveStripePlanFromPriceId(event, "price_pro")).toBe("pro")
    expect(resolveStripePlanFromPriceId(event, "price_team")).toBe("team")
    expect(resolveStripePlanFromPriceId(event, "price_unknown")).toBeNull()
    expect(resolveStripePlanFromPriceId(event, null)).toBeNull()
  })

  it("maps only entitlement-safe Stripe statuses and fails unknown states closed", () => {
    expect(toSubscriptionStatus("active")).toBe("active")
    expect(toSubscriptionStatus("trialing")).toBe("trialing")
    expect(toSubscriptionStatus("past_due")).toBe("past_due")
    expect(toSubscriptionStatus("canceled")).toBe("canceled")
    expect(toSubscriptionStatus("paused")).toBe("inactive")
    expect(toSubscriptionStatus("future_status" as Stripe.Subscription.Status)).toBe("inactive")
  })

  it("rejects conflicting Stripe metadata instead of reassigning an existing subscription", () => {
    expect(resolveStripeSubscriptionOwner({
      existingCustomerOwnerId: "user_existing",
      existingSubscriptionOwnerId: "user_existing",
      fallbackUserId: null,
      metadataUserId: "user_attacker",
    })).toEqual({
      conflict: true,
      userId: "user_existing",
    })

    expect(resolveStripeSubscriptionOwner({
      existingCustomerOwnerId: null,
      existingSubscriptionOwnerId: null,
      fallbackUserId: "user_checkout",
      metadataUserId: "user_checkout",
    })).toEqual({
      conflict: false,
      userId: "user_checkout",
    })
  })

  it("requires checkout reference and metadata identities to agree", () => {
    expect(resolveStripeCheckoutUser({
      clientReferenceId: "user_owner",
      metadataUserId: "user_owner",
    })).toEqual({
      conflict: false,
      userId: "user_owner",
    })
    expect(resolveStripeCheckoutUser({
      clientReferenceId: "user_owner",
      metadataUserId: "user_attacker",
    })).toEqual({
      conflict: true,
      userId: "user_owner",
    })
    expect(resolveStripeCheckoutUser({})).toEqual({
      conflict: false,
      userId: null,
    })
  })
})
