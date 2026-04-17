import type { H3Event } from "h3"
import type { z } from "zod"
import type { contactSchema } from "~/shared/utils/validation"
import { Buffer } from "node:buffer"
import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { once } from "node:events"
import net from "node:net"
import os from "node:os"
import { env } from "node:process"
import tls from "node:tls"

import { getHeader, getRequestIP } from "h3"

type ContactPayload = z.infer<typeof contactSchema>

interface SendmailConfig {
  kind: "sendmail"
  bccEmail?: string[]
  fromEmail: string
  fromName: string
  sendmailPath: string
  toEmail: string
}

interface SmtpConfig {
  kind: "smtp"
  bccEmail?: string[]
  fromEmail: string
  fromName: string
  host: string
  pass?: string
  port: number
  requireTLS: boolean
  secure: boolean
  toEmail: string
  user?: string
}

type ContactMailConfig = SendmailConfig | SmtpConfig
type SocketLike = net.Socket | tls.TLSSocket
interface SmtpResponse { code: number, lines: string[] }

const truthyValues = new Set(["1", "true", "yes", "on"])
const newlinePattern = /\r?\n/g
const trailingCarriageReturnPattern = /\r$/g
const smtpResponsePattern = /^(\d{3})([ -]).*$/
const smtpCapabilityPattern = /^\d{3}[ -]([a-z0-9-]+)/i

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
  return value.replaceAll(newlinePattern, " ").trim()
}

