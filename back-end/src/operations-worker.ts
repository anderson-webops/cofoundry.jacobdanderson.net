import type { SpawnOptionsWithoutStdio } from "node:child_process"
import { Buffer } from "node:buffer"
import { spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import process from "node:process"

type EnvironmentSource = Record<string, string | undefined>
type FetchLike = typeof fetch

interface WorkerCommandOptions {
  env?: EnvironmentSource
  fetch?: FetchLike
  log?: (message: string) => void
  now?: () => Date
  runShellCommand?: typeof runShellCommand
}

interface ParsedArgs {
  command: string
  commandArgs: string[]
  flags: Map<string, string[]>
}

interface OperationsWorkerEnvironment {
  appUrl: string
  timeoutMs: number
  token: string
}

interface PendingFileScan {
  id: string
  originalFilename: string
  signedDownloadError?: string | null
  signedDownloadUrl?: string | null
}

interface OperationsResponse<T> {
  mode: string
  pendingScans?: PendingFileScan[]
  [key: string]: T | PendingFileScan[] | string | undefined
}

const defaultTimeoutMs = 60_000

function readValue(env: EnvironmentSource, key: string) {
  return env[key]?.trim() || ""
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "")
}

function timestampForId(date: Date) {
  return date.toISOString().replaceAll(/[:.]/g, "-")
}

function parseBooleanFlag(value: string | undefined) {
  if (!value)
    return true

  return !["0", "false", "no", "off"].includes(value.toLowerCase())
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "", ...rest] = argv
  const flags = new Map<string, string[]>()
  const commandArgs: string[] = []

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]

    if (arg === "--") {
      commandArgs.push(...rest.slice(index + 1))
      break
    }

    if (!arg.startsWith("--")) {
      commandArgs.push(arg)
      continue
    }

    const flag = arg.slice(2)
    const inlineSeparatorIndex = flag.indexOf("=")
    const rawKey = inlineSeparatorIndex >= 0 ? flag.slice(0, inlineSeparatorIndex) : flag
    const inlineValue = inlineSeparatorIndex >= 0 ? flag.slice(inlineSeparatorIndex + 1) : undefined
    const key = rawKey.trim()
    const next = rest[index + 1]
    const value = typeof inlineValue === "string"
      ? inlineValue
      : next && !next.startsWith("--")
        ? (index += 1, next)
        : "true"

    flags.set(key, [...(flags.get(key) || []), value])
  }

  return { command, commandArgs, flags }
}

function flagValue(flags: Map<string, string[]>, key: string, fallback = "") {
  const values = flags.get(key)
  return values?.[values.length - 1]?.trim() || fallback
}

function flagValues(flags: Map<string, string[]>, key: string) {
  return flags.get(key)?.map(value => value.trim()).filter(Boolean) || []
}

function parseMetadata(flags: Map<string, string[]>) {
  const metadata: Record<string, unknown> = {}

  for (const entry of flagValues(flags, "metadata")) {
    const separatorIndex = entry.indexOf("=")
    if (separatorIndex <= 0)
      throw new Error(`Invalid --metadata value "${entry}". Use key=value.`)

    const key = entry.slice(0, separatorIndex).trim()
    const value = entry.slice(separatorIndex + 1).trim()
    metadata[key] = value
  }

  return metadata
}

export function resolveOperationsWorkerEnvironment(env: EnvironmentSource = process.env): OperationsWorkerEnvironment {
  const appUrl = stripTrailingSlash(readValue(env, "NUXT_PUBLIC_APP_URL") || readValue(env, "COFOUNDRY_APP_URL"))
  const token = readValue(env, "COFOUNDRY_OPERATIONS_TOKEN") || readValue(env, "OPERATIONS_WORKER_TOKEN")
  const timeoutMs = parsePositiveInteger(readValue(env, "COFOUNDRY_OPERATIONS_TIMEOUT_MS"), defaultTimeoutMs)

  if (!appUrl)
    throw new Error("Set NUXT_PUBLIC_APP_URL or COFOUNDRY_APP_URL before running an operations worker.")

  try {
    const parsedUrl = new URL(appUrl)
    if (!parsedUrl.protocol.startsWith("http") || !parsedUrl.host)
      throw new Error("invalid")
  }
  catch {
    throw new Error("Operations worker app URL must be an absolute HTTP(S) URL.")
  }

  if (!token)
    throw new Error("Set COFOUNDRY_OPERATIONS_TOKEN before running an operations worker.")

  return { appUrl, timeoutMs, token }
}

function authHeaders(environment: OperationsWorkerEnvironment) {
  return {
    "authorization": `Bearer ${environment.token}`,
    "content-type": "application/json",
  }
}

