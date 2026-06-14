export interface SecurityHeaderOptions {
  appUrl?: string
  backendMode?: string
  billingMode?: string
  isProduction?: boolean
  stripePublishableKey?: string
  supabaseUrl?: string
}

export type SecurityHeaders = Record<string, string>

const analyticsOrigins = [
  "https://analytics.cofoundry.jacobdanderson.net",
  "https://analytics.jacobdanderson.net",
]

const stripeOrigins = [
  "https://api.stripe.com",
  "https://checkout.stripe.com",
  "https://js.stripe.com",
]

function isHttpsUrl(value?: string) {
  if (!value)
    return false

  try {
    return new URL(value).protocol === "https:"
  }
  catch {
    return false
  }
}

function originFor(value?: string) {
  if (!value)
    return null

  try {
    return new URL(value).origin
  }
  catch {
    return null
  }
}

function uniqueValues(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function directive(name: string, values: Array<string | null | undefined>) {
  return `${name} ${uniqueValues(values).join(" ")}`
}

export function buildContentSecurityPolicy(options: SecurityHeaderOptions = {}) {
  const appOrigin = originFor(options.appUrl)
  const supabaseOrigin = options.backendMode === "supabase" ? originFor(options.supabaseUrl) : null
  const stripeEnabled = options.billingMode === "stripe" || Boolean(options.stripePublishableKey)
  const stripeScriptOrigins = stripeEnabled ? ["https://js.stripe.com"] : []
  const stripeFrameOrigins = stripeEnabled ? ["https://checkout.stripe.com", "https://js.stripe.com"] : []
  const stripeConnectOrigins = stripeEnabled ? stripeOrigins : []

  return [
    directive("default-src", ["'self'"]),
    directive("base-uri", ["'self'"]),
    directive("object-src", ["'none'"]),
    directive("frame-ancestors", ["'none'"]),
    directive("form-action", ["'self'"]),
    directive("script-src", ["'self'", "'unsafe-inline'", ...analyticsOrigins, ...stripeScriptOrigins]),
    directive("style-src", ["'self'", "'unsafe-inline'"]),
    directive("img-src", ["'self'", "data:", "blob:", "https:"]),
    directive("font-src", ["'self'", "data:"]),
    directive("connect-src", ["'self'", appOrigin, supabaseOrigin, ...analyticsOrigins, ...stripeConnectOrigins]),
    directive("frame-src", ["'self'", ...stripeFrameOrigins]),
    directive("manifest-src", ["'self'"]),
    directive("media-src", ["'self'", "data:", "blob:"]),
    directive("worker-src", ["'self'", "blob:"]),
    ...(isHttpsUrl(options.appUrl) ? ["upgrade-insecure-requests"] : []),
  ].join("; ")
}

export function buildSecurityHeaders(options: SecurityHeaderOptions = {}): SecurityHeaders {
  const headers: SecurityHeaders = {
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    "Permissions-Policy": [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "payment=()",
      "usb=()",
    ].join(", "),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  }

  if (options.isProduction) {
    headers["Content-Security-Policy"] = buildContentSecurityPolicy(options)

    if (isHttpsUrl(options.appUrl))
      headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
  }

  return headers
}
