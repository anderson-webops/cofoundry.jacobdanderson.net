export type PublicIntakeKind = "access_request" | "contact"

export interface PublicIntakeQualityInput {
  email: string
  kind: PublicIntakeKind
  message: string
  name?: string
  subject?: string
}

export interface PublicIntakeQualityIssue {
  code:
    | "disposable_email"
    | "low_signal"
    | "reserved_email_domain"
    | "repeated_filler"
    | "spam_phrase"
    | "test_content"
    | "url_stuffing"
  message: string
}

export interface PublicIntakeQualityResult {
  accepted: boolean
  issues: PublicIntakeQualityIssue[]
  message: string
}

const reservedEmailDomains = new Set([
  "example.com",
  "example.net",
  "example.org",
  "localhost",
])

const disposableEmailDomains = new Set([
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "sharklasers.com",
  "tempmail.com",
  "trashmail.com",
  "yopmail.com",
])

const disposableDomainHints = [
  "disposable",
  "tempmail",
  "throwaway",
]

const spamPhrasePatterns = [
  /\bbacklinks?\b/i,
  /\bcasino\b/i,
  /\bcrypto recovery\b/i,
  /\bforex signals?\b/i,
  /\bguest posts?\b/i,
  /\blink insertion\b/i,
  /\bloans? offer\b/i,
  /\brank (?:on|in) google\b/i,
  /\btelegram me\b/i,
  /\bviagra\b/i,
  /\bwhats(?:app| app) me\b/i,
]

const testContentPattern = /\b(?:asdf|lorem ipsum|qwerty|test test|testing testing)\b/i
const urlPattern = /\b(?:https?:\/\/|www\.)\S+/gi
const repeatedVisibleCharacterPattern = /([a-z0-9!?$*#])\1{9,}/i
const wordPattern = /[a-z][a-z'-]+/gi

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function emailDomain(email: string) {
  const [, domain = ""] = email.trim().toLowerCase().split("@")
  return domain
}

function countUrls(text: string) {
  return [
    ...text.matchAll(urlPattern)
  ].length
}

function countMeaningfulWords(text: string) {
  return [
    ...text.matchAll(wordPattern)
  ]
    .map(match => match[0].toLowerCase())
    .filter(word => ![
      "and",
      "for",
      "the",
      "that",
      "this",
      "with",
      "you",
      "your"
    ].includes(word))
    .length
}

function buildIssue(code: PublicIntakeQualityIssue["code"], message: string): PublicIntakeQualityIssue {
  return { code, message }
}

export function evaluatePublicIntakeQuality(input: PublicIntakeQualityInput): PublicIntakeQualityResult {
  const issues: PublicIntakeQualityIssue[] = []
  const domain = emailDomain(input.email)
  const combinedText = normalize([
    input.name || "",
    input.subject || "",
    input.message,
  ].join(" "))
  const meaningfulWordCount = countMeaningfulWords(combinedText)
  const minimumMeaningfulWords = input.kind === "access_request"
    ? 8
    : 5

  if (!domain || !domain.includes(".") || reservedEmailDomains.has(domain) || domain.endsWith(".invalid") || domain.endsWith(".localhost") || domain.endsWith(".test")) {
    issues.push(buildIssue(
      "reserved_email_domain",
      "Use a real reachable email address, not a reserved or test domain.",
    ))
  }

  if (disposableEmailDomains.has(domain) || disposableDomainHints.some(hint => domain.includes(hint))) {
    issues.push(buildIssue(
      "disposable_email",
      "Use a durable personal or work email address so the team can follow up.",
    ))
  }

  if (countUrls(combinedText) > 2) {
    issues.push(buildIssue(
      "url_stuffing",
      "Keep links to the one or two URLs needed to understand the request.",
    ))
  }

  if (repeatedVisibleCharacterPattern.test(combinedText)) {
    issues.push(buildIssue(
      "repeated_filler",
      "Replace repeated filler characters with a specific request.",
    ))
  }

  if (testContentPattern.test(combinedText)) {
    issues.push(buildIssue(
      "test_content",
      "Replace test text with a specific CoFoundry request.",
    ))
  }

  if (meaningfulWordCount < minimumMeaningfulWords) {
    issues.push(buildIssue(
      "low_signal",
      "Add enough specific context for the team to understand the request.",
    ))
  }

  for (const pattern of spamPhrasePatterns) {
    if (pattern.test(combinedText)) {
      issues.push(buildIssue(
        "spam_phrase",
        "This looks like an unrelated solicitation rather than a CoFoundry request.",
      ))
      break
    }
  }

  return {
    accepted: issues.length === 0,
    issues,
    message: issues[0]?.message || "Submission quality checks passed.",
  }
}
