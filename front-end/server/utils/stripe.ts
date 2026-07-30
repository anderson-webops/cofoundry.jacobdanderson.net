import type { H3Event } from "h3"
import process from "node:process"
import Stripe from "stripe"

type StripeHostedSurface = "checkout" | "portal"

const stripeHostedSurfaceHosts: Record<StripeHostedSurface, string> = {
  checkout: "checkout.stripe.com",
  portal: "billing.stripe.com",
}

export function validateStripeHostedUrl(value: string | null, surface: StripeHostedSurface) {
  if (!value)
    return null

  try {
    const url = new URL(value)
    if (
      url.protocol !== "https:"
      || url.hostname !== stripeHostedSurfaceHosts[surface]
      || url.username
      || url.password
      || url.hash
    ) {
      return null
    }

    return url.toString()
  }
  catch {
    return null
  }
}

export function isStripeBillingEnabled(event?: H3Event) {
  const runtimeConfig = useRuntimeConfig(event)
  return runtimeConfig.public.billingMode === "stripe"
}

export function createStripeClient(event?: H3Event) {
  const runtimeConfig = useRuntimeConfig(event)
  const secretKey = process.env.STRIPE_SECRET_KEY || runtimeConfig.stripeSecretKey

  if (!isStripeBillingEnabled(event))
    return null

  if (!secretKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Stripe billing mode is enabled but STRIPE_SECRET_KEY is not available to the server runtime.",
    })
  }

  return new Stripe(secretKey, {
    apiVersion: "2026-07-29.dahlia",
  })
}

export function readStripeWebhookSecret(event?: H3Event) {
  const runtimeConfig = useRuntimeConfig(event)
  return process.env.STRIPE_WEBHOOK_SECRET || runtimeConfig.stripeWebhookSecret || ""
}
