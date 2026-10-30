import type { H3Event } from "h3"
import type { z } from "zod"
import type { contactSchema } from "~/shared/utils/validation"
import { Buffer } from "node:buffer"
import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { once } from "node:events"
import net from "node:net"
import os from "node:os"
import { isAbsolute } from "node:path"
import { env } from "node:process"
import tls from "node:tls"

import { getHeader } from "h3"
import { getRequesterIp } from "./rate-limit"

type ContactPayload = z.infer<typeof contactSchema>

interface SendmailConfig {
  kind: "sendmail"
  bccEmail?: string[]
  fromEmail: string
  fromName: string
  sendmailPath: string
  timeoutMs: number
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
  timeoutMs: number
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
const maximumSmtpBufferChars = 64 * 1024
const maximumSendmailStderrBytes = 64 * 1024
const maximumMailMessageBytes = 512 * 1024
const defaultSmtpTimeoutMs = 15_000

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

function requireEnvelopeAddress(value: string, label: string) {
  const atIndex = value.indexOf("@")
  const localPart = atIndex > 0
    ? value.slice(0, atIndex)
    : ""
  const domain = atIndex > 0
    ? value.slice(atIndex + 1)
    : ""
  const structurallyValid = Boolean(
    localPart
    && localPart.length <= 64
    && domain
    && domain.length <= 253
    && domain.includes(".")
    && !domain.startsWith(".")
    && !domain.endsWith(".")
    && !domain.includes("..")
    && !domain.includes("@"),
  )

  if (value.length > 254 || !structurallyValid || /[\0-\x20<>]/.test(value))
    throw new TypeError(`${label} must be a valid single email address.`)

  return value
}

function requireSmtpHost(value: string) {
  if (value.length > 253 || /[\0-\x20/\\]/.test(value))
    throw new TypeError("CONTACT_SMTP_HOST is invalid.")

  return value
}

function parsePort(value: string) {
  const port = Number.parseInt(value, 10)
  if (!/^\d+$/.test(value) || port < 1 || port > 65_535)
    throw new TypeError("CONTACT_SMTP_PORT must be an integer from 1 to 65535.")

  return port
}

function parseTimeout(value: string | undefined, label = "CONTACT_SMTP_TIMEOUT_MS") {
  const configured = value?.trim()
  if (!configured)
    return defaultSmtpTimeoutMs

  const timeoutMs = Number.parseInt(configured, 10)
  if (!/^\d+$/.test(configured) || timeoutMs < 1000 || timeoutMs > 60_000)
    throw new TypeError(`${label} must be an integer from 1000 to 60000.`)

  return timeoutMs
}

function escapeHeader(value: string) {
  return value.replaceAll(newlinePattern, " ").trim()
}

function dotStuff(message: string) {
  return message
    .split(newlinePattern)
    .map(line => (line.startsWith(".")
      ? `.${line}`
      : line))
    .join("\r\n")
}

function buildRawMessage({
  fromEmail,
  fromName,
  toEmail,
  replyTo,
  subject,
  body,
  headers,
}: {
  body: string
  fromEmail: string
  fromName: string
  headers?: Record<string, string | undefined>
  replyTo: string
  subject: string
  toEmail: string
}) {
  const messageIdHost = trimToUndefined(env.CONTACT_MESSAGE_ID_HOST) || "jacobdanderson.net"
  const extraHeaders = Object.entries(headers || {})
    .filter(([name, value]) => /^[a-z0-9-]+$/i.test(name) && trimToUndefined(value))
    .map(([name, value]) => `${name}: ${escapeHeader(value || "")}`)

  return [
    `From: "${escapeHeader(fromName)}" <${escapeHeader(fromEmail)}>`,
    `To: ${escapeHeader(toEmail)}`,
    `Reply-To: ${escapeHeader(replyTo)}`,
    `Subject: ${escapeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomUUID()}@${escapeHeader(messageIdHost)}>`,
    ...extraHeaders,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
    "",
  ].join("\r\n")
}

export interface PlainTextEmailPayload {
  body: string
  headers?: Record<string, string | undefined>
  replyTo?: string
  subject: string
  toEmail?: string
}

class SmtpLineReader {
  private buffer = ""
  private error: Error | null = null
  private resume: (() => void) | null = null

