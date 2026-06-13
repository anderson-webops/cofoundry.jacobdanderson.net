import { resolveServerAppUrl } from "../../utils/app-url"
import { requireAuthenticatedSession } from "../../utils/auth"
import { buildOperatorManagedBillingUrl, resolveServerBillingAccessPolicy } from "../../utils/billing-access"
import { createOrReuseStripeCustomer } from "../../utils/billing-persistence"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"
import { createStripeClient } from "../../utils/stripe"

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const session = await requireAuthenticatedSession(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 10,
    scope: "billing:portal",
    windowMs: 10 * 60 * 1000,
  })

  const appUrl = resolveServerAppUrl(event)

  if (runtimeConfig.public.billingMode === "mock") {
    const billingPolicy = resolveServerBillingAccessPolicy(event)

    if (!billingPolicy.mockBillingPreviewEnabled) {
      return {
        mode: "managed",
        portalUrl: buildOperatorManagedBillingUrl(appUrl, "billing-portal"),
      }
    }

    return {
      mode: "mock",
      portalUrl: `${appUrl}/app/billing`,
    }
  }

  const stripe = createStripeClient(event)
  if (!stripe) {
    throw createError({
      statusCode: 500,
      statusMessage: "Stripe billing mode is enabled but the server Stripe client could not be initialized.",
    })
  }

  const customerId = await createOrReuseStripeCustomer(event, stripe, session)
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/app/billing`,
  })

  return {
    mode: "stripe",
    portalUrl: portalSession.url,
  }
})
