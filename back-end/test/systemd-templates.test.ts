import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..")

async function readSystemdTemplate(filename: string) {
  return readFile(join(repoRoot, "deploy", "systemd", filename), "utf8")
}

async function readRepoFile(...segments: string[]) {
  return readFile(join(repoRoot, ...segments), "utf8")
}

test("systemd templates use canonical operations worker scripts", async () => {
  const heartbeat = await readSystemdTemplate("cofoundry-operations-heartbeat.service")
  const alertSmoke = await readSystemdTemplate("cofoundry-operations-alert-smoke.service")
  const mailSmoke = await readSystemdTemplate("cofoundry-operations-mail-smoke.service")
  const realtimeSmoke = await readSystemdTemplate("cofoundry-operations-realtime-smoke.service")

  assert.match(heartbeat, /npm run operations:heartbeat -- --metadata schedule=hourly/)
  assert.doesNotMatch(heartbeat, /operations_heartbeat/)
  assert.match(alertSmoke, /npm run operations:alert-smoke -- --metadata runbook=systemd-manual/)
  assert.match(mailSmoke, /npm run operations:mail-smoke -- --to-email/)
  assert.match(mailSmoke, /COFOUNDRY_MAIL_SMOKE_TO_EMAIL/)
  assert.match(realtimeSmoke, /npm run operations:realtime-smoke -- --user-id/)
  assert.match(realtimeSmoke, /COFOUNDRY_REALTIME_SMOKE_MIN_DELIVERED/)
})

test("systemd README documents manual smoke service verification", async () => {
  const readme = await readSystemdTemplate("README.md")

  assert.match(readme, /install-operations-units\.sh --dry-run/)
  assert.match(readme, /--enable-restore-drill/)
  assert.match(readme, /systemctl start cofoundry-operations-alert-smoke\.service/)
  assert.match(readme, /systemctl start cofoundry-operations-mail-smoke\.service/)
  assert.match(readme, /systemctl start cofoundry-operations-realtime-smoke\.service/)
  assert.match(readme, /COFOUNDRY_ALERT_WEBHOOK_URL/)
  assert.match(readme, /COFOUNDRY_MAIL_SMOKE_TO_EMAIL/)
  assert.match(readme, /COFOUNDRY_REALTIME_SMOKE_MIN_DELIVERED/)
})

test("server operations handoff prompt includes realtime smoke setup", async () => {
  const prompt = await readRepoFile("docs", "server-ai-operations-prompt.md")

  assert.match(prompt, /COFOUNDRY_COMMIT_SHA/)
  assert.match(prompt, /Nuxt build fallback/)
  assert.match(prompt, /npm run operations:realtime-smoke/)
  assert.match(prompt, /COFOUNDRY_REALTIME_SMOKE_USER_ID/)
  assert.match(prompt, /COFOUNDRY_REALTIME_SMOKE_MIN_DELIVERED=0/)
  assert.match(prompt, /systemctl start cofoundry-operations-realtime-smoke\.service/)
  assert.match(prompt, /realtime_fanout_smoke_succeeded/)
  assert.match(prompt, /realtime-smoke result/)
})

test("systemd installer defaults to safe timer installation", async () => {
  const installer = await readSystemdTemplate("install-operations-units.sh")

  assert.match(installer, /--dry-run/)
  assert.match(installer, /--no-enable/)
  assert.match(installer, /--force-env/)
  assert.match(installer, /--enable-restore-drill/)
  assert.match(installer, /systemctl daemon-reload/)
  assert.match(installer, /systemctl enable --now "\$\{timers\[@\]\}"/)
  assert.match(installer, /cofoundry-operations-heartbeat\.timer/)
  assert.match(installer, /cofoundry-operations-digest\.timer/)
  assert.match(installer, /cofoundry-operations-scan\.timer/)
  assert.match(installer, /cofoundry-operations-backup\.timer/)
  assert.match(installer, /include_restore_drill=false/)
  assert.match(installer, /cofoundry-operations-restore-drill\.timer/)
})