function dotStuff(message: string) {
  return message
    .split(newlinePattern)
    .map(line => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n")
}

function buildRawMessage({
  fromEmail,
  fromName,
  toEmail,
  replyTo,
  subject,
  body,
}: {
  body: string
  fromEmail: string
  fromName: string
  replyTo: string
  subject: string
  toEmail: string
}) {
  const messageIdHost = trimToUndefined(env.CONTACT_MESSAGE_ID_HOST) || "jacobdanderson.net"
  return [
    `From: "${escapeHeader(fromName)}" <${escapeHeader(fromEmail)}>`,
    `To: ${escapeHeader(toEmail)}`,
    `Reply-To: ${escapeHeader(replyTo)}`,
    `Subject: ${escapeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomUUID()}@${escapeHeader(messageIdHost)}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
    "",
  ].join("\r\n")
}

class SmtpLineReader {
  private buffer = ""
  private error: Error | null = null
  private resume: (() => void) | null = null

  constructor(private readonly socket: SocketLike) {
    socket.on("data", (chunk) => {
      this.buffer += chunk.toString()
      this.resume?.()
      this.resume = null
    })

    socket.on("error", (error) => {
      this.error = error instanceof Error ? error : new Error(String(error))
      this.resume?.()
      this.resume = null
    })

    socket.on("end", () => {
      this.error = new Error("SMTP connection closed")
      this.resume?.()
      this.resume = null
    })
  }

  private async waitForData() {
    if (this.buffer.includes("\n")) {
      return
    }
    if (this.error) {
      throw this.error
    }

    await new Promise<void>((resolve) => {
      this.resume = resolve
    })

    if (this.error) {
      throw this.error
    }
  }

  async readLine() {
    while (!this.buffer.includes("\n")) {
      await this.waitForData()
    }

    const newlineIndex = this.buffer.indexOf("\n")
    const line = this.buffer.slice(0, newlineIndex).replace(trailingCarriageReturnPattern, "")
    this.buffer = this.buffer.slice(newlineIndex + 1)
    return line
  }

  async readResponse(): Promise<SmtpResponse> {
    const lines: string[] = []
    let responseCode = ""

    while (true) {
      const line = await this.readLine()
      lines.push(line)

      const match = smtpResponsePattern.exec(line)
      if (!match) {
        continue
      }

      const code = match[1] || ""
      const separator = match[2] || ""

      if (!responseCode) {
        responseCode = code
      }

      if (code === responseCode && separator === " ") {
        return { code: Number.parseInt(responseCode, 10), lines }
      }
    }
  }
}

async function writeToSocket(socket: SocketLike, payload: string) {
  await new Promise<void>((resolve, reject) => {
    socket.write(payload, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

async function sendSmtpCommand(socket: SocketLike, reader: SmtpLineReader, command: string) {
  await writeToSocket(socket, `${command}\r\n`)
  return reader.readResponse()
}

function assertSmtpCode(response: SmtpResponse, allowedCodes: number[], label: string) {
  if (!allowedCodes.includes(response.code)) {
    throw new Error(`${label} failed: ${response.lines.join(" | ")}`)
  }
}

function parseSmtpCapabilities(response: SmtpResponse) {
  const capabilities = new Set<string>()

  for (const line of response.lines) {
    const match = smtpCapabilityPattern.exec(line)
    const capability = match?.[1]

    if (capability)
      capabilities.add(capability.toUpperCase())
  }

  return capabilities
}

async function upgradeToTls(socket: net.Socket, host: string) {
  const secureSocket = tls.connect({
    host,
    servername: host,
    socket,
  })

  await once(secureSocket, "secureConnect")
  return secureSocket
}

async function connectSmtp(config: SmtpConfig) {
  let socket: SocketLike

  if (config.secure) {
    socket = tls.connect({
      host: config.host,
      port: config.port,
      servername: config.host,
    })
    await once(socket, "secureConnect")
  }
  else {
    socket = net.connect({
      host: config.host,
      port: config.port,
    })
    await once(socket, "connect")
  }

  let reader = new SmtpLineReader(socket)
  const greeting = await reader.readResponse()
  assertSmtpCode(greeting, [220], "SMTP greeting")

  const clientName = trimToUndefined(env.CONTACT_SMTP_CLIENT_NAME) || os.hostname() || "localhost"
  let ehlo = await sendSmtpCommand(socket, reader, `EHLO ${clientName}`)
  assertSmtpCode(ehlo, [250], "SMTP EHLO")

  let capabilities = parseSmtpCapabilities(ehlo)

  if (!config.secure && config.requireTLS) {
    if (!capabilities.has("STARTTLS")) {
      throw new Error("SMTP server does not advertise STARTTLS")
    }

    const startTls = await sendSmtpCommand(socket, reader, "STARTTLS")
    assertSmtpCode(startTls, [220], "SMTP STARTTLS")

    socket = await upgradeToTls(socket as net.Socket, config.host)
    reader = new SmtpLineReader(socket)
    ehlo = await sendSmtpCommand(socket, reader, `EHLO ${clientName}`)
    assertSmtpCode(ehlo, [250], "SMTP EHLO after STARTTLS")
    capabilities = parseSmtpCapabilities(ehlo)
  }

  if (config.user && config.pass) {
    const authPlain = Buffer.from(`\0${config.user}\0${config.pass}`).toString("base64")
    const plainResponse = await sendSmtpCommand(socket, reader, `AUTH PLAIN ${authPlain}`)

    if (plainResponse.code !== 235) {
      if (![500, 502, 504].includes(plainResponse.code)) {
        throw new Error(`SMTP AUTH PLAIN failed: ${plainResponse.lines.join(" | ")}`)
      }

      const loginStart = await sendSmtpCommand(socket, reader, "AUTH LOGIN")
      assertSmtpCode(loginStart, [334], "SMTP AUTH LOGIN start")

      const userResponse = await sendSmtpCommand(socket, reader, Buffer.from(config.user).toString("base64"))
      assertSmtpCode(userResponse, [334], "SMTP AUTH LOGIN username")

      const passResponse = await sendSmtpCommand(socket, reader, Buffer.from(config.pass).toString("base64"))
      assertSmtpCode(passResponse, [235], "SMTP AUTH LOGIN password")
    }
  }

  return { capabilities, reader, socket }
}

async function closeSmtpConnection(socket: SocketLike, reader: SmtpLineReader) {
  try {
    await sendSmtpCommand(socket, reader, "QUIT")
  }
  catch {
    socket.destroy()
  }

  socket.end()
}

async function sendViaSmtp(config: SmtpConfig, message: string) {
  const { reader, socket } = await connectSmtp(config)
  const recipients = [config.toEmail, ...(config.bccEmail || [])]

  try {
    const mailFrom = await sendSmtpCommand(socket, reader, `MAIL FROM:<${config.fromEmail}>`)
    assertSmtpCode(mailFrom, [250], "SMTP MAIL FROM")

    for (const recipient of recipients) {
      const rcptTo = await sendSmtpCommand(socket, reader, `RCPT TO:<${recipient}>`)
      assertSmtpCode(rcptTo, [250, 251], `SMTP RCPT TO ${recipient}`)
    }

    const dataStart = await sendSmtpCommand(socket, reader, "DATA")
    assertSmtpCode(dataStart, [354], "SMTP DATA")

    await writeToSocket(socket, `${dotStuff(message)}\r\n.\r\n`)
    const dataComplete = await reader.readResponse()
    assertSmtpCode(dataComplete, [250], "SMTP message delivery")
  }
  finally {
    await closeSmtpConnection(socket, reader)
  }
}

async function sendRawSendmail(config: SendmailConfig, message: string) {
  const recipients = [config.toEmail, ...(config.bccEmail || [])]

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      config.sendmailPath,
      ["-i", "-f", config.fromEmail, ...recipients],
      { stdio: ["pipe", "ignore", "pipe"] },
    )

    let stderr = ""

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })

    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(stderr.trim() || `sendmail exited with code ${code}`))
    })

    child.stdin.end(message)
  })
}

function getContactMailConfig(): ContactMailConfig | null {
  const fromEmail = trimToUndefined(env.CONTACT_FROM_EMAIL)
  if (!fromEmail) {
    return null
  }

  const toEmail = trimToUndefined(env.CONTACT_TO_EMAIL) || "contacts@jacobdanderson.net"
  const bccEmail = parseAddressList(env.CONTACT_BCC_EMAIL)
  const fromName = trimToUndefined(env.CONTACT_FROM_NAME) || "CoFoundry"

  const smtpHost = trimToUndefined(env.CONTACT_SMTP_HOST)
  if (smtpHost) {
    const secure = isEnabled(env.CONTACT_SMTP_SECURE)
    const port = Number.parseInt(env.CONTACT_SMTP_PORT || (secure ? "465" : "587"), 10)

    if (!Number.isFinite(port)) {
      throw new TypeError("Invalid CONTACT_SMTP_PORT")
    }

    return {
      kind: "smtp",
      bccEmail,
      fromEmail,
      fromName,
      host: smtpHost,
      pass: trimToUndefined(env.CONTACT_SMTP_PASS),
      port,
      requireTLS: isEnabled(env.CONTACT_SMTP_REQUIRE_TLS),
      secure,
      toEmail,
      user: trimToUndefined(env.CONTACT_SMTP_USER),
    }
  }

  const sendmailPath = trimToUndefined(env.CONTACT_SENDMAIL_PATH) || "/usr/sbin/sendmail"
  const useSendmail = isEnabled(env.CONTACT_USE_SENDMAIL) || !!trimToUndefined(env.CONTACT_SENDMAIL_PATH)

  if (!useSendmail) {
    return null
  }

  return {
    kind: "sendmail",
    bccEmail,
    fromEmail,
    fromName,
    sendmailPath,
    toEmail,
  }
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
    body: `${metadata}\n\nMessage:\n${payload.message}`,
    fromEmail: mailConfig.fromEmail,
    fromName: mailConfig.fromName,
    replyTo: payload.email,
    subject,
    toEmail: mailConfig.toEmail,
  })

  if (mailConfig.kind === "smtp") {
    await sendViaSmtp(mailConfig, message)
    return
  }

  await sendRawSendmail(mailConfig, message)
}
