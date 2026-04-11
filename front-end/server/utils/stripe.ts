import type { H3Event } from "h3"
import Stripe from "stripe"

export function isStripeBillingEnabled(event?: H3Event) {
  const runtimeConfig = useRuntimeConfig(event)
  return runtimeConfig.public.billingMode === "stripe"
}

export function createStripeClient(event?: H3Event) {
  const runtimeConfig = useRuntimeConfig(event)

  if (!isStripeBillingEnabled(event))
    return null

  if (!runtimeConfig.stripeSecretKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Stripe billing mode is enabled but STRIPE_SECRET_KEY is not available to the server runtime.",
    })
  }

  return new Stripe(runtimeConfig.stripeSecretKey)
}
