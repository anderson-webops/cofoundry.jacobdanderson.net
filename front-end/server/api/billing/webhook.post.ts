import type { H3Event } from "h3"
import type Stripe from "stripe"
import { getHeader, readRawBody } from "h3"
import { recordStripeCheckoutSession, syncStripeSubscription } from "../../utils/billing-persistence"
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
    return
  }

  if (
    stripeEvent.type === "customer.subscription.created"
    || stripeEvent.type === "customer.subscription.updated"
    || stripeEvent.type === "customer.subscription.deleted"
  ) {
    await syncStripeSubscription(event, stripeEvent.data.object as Stripe.Subscription)
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

  await handleStripeEvent(event, stripe, stripeEvent)

  return {
    received: true,
  }
})