function downloadHeaders(environment: OperationsWorkerEnvironment, url: string) {
  return url.startsWith(`${environment.appUrl}/`)
    ? { authorization: `Bearer ${environment.token}` }
    : undefined
}

async function readResponseBody(response: Response) {
  const text = await response.text()
  if (!text)
    return {}

  try {
    return JSON.parse(text) as unknown
  }
  catch {
    return { body: text }
  }
}

async function requestJson<T>(
  environment: OperationsWorkerEnvironment,
  path: string,
  options: { body?: unknown, fetchImpl: FetchLike, method?: string } = { fetchImpl: fetch },
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), environment.timeoutMs)

  try {
    const response = await options.fetchImpl(`${environment.appUrl}${path}`, {
      body: typeof options.body === "undefined" ? undefined : JSON.stringify(options.body),
      headers: authHeaders(environment),
      method: options.method || (typeof options.body === "undefined" ? "GET" : "POST"),
      signal: controller.signal,
    })
    const body = await readResponseBody(response)

    if (!response.ok)
      throw new Error(`Operations request failed (${response.status}) for ${path}: ${JSON.stringify(body)}`)

    return body as T
  }
  finally {
    clearTimeout(timeout)
  }
}

export async function runShellCommand(command: string, options: SpawnOptionsWithoutStdio = {}) {
  return new Promise<number>((resolvePromise, rejectPromise) => {
    const child = spawn(command, {
      shell: true,
      stdio: "inherit",
      ...options,
    })

    child.once("error", rejectPromise)
    child.once("close", code => resolvePromise(code ?? 1))
  })
}

