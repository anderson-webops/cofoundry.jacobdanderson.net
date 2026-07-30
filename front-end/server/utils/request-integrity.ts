const unsafeMethods = new Set(["DELETE", "PATCH", "POST", "PUT"])
const maxJsonBodyBytes = 1024 * 1024
const maxUploadBodyBytes = 11 * 1024 * 1024

function parseOrigin(value: string | null | undefined) {
  if (!value)
    return ""

  try {
    return new URL(value).origin
  }
  catch {
    return ""
  }
}

export interface RequestIntegrityInput {
  canonicalOrigin: string
  contentLength?: string | null
  hasSessionCookie?: boolean
  method: string
  origin?: string | null
  pathname: string
  referer?: string | null
  secFetchSite?: string | null
  transferEncoding?: string | null
}

export function getRequestIntegrityFailure(input: RequestIntegrityInput) {
  const method = input.method.toUpperCase()
  const contentLengthHeader = input.contentLength?.trim() || ""
  const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : 0
  const maxBodyBytes = input.pathname.startsWith("/api/files/local-upload/")
    ? maxUploadBodyBytes
    : maxJsonBodyBytes

  if (contentLengthHeader && !/^\d+$/.test(contentLengthHeader)) {
    return {
      statusCode: 400,
      statusMessage: "The request Content-Length header is invalid.",
    }
  }

  if (contentLength > maxBodyBytes) {
    return {
      statusCode: 413,
      statusMessage: "The request body is too large.",
    }
  }

  if (!unsafeMethods.has(method))
    return null

  if (!contentLengthHeader) {
    return {
      statusCode: 411,
      statusMessage: "State-changing requests must declare a bounded Content-Length.",
    }
  }

  if (input.transferEncoding) {
    return {
      statusCode: 411,
      statusMessage: "State-changing requests must declare a bounded Content-Length.",
    }
  }

  if (input.secFetchSite?.trim().toLowerCase() === "cross-site") {
    return {
      statusCode: 403,
      statusMessage: "Cross-site state changes are not allowed.",
    }
  }

  const canonicalOrigin = parseOrigin(input.canonicalOrigin)
  const suppliedOrigin = parseOrigin(input.origin)
  if (input.origin && (!suppliedOrigin || suppliedOrigin !== canonicalOrigin)) {
    return {
      statusCode: 403,
      statusMessage: "The request origin is not allowed.",
    }
  }

  const refererOrigin = parseOrigin(input.referer)
  if (!input.origin && input.referer && (!refererOrigin || refererOrigin !== canonicalOrigin)) {
    return {
      statusCode: 403,
      statusMessage: "The request referrer is not allowed.",
    }
  }

  if (input.hasSessionCookie && !input.origin && !input.referer && !input.secFetchSite) {
    return {
      statusCode: 403,
      statusMessage: "Browser session changes require same-origin request metadata.",
    }
  }

  return null
}
