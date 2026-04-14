import { spawn } from "node:child_process"
import { env } from "node:process"
import type { H3Event } from "h3"
import { getHeader, getRequestIP } from "h3"
import { z } from "zod"

import { contactSchema } from "~/shared/utils/validation"

type ContactPayload = z.infer<typeof contactSchema>

const truthyValues = new Set(["1", "true", "yes", "on"])

function isEnabled(value?: string) {
  return truthyValues.has(value?.trim().toLowerCase() || "")
}

function trimToUndefined(value?: string) {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function parseAddressList(value?: string) {
  return value
    ?.split(",")
    .map(part => part.trim())
    .filter(Boolean)
}

function escapeHeader(value: string) {
  return value.replaceAll(/\r?\n/g, " ").trim()
}

function buildRawMessage({
  fromEmail,
  fromName,
  toEmail,
  replyTo,
  subject,
  body,
}: {
  fromEmail: string
  fromName: string
  toEmail: string
  replyTo: string
  subject: string
  body: string
}) {
  return [
    `From: "${escapeHeader(fromName)}" <${escapeHeader(fromEmail)}>`,
    `To: ${escapeHeader(toEmail)}`,
    `Reply-To: ${escapeHeader(replyTo)}`,
    `Subject: ${escapeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
    "",
  ].join("\r\n")
}

async function sendRawSendmail(sendmailPath: string, recipients: string[], message: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(sendmailPath, ["-i", ...recipients], {
      stdio: ["pipe", "ignore", "pipe"],
    })

    let stderr = ""

    child.stderr.on("data", chunk => {
      stderr += chunk.toString()
    })

    child.on("error", reject)
    child.on("close", code => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(stderr.trim() || `sendmail exited with code ${code}`))
    })

    child.stdin.end(message)
  })
}

function getContactMailConfig() {
  const fromEmail = trimToUndefined(env.CONTACT_FROM_EMAIL)
  if (!fromEmail) {
    return null
  }

  const toEmail = trimToUndefined(env.CONTACT_TO_EMAIL) || "contacts@jacobdanderson.net"
  const bccEmail = parseAddressList(env.CONTACT_BCC_EMAIL)
  const fromName = trimToUndefined(env.CONTACT_FROM_NAME) || "CoFoundry"
  const sendmailPath = trimToUndefined(env.CONTACT_SENDMAIL_PATH) || "/usr/sbin/sendmail"
  const useSendmail = isEnabled(env.CONTACT_USE_SENDMAIL) || !!sendmailPath

  if (useSendmail) {
    return {
      fromEmail,
      fromName,
      toEmail,
      bccEmail,
      sendmailPath,
    }
  }

  return null
}

export function isContactMailConfigured() {
  try {
    return !!getContactMailConfig()
  }
  catch {
    return false
  }
}

function formatHeaderLine(label: string, value?: string) {
  return value ? `${label}: ${value}` : undefined
}

export async function sendContactMessage(payload: ContactPayload, event: H3Event) {
  const mailConfig = getContactMailConfig()
  if (!mailConfig) {
    throw new Error("Contact mail is not configured")
  }

  const submittedAt = new Date().toISOString()
  const userAgent = trimToUndefined(getHeader(event, "user-agent") || undefined)
  const referer = trimToUndefined(getHeader(event, "referer") || undefined)
  const ip = trimToUndefined(getRequestIP(event, { xForwardedFor: true }) || undefined)

  const metadata = [
    formatHeaderLine("Submitted", submittedAt),
    formatHeaderLine("From name", payload.name),
    formatHeaderLine("From email", payload.email),
    formatHeaderLine("Company", trimToUndefined(payload.company)),
    formatHeaderLine("Subject", payload.subject),
    formatHeaderLine("Reply-To", payload.email),
    formatHeaderLine("IP", ip),
    formatHeaderLine("User-Agent", userAgent),
    formatHeaderLine("Referer", referer),
  ]
    .filter(Boolean)
    .join("\n")

  const subject = `[cofoundry.jacobdanderson.net] Contact form from ${payload.name}: ${payload.subject}`
  const message = buildRawMessage({
    fromEmail: mailConfig.fromEmail,
    fromName: mailConfig.fromName,
    toEmail: mailConfig.toEmail,
    replyTo: payload.email,
    subject,
    body: `${metadata}\n\nMessage:\n${payload.message}`,
  })

  await sendRawSendmail(
    mailConfig.sendmailPath,
    [mailConfig.toEmail, ...(mailConfig.bccEmail || [])],
    message,
  )
}
