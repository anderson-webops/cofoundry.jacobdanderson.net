import type { H3Event } from "h3"
import type Stripe from "stripe"
import { getHeader, readRawBody } from "h3"
import { recordStripeCheckoutSession, resolveStripeCheckoutUser, syncStripeSubscription } from "../../utils/billing-persistence"
import { recordOperationalEvent } from "../../utils/operations-persistence"
import { assertRateLimit } from "../../utils/rate-limit"
import { createStripeClient, readStripeWebhookSecret } from "../../utils/stripe"

function getStripeObjectId(value: string | { id: string } | null | undefined) {
  if (!value)
    return null

  return typeof value === "string" ? value : value.id
}

async function handleCheckoutCompleted(event: H3Event, stripe: Stripe, checkoutSession: Stripe.Checkout.Session) {
  const owner = resolveStripeCheckoutUser({
    clientReferenceId: checkoutSession.client_reference_id,
    metadataUserId: checkoutSession.metadata?.cofoundryUserId,
  })
  if (owner.conflict || !owner.userId) {
    throw createError({
      statusCode: 409,
      statusMessage: "Stripe checkout ownership metadata is missing or inconsistent.",
    })
  }

  const userId = owner.userId
  const customerId = getStripeObjectId(checkoutSession.customer)

  const subscriptionId = getStripeObjectId(checkoutSession.subscription)
  if (!subscriptionId) {
    throw createError({
      statusCode: 409,
      statusMessage: "Stripe checkout did not include the expected subscription.",
    })
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const subscriptionCustomerId = getStripeObjectId(subscription.customer)
  if (customerId && subscriptionCustomerId && customerId !== subscriptionCustomerId) {
    throw createError({
      statusCode: 409,
      statusMessage: "Stripe checkout customer does not match the subscription customer.",
    })
  }

  return { customerId: customerId || subscriptionCustomerId, subscription, userId }
}

async function handleStripeEvent(event: H3Event, stripe: Stripe, stripeEvent: Stripe.Event) {
  const eventIdentity = {
    createdAt: new Date(stripeEvent.created * 1000).toISOString(),
    id: stripeEvent.id,
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const checkout = await handleCheckoutCompleted(event, stripe, stripeEvent.data.object as Stripe.Checkout.Session)
    const result = await syncStripeSubscription(event, checkout.subscription, eventIdentity, checkout.userId) as { applied?: boolean } | null
    if (result?.applied)
      await recordStripeCheckoutSession(event, checkout.userId, (stripeEvent.data.object as Stripe.Checkout.Session).id, checkout.customerId)
    return true
  }

  if (
    stripeEvent.type === "customer.subscription.created"
    || stripeEvent.type === "customer.subscription.updated"
    || stripeEvent.type === "customer.subscription.deleted"
  ) {
    const eventSubscription = stripeEvent.data.object as Stripe.Subscription
    const currentSubscription = await stripe.subscriptions.retrieve(eventSubscription.id)
    await syncStripeSubscription(event, currentSubscription, eventIdentity)
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
  assertRateLimit(event, {
    limit: 300,
    scope: "billing:stripe-webhook",
    windowMs: 60 * 1000,
  })

  const stripe = createStripeClient(event)
  const webhookSecret = readStripeWebhookSecret(event)

  if (!stripe) {
    throw createError({
      statusCode: 404,
      statusMessage: "Stripe billing is not enabled in this environment.",
    })
  }

  if (!webhookSecret) {
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
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
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
    console.error("[billing] Signed Stripe webhook processing failed.", error)
    throw createError({
      statusCode: 500,
      statusMessage: "Stripe webhook processing failed.",
    })
  }

  return {
    received: true,
  }
})
