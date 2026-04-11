import type { H3Event } from "h3"
import Stripe from "stripe"

export function createStripeClient(event?: H3Event) {
  const runtimeConfig = useRuntimeConfig(event)

  if (!runtimeConfig.stripeSecretKey)
    return null

  return new Stripe(runtimeConfig.stripeSecretKey)
}
