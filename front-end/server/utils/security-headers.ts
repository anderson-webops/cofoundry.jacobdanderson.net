export interface SecurityHeaderOptions {
  appUrl?: string
  isProduction?: boolean
}

export type SecurityHeaders = Record<string, string>

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

  if (options.isProduction && isHttpsUrl(options.appUrl))
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

  return headers
}
