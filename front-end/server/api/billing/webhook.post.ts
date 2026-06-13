import type { H3Event } from "h3"
import type Stripe from "stripe"
import { getHeader, readRawBody } from "h3"
import { recordStripeCheckoutSession, syncStripeSubscription } from "../../utils/billing-persistence"
import { recordOperationalEvent } from "../../utils/operations-persistence"
import { createStripeClient } from "../../utils/stripe"

function getStripeObjectId(value: string | { id: string } | null | undefined) {
  if (!value)
    return null

  return typeof value === "string" ? value : value.id
}

async function handleCheckoutCompleted(event: H3Event, stripe: Stripe, checkoutSession: Stripe.Checkout.Session) {
  const userId = checkoutSession.client_reference_id || checkoutSession.metadata?.cofoundryUserId || null
  const customerId = getStripeObjectId(checkoutSession.customer)

  if (userId)
    await recordStripeCheckoutSession(event, userId, checkoutSession.id, customerId)

  const subscriptionId = getStripeObjectId(checkoutSession.subscription)
  if (!subscriptionId)
    return

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  await syncStripeSubscription(event, subscription, userId)
}

async function handleStripeEvent(event: H3Event, stripe: Stripe, stripeEvent: Stripe.Event) {
  if (stripeEvent.type === "checkout.session.completed") {
    await handleCheckoutCompleted(event, stripe, stripeEvent.data.object as Stripe.Checkout.Session)
    return true
  }

  if (
    stripeEvent.type === "customer.subscription.created"
    || stripeEvent.type === "customer.subscription.updated"
    || stripeEvent.type === "customer.subscription.deleted"
  ) {
    await syncStripeSubscription(event, stripeEvent.data.object as Stripe.Subscription)
    return true
  }

  return false
}

function getStripeEventObjectId(stripeEvent: Stripe.Event) {
  const dataObject = stripeEvent.data.object as { id?: unknown } | null
  return typeof dataObject?.id === "string" ? dataObject.id : null
}

async function recordStripeWebhookTelemetry(
  event: H3Event,
  stripeEvent: Stripe.Event,
  status: "processed" | "unhandled" | "failed",
  errorMessage?: string,
) {
  try {
    await recordOperationalEvent(event, {
      eventType: `stripe.webhook.${status}`,
      metadata: {
        apiVersion: stripeEvent.api_version || null,
        error: errorMessage || null,
        livemode: stripeEvent.livemode,
        requestId: stripeEvent.request?.id || null,
        status,
        stripeEventId: stripeEvent.id,
        stripeEventType: stripeEvent.type,
        stripeObjectId: getStripeEventObjectId(stripeEvent),
      },
      severity: status === "failed" ? "error" : "info",
      source: "stripe.webhook",
      targetId: stripeEvent.id,
      targetType: "stripe_event",
    })
  }
  catch {
    // Webhook reconciliation should not fail just because readiness telemetry cannot be written.
  }
}

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const stripe = createStripeClient(event)

  if (!stripe) {
    throw createError({
      statusCode: 404,
      statusMessage: "Stripe billing is not enabled in this environment.",
    })
  }

  if (!runtimeConfig.stripeWebhookSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: "Stripe webhook secret is missing from server runtime config.",
    })
  }

  const signature = getHeader(event, "stripe-signature")
  if (!signature) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing Stripe webhook signature.",
    })
  }

  const rawBody = await readRawBody(event, false)
  if (!rawBody) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing Stripe webhook body.",
    })
  }

  let stripeEvent: Stripe.Event
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, runtimeConfig.stripeWebhookSecret)
  }
  catch {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid Stripe webhook signature.",
    })
  }

  try {
    const handled = await handleStripeEvent(event, stripe, stripeEvent)
    await recordStripeWebhookTelemetry(event, stripeEvent, handled ? "processed" : "unhandled")
  }
  catch (error) {
    const message = error instanceof Error ? error.message : "Stripe webhook processing failed."
    await recordStripeWebhookTelemetry(event, stripeEvent, "failed", message)
    throw error
  }

  return {
    received: true,
  }
})
