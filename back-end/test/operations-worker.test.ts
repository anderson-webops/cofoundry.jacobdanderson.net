import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import test from "node:test"
import { resolveOperationsWorkerEnvironment, runOperationsWorker, shellQuote } from "../src/operations-worker"

interface CapturedRequest {
  body: unknown
  headers: Headers
  method: string
  url: string
}

function createJsonFetch(handler?: (request: CapturedRequest) => unknown | Response) {
  const requests: CapturedRequest[] = []
  const fetchImpl: typeof fetch = async (input, init = {}) => {
    const request: CapturedRequest = {
      body: init.body ? JSON.parse(String(init.body)) : null,
      headers: new Headers(init.headers),
      method: init.method || "GET",
      url: String(input),
    }
    requests.push(request)

    const result = handler?.(request)
    if (result instanceof Response)
      return result

    return new Response(JSON.stringify(result || { ok: true }), {
      headers: { "content-type": "application/json" },
      status: 200,
    })
  }

  return { fetchImpl, requests }
}

const workerEnv = {
  COFOUNDRY_OPERATIONS_TOKEN: "test-worker-token",
  NUXT_PUBLIC_APP_URL: "https://cofoundry.example.com/",
}

test("operations worker environment validates app URL and token", () => {
  assert.deepEqual(resolveOperationsWorkerEnvironment(workerEnv), {
    appUrl: "https://cofoundry.example.com",
    timeoutMs: 60_000,
    token: "test-worker-token",
  })

  assert.throws(
    () => resolveOperationsWorkerEnvironment({ NUXT_PUBLIC_APP_URL: "https://cofoundry.example.com" }),
    /Set COFOUNDRY_OPERATIONS_TOKEN/,
  )

  assert.throws(
    () => resolveOperationsWorkerEnvironment({ COFOUNDRY_OPERATIONS_TOKEN: "token", NUXT_PUBLIC_APP_URL: "localhost:3000" }),
    /absolute HTTP\(S\) URL/,
  )
})

test("operations backup worker reports running and succeeded lifecycle rows", async () => {
  const { fetchImpl, requests } = createJsonFetch()
  const commands: string[] = []

  await runOperationsWorker([
    "backup",
    "--provider",
    "restic",
    "--artifact-uri",
    "s3://cofoundry/backups/latest",
    "--metadata",
    "timer=daily",
    "--metadata",
    "signed=sig=a=b",
    "--",
    "restic backup /srv/cofoundry",
  ], {
    env: workerEnv,
    fetch: fetchImpl,
    log: () => {},
    now: () => new Date("2026-06-12T20:00:00.000Z"),
    runShellCommand: async (command) => {
      commands.push(command)
      return 0
    },
  })

  assert.deepEqual(commands, ["restic backup /srv/cofoundry"])
  assert.equal(requests.length, 2)
  assert.equal(requests[0].url, "https://cofoundry.example.com/api/operations/backup-runs")
  assert.equal(requests[0].headers.get("authorization"), "Bearer test-worker-token")
  assert.deepEqual(requests[0].body, {
    artifactUri: "s3://cofoundry/backups/latest",
    id: "backup-2026-06-12T20-00-00-000Z",
    metadata: { signed: "sig=a=b", timer: "daily" },
    notes: null,
    provider: "restic",
    startedAt: "2026-06-12T20:00:00.000Z",
    status: "running",
  })
  assert.equal((requests[1].body as { status: string }).status, "succeeded")
  assert.equal(((requests[1].body as { metadata: Record<string, unknown> }).metadata).exitCode, 0)
})

test("operations digest worker sends safe dry-run payloads", async () => {
  const { fetchImpl, requests } = createJsonFetch(() => ({ dryRun: true, processed: 2 }))

  await runOperationsWorker(["digest", "--dry-run", "--max-users", "25", "--include-read"], {
    env: workerEnv,
    fetch: fetchImpl,
    log: () => {},
  })

  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, "https://cofoundry.example.com/api/operations/notification-digests/run")
  assert.deepEqual(requests[0].body, {
    dryRun: true,
    maxUsers: 25,
    onlyWithUnread: false,
  })
})

