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
  return value.trim().toLowerCase()
}

export function buildSecurityTxt(options: SecurityTxtOptions) {
  const appUrl = stripTrailingSlash(options.appUrl)
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
