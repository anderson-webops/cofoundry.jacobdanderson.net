import { billingCheckoutSchema } from "~/shared/utils/validation"
import { resolveServerAppUrl } from "../../utils/app-url"
import { requireAuthenticatedSession } from "../../utils/auth"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"
import { createStripeClient } from "../../utils/stripe"

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const session = await requireAuthenticatedSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 10,
    scope: "billing:checkout",
    windowMs: 10 * 60 * 1000,
  })
  const payload = billingCheckoutSchema.parse(await readBody(event))
  const appUrl = resolveServerAppUrl(event)

  if (runtimeConfig.public.billingMode === "mock") {
    return {
      mode: "mock",
      checkoutUrl: `${appUrl}/app/billing?checkout=success&plan=${payload.plan}`,
    }
  }

  const priceId = payload.plan === "pro"
    ? runtimeConfig.public.stripePriceProMonthly
    : runtimeConfig.public.stripePriceTeamMonthly
  const stripe = createStripeClient(event)

  if (!stripe) {
    throw createError({
      statusCode: 500,
      statusMessage: "Stripe billing mode is enabled but the server Stripe client could not be initialized.",
    })
  }

  if (!priceId) {
    throw createError({
      statusCode: 500,
      statusMessage: `Stripe billing mode is enabled but the ${payload.plan} plan price ID is missing.`,
    })
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/app/billing?checkout=success&plan=${payload.plan}`,
    cancel_url: `${appUrl}/app/billing?checkout=cancelled`,
  })

  return {
    mode: "stripe",
    checkoutUrl: checkoutSession.url,
  }
})
