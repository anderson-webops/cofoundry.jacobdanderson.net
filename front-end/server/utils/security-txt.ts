import { isValidSupportEmail } from "../../shared/utils/environment"

export interface SecurityTxtOptions {
  appUrl: string
  expiresAt: Date
  supportEmail: string
}

const trailingSlashPattern = /\/+$/

function stripTrailingSlash(value: string) {
  return value.replace(trailingSlashPattern, "")
}

function normalizeSupportEmail(value: string) {
  const email = value.trim().toLowerCase()
  if (!isValidSupportEmail(email))
    throw new TypeError("security.txt requires a valid single support email address.")

  return email
}

function normalizeAppUrl(value: string) {
  try {
    const url = new URL(stripTrailingSlash(value))
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
      throw new TypeError("security.txt requires a valid public HTTP(S) app origin.")

    return url.origin
  }
  catch {
    throw new TypeError("security.txt requires a valid public HTTP(S) app origin.")
  }
}

export function buildSecurityTxt(options: SecurityTxtOptions) {
  const appUrl = normalizeAppUrl(options.appUrl)
  const supportEmail = normalizeSupportEmail(options.supportEmail)

  return [
    `Contact: mailto:${supportEmail}`,
    `Expires: ${options.expiresAt.toISOString()}`,
    `Preferred-Languages: en`,
    `Canonical: ${appUrl}/.well-known/security.txt`,
    `Policy: ${appUrl}/safety`,
    "",
  ].join("\n")
}