  constructor(private readonly socket: SocketLike) {
    socket.on("data", (chunk) => {
      this.buffer += chunk.toString()
      if (this.buffer.length > maximumSmtpBufferChars) {
        this.error = new Error("SMTP response exceeded the allowed buffer.")
        socket.destroy(this.error)
      }
      this.resume?.()
      this.resume = null
    })

    socket.on("error", (error) => {
      this.error = error instanceof Error
        ? error
        : new Error(String(error))
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
      if (lines.length > 100)
        throw new Error("SMTP response contained too many lines.")

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
        return {
          code: Number.parseInt(responseCode, 10),
          lines
        }
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

function applySocketTimeout(socket: SocketLike, timeoutMs: number) {
  socket.setTimeout(timeoutMs, () => {
    socket.destroy(new Error("SMTP connection timed out."))
  })
}

async function upgradeToTls(socket: net.Socket, host: string, timeoutMs: number) {
  const secureSocket = tls.connect({
    host,
    ...(net.isIP(host)
      ? {}
      : { servername: host }),
    socket,
  })

  applySocketTimeout(secureSocket, timeoutMs)
  await once(secureSocket, "secureConnect")
  return secureSocket
}

async function connectSmtp(config: SmtpConfig) {
  let socket: SocketLike

  if (config.secure) {
    socket = tls.connect({
      host: config.host,
      port: config.port,
      ...(net.isIP(config.host)
        ? {}
        : { servername: config.host }),
    })
    applySocketTimeout(socket, config.timeoutMs)
    await once(socket, "secureConnect")
  }
  else {
    socket = net.connect({
      host: config.host,
      port: config.port,
    })
    applySocketTimeout(socket, config.timeoutMs)
    await once(socket, "connect")
  }

  let reader = new SmtpLineReader(socket)
  const greeting = await reader.readResponse()
  assertSmtpCode(greeting, [220], "SMTP greeting")

  const clientName = (trimToUndefined(env.CONTACT_SMTP_CLIENT_NAME) || os.hostname() || "localhost")
    .replace(/[^a-z0-9.-]/gi, "-")
    .slice(0, 253)
  let ehlo = await sendSmtpCommand(socket, reader, `EHLO ${clientName}`)
  assertSmtpCode(ehlo, [250], "SMTP EHLO")

  let capabilities = parseSmtpCapabilities(ehlo)

  if (!config.secure && config.requireTLS) {
    if (!capabilities.has("STARTTLS")) {
      throw new Error("SMTP server does not advertise STARTTLS")
    }

    const startTls = await sendSmtpCommand(socket, reader, "STARTTLS")
    assertSmtpCode(startTls, [220], "SMTP STARTTLS")

    socket = await upgradeToTls(socket as net.Socket, config.host, config.timeoutMs)
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
  const recipients = [
    config.toEmail,
    ...(config.bccEmail || [])
  ]

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
  const recipients = [
    config.toEmail,
    ...(config.bccEmail || [])
  ]

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      config.sendmailPath,
      [
        "-i",
        "-f",
        config.fromEmail,
        ...recipients
      ],
      {
        shell: false,
        stdio: ["pipe", "ignore", "pipe"],
        windowsHide: true,
      },
    )

    let stderr = ""
    let settled = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    const settle = (error?: Error) => {
      if (settled)
        return
      settled = true
      if (timeout)
        clearTimeout(timeout)
      if (error)
        reject(error)
      else
        resolve()
    }
    timeout = setTimeout(() => {
      child.kill("SIGKILL")
      settle(new Error("sendmail delivery timed out."))
    }, config.timeoutMs)

    child.stderr.on("data", (chunk) => {
      if (Buffer.byteLength(stderr) + chunk.length > maximumSendmailStderrBytes) {
        child.kill("SIGKILL")
        settle(new Error("sendmail error output exceeded the allowed buffer."))
        return
      }
      stderr += chunk.toString()
    })

    child.stdin.on("error", error => settle(error))
    child.once("error", error => settle(error))
    child.once("close", (code) => {
      if (code === 0) {
        settle()
        return
      }

      settle(new Error(stderr.trim() || `sendmail exited with code ${code}`))
    })

    child.stdin.end(message)
  })
}

export function getContactMailConfig(): ContactMailConfig | null {
  const fromEmail = trimToUndefined(env.CONTACT_FROM_EMAIL)
  if (!fromEmail) {
    return null
  }

  const safeFromEmail = requireEnvelopeAddress(fromEmail, "CONTACT_FROM_EMAIL")
  const toEmail = requireEnvelopeAddress(trimToUndefined(env.CONTACT_TO_EMAIL) || "contacts@jacobdanderson.net", "CONTACT_TO_EMAIL")
  const bccEmail = parseAddressList(env.CONTACT_BCC_EMAIL)?.map(address => requireEnvelopeAddress(address, "CONTACT_BCC_EMAIL"))
  const fromName = trimToUndefined(env.CONTACT_FROM_NAME) || "CoFoundry"

  const smtpHost = trimToUndefined(env.CONTACT_SMTP_HOST)
  if (smtpHost) {
    const secure = isEnabled(env.CONTACT_SMTP_SECURE)
    const requireTLS = env.CONTACT_SMTP_REQUIRE_TLS?.trim()
      ? isEnabled(env.CONTACT_SMTP_REQUIRE_TLS)
      : !secure
    const user = trimToUndefined(env.CONTACT_SMTP_USER)
    const pass = trimToUndefined(env.CONTACT_SMTP_PASS)
    if (Boolean(user) !== Boolean(pass))
      throw new TypeError("CONTACT_SMTP_USER and CONTACT_SMTP_PASS must be configured together.")
    if (!secure && !requireTLS && user)
      throw new TypeError("SMTP authentication requires implicit TLS or STARTTLS.")

    return {
      kind: "smtp",
      bccEmail,
      fromEmail: safeFromEmail,
      fromName,
      host: requireSmtpHost(smtpHost),
      pass,
      port: parsePort(env.CONTACT_SMTP_PORT || (secure ? "465" : "587")),
      requireTLS,
      secure,
      timeoutMs: parseTimeout(env.CONTACT_SMTP_TIMEOUT_MS),
      toEmail,
      user,
    }
  }

  const sendmailPath = trimToUndefined(env.CONTACT_SENDMAIL_PATH) || "/usr/sbin/sendmail"
  const useSendmail = isEnabled(env.CONTACT_USE_SENDMAIL) || !!trimToUndefined(env.CONTACT_SENDMAIL_PATH)

  if (!useSendmail) {
    return null
  }
  if (!isAbsolute(sendmailPath))
    throw new TypeError("CONTACT_SENDMAIL_PATH must be an absolute executable path.")

  return {
    kind: "sendmail",
    bccEmail,
    fromEmail: safeFromEmail,
    fromName,
    sendmailPath,
    timeoutMs: parseTimeout(env.CONTACT_SENDMAIL_TIMEOUT_MS, "CONTACT_SENDMAIL_TIMEOUT_MS"),
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

export async function sendPlainTextEmail(payload: PlainTextEmailPayload) {
  const mailConfig = getContactMailConfig()
  if (!mailConfig) {
    throw new Error("Contact mail is not configured")
  }

  const targetConfig = {
    ...mailConfig,
    toEmail: requireEnvelopeAddress(payload.toEmail || mailConfig.toEmail, "Email recipient"),
  }
  const replyTo = requireEnvelopeAddress(payload.replyTo || targetConfig.fromEmail, "Email reply-to")
  const message = buildRawMessage({
    body: payload.body,
    fromEmail: targetConfig.fromEmail,
    fromName: targetConfig.fromName,
    headers: payload.headers,
    replyTo,
    subject: payload.subject,
    toEmail: targetConfig.toEmail,
  })
  if (Buffer.byteLength(message) > maximumMailMessageBytes)
    throw new Error("Email message exceeds the configured delivery limit.")

  if (targetConfig.kind === "smtp") {
    await sendViaSmtp(targetConfig, message)
    return
  }

  await sendRawSendmail(targetConfig, message)
}

function formatHeaderLine(label: string, value?: string) {
  return value
    ? `${label}: ${value}`
    : undefined
}

export async function sendContactMessage(payload: ContactPayload, event: H3Event) {
  const mailConfig = getContactMailConfig()
  if (!mailConfig) {
    throw new Error("Contact mail is not configured")
  }

  const submittedAt = new Date().toISOString()
  const userAgent = trimToUndefined(getHeader(event, "user-agent") || undefined)
  const referer = trimToUndefined(getHeader(event, "referer") || undefined)
  const ip = trimToUndefined(getRequesterIp(event) || undefined)

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

  await sendPlainTextEmail({
    body: `${metadata}\n\nMessage:\n${payload.message}`,
    replyTo: payload.email,
    subject,
    toEmail: mailConfig.toEmail,
  })
}