export function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`
}

function scannerCommandForFile(scannerCommand: string, filePath: string, uploadId: string) {
  if (scannerCommand.includes("{file}") || scannerCommand.includes("{id}")) {
    return scannerCommand
      .replaceAll("{file}", shellQuote(filePath))
      .replaceAll("{id}", shellQuote(uploadId))
  }

  return `${scannerCommand} ${shellQuote(filePath)}`
}

async function runBackup(parsed: ParsedArgs, options: Required<WorkerCommandOptions>) {
  if (!parsed.commandArgs.length)
    throw new Error("Backup worker requires a command after --, for example: operations-worker backup -- restic backup /path.")

  const environment = resolveOperationsWorkerEnvironment(options.env)
  const startedAt = options.now().toISOString()
  const id = flagValue(parsed.flags, "id", `backup-${timestampForId(options.now())}`)
  const provider = flagValue(parsed.flags, "provider", readValue(options.env, "COFOUNDRY_BACKUP_PROVIDER") || "server-backup")
  const artifactUri = flagValue(parsed.flags, "artifact-uri", readValue(options.env, "COFOUNDRY_BACKUP_ARTIFACT_URI")) || null
  const notes = flagValue(parsed.flags, "notes") || null
  const metadata = parseMetadata(parsed.flags)
  const command = parsed.commandArgs.join(" ")

  await requestJson(environment, "/api/operations/backup-runs", {
    body: { artifactUri, id, metadata, notes, provider, startedAt, status: "running" },
    fetchImpl: options.fetch,
  })

  const exitCode = await options.runShellCommand(command)
  const status = exitCode === 0 ? "succeeded" : "failed"

  await requestJson(environment, "/api/operations/backup-runs", {
    body: {
      artifactUri,
      completedAt: options.now().toISOString(),
      id,
      metadata: {
        ...metadata,
        command,
        exitCode,
      },
      notes: notes || `Backup command ${status}.`,
      provider,
      startedAt,
      status,
    },
    fetchImpl: options.fetch,
  })

  if (exitCode !== 0)
    throw new Error(`Backup command failed with exit code ${exitCode}.`)

  options.log(`Backup run ${id} reported as succeeded.`)
}

async function runDigest(parsed: ParsedArgs, options: Required<WorkerCommandOptions>) {
  const environment = resolveOperationsWorkerEnvironment(options.env)
  const dryRun = parseBooleanFlag(flagValue(parsed.flags, "dry-run", "false"))
  const maxUsers = parsePositiveInteger(flagValue(parsed.flags, "max-users"), 100)
  const onlyWithUnread = !parseBooleanFlag(flagValue(parsed.flags, "include-read", "false"))
  const userId = flagValue(parsed.flags, "user-id") || undefined
  const response = await requestJson(environment, "/api/operations/notification-digests/run", {
    body: { dryRun, maxUsers, onlyWithUnread, userId },
    fetchImpl: options.fetch,
  })

  options.log(JSON.stringify(response, null, 2))
}

async function runLifecycleNotification(parsed: ParsedArgs, options: Required<WorkerCommandOptions>) {
  const environment = resolveOperationsWorkerEnvironment(options.env)
  const eventType = flagValue(parsed.flags, "event-type")
  const targetId = flagValue(parsed.flags, "target-id")
  const targetType = flagValue(parsed.flags, "target-type") || null
  const userId = flagValue(parsed.flags, "user-id")

  if (!eventType)
    throw new Error("Lifecycle notification requires --event-type.")

  if (!targetId)
    throw new Error("Lifecycle notification requires --target-id.")

  if (!userId)
    throw new Error("Lifecycle notification requires --user-id.")

  const response = await requestJson(environment, "/api/operations/notifications/lifecycle", {
    body: {
      dryRun: parseBooleanFlag(flagValue(parsed.flags, "dry-run", "false")),
      eventType,
      metadata: parseMetadata(parsed.flags),
      targetId,
      targetType,
      userId,
    },
    fetchImpl: options.fetch,
  })

  options.log(JSON.stringify(response, null, 2))
}

async function downloadPendingFile(environment: OperationsWorkerEnvironment, item: PendingFileScan, fetchImpl: FetchLike) {
  if (!item.signedDownloadUrl)
    throw new Error(item.signedDownloadError || "No signed download URL was returned for the pending scan.")

  const response = await fetchImpl(item.signedDownloadUrl, {
    headers: downloadHeaders(environment, item.signedDownloadUrl),
  })

  if (!response.ok)
    throw new Error(`Download failed (${response.status}) for upload ${item.id}.`)

  const bytes = Buffer.from(await response.arrayBuffer())
  const directory = await mkdtemp(join(tmpdir(), "cofoundry-scan-"))
  const filePath = join(directory, basename(item.originalFilename || item.id))
  await writeFile(filePath, bytes)

  return { directory, filePath }
}

async function reportScanResult(
  environment: OperationsWorkerEnvironment,
  item: PendingFileScan,
  result: { notes: string, scanStatus: "clean" | "flagged" | "failed" | "skipped", status?: "uploaded" | "blocked" },
  fetchImpl: FetchLike,
) {
  await requestJson(environment, `/api/operations/file-scans/${encodeURIComponent(item.id)}`, {
    body: result,
    fetchImpl,
  })
}

async function runScan(parsed: ParsedArgs, options: Required<WorkerCommandOptions>) {
  const environment = resolveOperationsWorkerEnvironment(options.env)
  const limit = parsePositiveInteger(flagValue(parsed.flags, "limit"), 25)
  const allowSkip = parseBooleanFlag(flagValue(parsed.flags, "allow-skip", "false"))
  const scannerCommand = flagValue(parsed.flags, "scanner-command", readValue(options.env, "COFOUNDRY_FILE_SCANNER_COMMAND"))
  const pendingResponse = await requestJson<OperationsResponse<unknown>>(environment, `/api/operations/file-scans/pending?limit=${limit}`, {
    fetchImpl: options.fetch,
  })
  const pendingScans = pendingResponse.pendingScans || []
  let clean = 0
  let failed = 0
  let flagged = 0
  let skipped = 0

  if (!scannerCommand && !allowSkip && pendingScans.length) {
    await requestJson(environment, "/api/operations/events", {
      body: {
        eventType: "file_scan_worker_missing_scanner",
        metadata: { pending: pendingScans.length },
        severity: "error",
        source: "file-scan-worker",
      },
      fetchImpl: options.fetch,
    })
    throw new Error("Set COFOUNDRY_FILE_SCANNER_COMMAND or pass --scanner-command before running the scanner worker.")
  }

  for (const item of pendingScans) {
    let tempDirectory = ""

    try {
      if (!scannerCommand) {
        skipped += 1
        await reportScanResult(environment, item, {
          notes: "No scanner command configured; explicit skip requested by operations worker.",
          scanStatus: "skipped",
          status: "uploaded",
        }, options.fetch)
        continue
      }

      const downloaded = await downloadPendingFile(environment, item, options.fetch)
      tempDirectory = downloaded.directory
      const command = scannerCommandForFile(scannerCommand, downloaded.filePath, item.id)
      const exitCode = await options.runShellCommand(command, {
        env: {
          ...process.env,
          COFOUNDRY_SCAN_FILE: downloaded.filePath,
          COFOUNDRY_UPLOAD_ID: item.id,
        },
      })

      if (exitCode === 0) {
        clean += 1
        await reportScanResult(environment, item, {
          notes: "Scanner command exited cleanly.",
          scanStatus: "clean",
          status: "uploaded",
        }, options.fetch)
      }
      else if (exitCode === 1) {
        flagged += 1
        await reportScanResult(environment, item, {
          notes: "Scanner command flagged this upload.",
          scanStatus: "flagged",
          status: "blocked",
        }, options.fetch)
      }
      else {
        failed += 1
        await reportScanResult(environment, item, {
          notes: `Scanner command failed with exit code ${exitCode}.`,
          scanStatus: "failed",
          status: "blocked",
        }, options.fetch)
      }
    }
    catch (error) {
      failed += 1
      await reportScanResult(environment, item, {
        notes: error instanceof Error ? error.message : "Scanner worker failed.",
        scanStatus: "failed",
        status: "blocked",
      }, options.fetch)
    }
    finally {
      if (tempDirectory)
        await rm(tempDirectory, { force: true, recursive: true })
    }
  }

  await requestJson(environment, "/api/operations/events", {
    body: {
      eventType: "file_scan_worker_completed",
      metadata: { clean, failed, flagged, pending: pendingScans.length, skipped },
      severity: failed ? "error" : flagged ? "warning" : "info",
      source: "file-scan-worker",
    },
    fetchImpl: options.fetch,
  })

  options.log(JSON.stringify({ clean, failed, flagged, pending: pendingScans.length, skipped }, null, 2))
}

async function runEvent(parsed: ParsedArgs, options: Required<WorkerCommandOptions>) {
  const environment = resolveOperationsWorkerEnvironment(options.env)
  const source = flagValue(parsed.flags, "source", "operations-worker")
  const eventType = flagValue(parsed.flags, "event-type")

  if (!eventType)
    throw new Error("Operational event requires --event-type.")

  const response = await requestJson(environment, "/api/operations/events", {
    body: {
      actorUserId: flagValue(parsed.flags, "actor-user-id") || null,
      eventType,
      metadata: parseMetadata(parsed.flags),
      severity: flagValue(parsed.flags, "severity", "info"),
      source,
      targetId: flagValue(parsed.flags, "target-id") || null,
      targetType: flagValue(parsed.flags, "target-type") || null,
    },
    fetchImpl: options.fetch,
  })

  options.log(JSON.stringify(response, null, 2))
}

async function runRestoreDrill(parsed: ParsedArgs, options: Required<WorkerCommandOptions>) {
  if (!parsed.commandArgs.length)
    throw new Error("Restore drill worker requires a command after --.")

  const environment = resolveOperationsWorkerEnvironment(options.env)
  const id = flagValue(parsed.flags, "id", `restore-drill-${timestampForId(options.now())}`)
  const metadata = parseMetadata(parsed.flags)
  const command = parsed.commandArgs.join(" ")

  await requestJson(environment, "/api/operations/events", {
    body: {
      eventType: "restore_drill_started",
      metadata: { ...metadata, command },
      severity: "info",
      source: "restore-drill-worker",
      targetId: id,
      targetType: "restore_drill",
    },
    fetchImpl: options.fetch,
  })

  const exitCode = await options.runShellCommand(command)
  await requestJson(environment, "/api/operations/events", {
    body: {
      eventType: exitCode === 0 ? "restore_drill_succeeded" : "restore_drill_failed",
      metadata: { ...metadata, command, exitCode },
      severity: exitCode === 0 ? "info" : "error",
      source: "restore-drill-worker",
      targetId: id,
      targetType: "restore_drill",
    },
    fetchImpl: options.fetch,
  })

  if (exitCode !== 0)
    throw new Error(`Restore drill command failed with exit code ${exitCode}.`)

  options.log(`Restore drill ${id} reported as succeeded.`)
}

export async function runOperationsWorker(argv: string[], options: WorkerCommandOptions = {}) {
  const parsed = parseArgs(argv)
  const resolvedOptions: Required<WorkerCommandOptions> = {
    env: options.env || process.env,
    fetch: options.fetch || fetch,
    log: options.log || console.log,
    now: options.now || (() => new Date()),
    runShellCommand: options.runShellCommand || runShellCommand,
  }

  switch (parsed.command) {
    case "backup":
      return runBackup(parsed, resolvedOptions)
    case "digest":
      return runDigest(parsed, resolvedOptions)
    case "event":
      return runEvent(parsed, resolvedOptions)
    case "lifecycle-notification":
      return runLifecycleNotification(parsed, resolvedOptions)
    case "restore-drill":
      return runRestoreDrill(parsed, resolvedOptions)
    case "scan":
      return runScan(parsed, resolvedOptions)
    default:
      throw new Error([
        "Unknown operations worker command.",
        "Use one of: backup, digest, event, lifecycle-notification, restore-drill, scan.",
      ].join(" "))
  }
}
