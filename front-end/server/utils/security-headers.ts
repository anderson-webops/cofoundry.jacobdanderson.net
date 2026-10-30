export interface SecurityHeaderOptions {
  appUrl?: string
  backendMode?: string
  billingMode?: string
  includeContentSecurityPolicy?: boolean
  isProduction?: boolean
  stripePublishableKey?: string
  supabaseUrl?: string
}

export type SecurityHeaders = Record<string, string>

const analyticsOrigins = [
  "https://analytics.cofoundry.jacobdanderson.net",
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
  return [
    ...new Set(values.filter((value): value is string => Boolean(value)))
  ]
}

function directive(name: string, values: Array<string | null | undefined>) {
  return `${name} ${uniqueValues(values).join(" ")}`
}

export function shouldDefaultApiResponseToNoStore(pathname: string) {
  return pathname.startsWith("/api/") && !pathname.startsWith("/api/public/")
}

export function buildContentSecurityPolicyDirectives(options: SecurityHeaderOptions = {}) {
  const appOrigin = originFor(options.appUrl)
  const supabaseOrigin = options.backendMode === "supabase"
    ? originFor(options.supabaseUrl)
    : null
  const stripeEnabled = options.billingMode === "stripe" || Boolean(options.stripePublishableKey)
  const stripeScriptOrigins = stripeEnabled
    ? ["https://js.stripe.com"]
    : []
  const stripeFrameOrigins = stripeEnabled
    ? ["https://checkout.stripe.com", "https://js.stripe.com"]
    : []
  const stripeConnectOrigins = stripeEnabled
    ? stripeOrigins
    : []

  return {
    "base-uri": ["'none'"],
    "connect-src": uniqueValues([
      "'self'",
      appOrigin,
      supabaseOrigin,
      ...analyticsOrigins,
      ...stripeConnectOrigins
    ]),
    "default-src": ["'self'"],
    "font-src": ["'self'", "data:"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "frame-src": uniqueValues(["'self'", ...stripeFrameOrigins]),
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "manifest-src": ["'self'"],
    "media-src": ["'self'", "data:", "blob:"],
    "object-src": ["'none'"],
    "script-src": uniqueValues([
      "'self'",
      "'strict-dynamic'",
      "'nonce-{{nonce}}'",
      ...analyticsOrigins,
      ...stripeScriptOrigins
    ]),
    "script-src-attr": ["'none'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "upgrade-insecure-requests": isHttpsUrl(options.appUrl),
    "worker-src": ["'self'", "blob:"],
  }
}

export function buildContentSecurityPolicy(options: SecurityHeaderOptions = {}) {
  return Object.entries(buildContentSecurityPolicyDirectives(options))
    .flatMap(([name, values]) => {
      if (values === false)
        return []

      return Array.isArray(values)
        ? [
            directive(name, values)
          ]
        : [name]
    })
    .join("; ")
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

  if (options.isProduction && options.includeContentSecurityPolicy !== false)
    headers["Content-Security-Policy"] = buildContentSecurityPolicy(options)

  if (options.isProduction && isHttpsUrl(options.appUrl))
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

  return headers
}