test("operations lifecycle notification worker sends event-specific payloads", async () => {
  const { fetchImpl, requests } = createJsonFetch(() => ({ delivered: false, eventType: "proposal.updated", mode: "mock" }))

  await runOperationsWorker([
    "lifecycle-notification",
    "--dry-run",
    "--event-type",
    "proposal.updated",
    "--target-type",
    "proposal",
    "--target-id",
    "proposal_ledgerloop_cto",
    "--user-id",
    "user_malik",
    "--metadata",
    "source=test",
  ], {
    env: workerEnv,
    fetch: fetchImpl,
    log: () => {},
  })

  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, "https://cofoundry.example.com/api/operations/notifications/lifecycle")
  assert.deepEqual(requests[0].body, {
    dryRun: true,
    eventType: "proposal.updated",
    metadata: { source: "test" },
    targetId: "proposal_ledgerloop_cto",
    targetType: "proposal",
    userId: "user_malik",
  })
})

test("operations scanner downloads local app URLs with worker auth and blocks flagged files", async () => {
  const commands: string[] = []
  const { fetchImpl, requests } = createJsonFetch((request) => {
    if (request.url.endsWith("/api/operations/file-scans/pending?limit=5")) {
      return {
        mode: "mock",
        pendingScans: [{
          id: "upload_1",
          originalFilename: "evidence.txt",
          signedDownloadUrl: "https://cofoundry.example.com/api/operations/file-scans/upload_1/download",
        }],
      }
    }

    if (request.url.endsWith("/api/operations/file-scans/upload_1/download")) {
      return new Response(Buffer.from("unsafe"), {
        status: 200,
      })
    }

    return { ok: true }
  })

  await runOperationsWorker(["scan", "--limit", "5", "--scanner-command", "scanner --path {file} --id {id}"], {
    env: workerEnv,
    fetch: fetchImpl,
    log: () => {},
    runShellCommand: async (command) => {
      commands.push(command)
      return 1
    },
  })

  const download = requests.find(request => request.url.endsWith("/download"))
  const scanResult = requests.find(request => request.url.endsWith("/api/operations/file-scans/upload_1") && request.method === "POST")
  const completionEvent = requests.find(request => request.url.endsWith("/api/operations/events"))

  assert.equal(download?.headers.get("authorization"), "Bearer test-worker-token")
  assert.match(commands[0], /^scanner --path '.+' --id 'upload_1'$/)
  assert.deepEqual(scanResult?.body, {
    notes: "Scanner command flagged this upload.",
    scanStatus: "flagged",
    status: "blocked",
  })
  assert.equal((completionEvent?.body as { severity: string }).severity, "warning")
})

test("operations restore drill worker reports start and success events", async () => {
  const { fetchImpl, requests } = createJsonFetch()

  await runOperationsWorker(["restore-drill", "--id", "restore-2026-06", "--metadata", "scope=mock-store", "--", "npm run smoke"], {
    env: workerEnv,
    fetch: fetchImpl,
    log: () => {},
    runShellCommand: async () => 0,
  })

  assert.equal(requests.length, 2)
  assert.equal((requests[0].body as { eventType: string }).eventType, "restore_drill_started")
  assert.equal((requests[1].body as { eventType: string }).eventType, "restore_drill_succeeded")
  assert.deepEqual((requests[1].body as { metadata: Record<string, unknown> }).metadata, {
    command: "npm run smoke",
    exitCode: 0,
    scope: "mock-store",
  })
})

test("shellQuote escapes single quotes for scanner command placeholders", () => {
  assert.equal(shellQuote("scan Bob's file.txt"), "'scan Bob'\\''s file.txt'")
})
