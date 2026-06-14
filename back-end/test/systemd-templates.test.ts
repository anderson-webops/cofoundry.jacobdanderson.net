import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..")

async function readSystemdTemplate(filename: string) {
  return readFile(join(repoRoot, "deploy", "systemd", filename), "utf8")
}

test("systemd templates use canonical operations worker scripts", async () => {
  const heartbeat = await readSystemdTemplate("cofoundry-operations-heartbeat.service")
  const alertSmoke = await readSystemdTemplate("cofoundry-operations-alert-smoke.service")
  const mailSmoke = await readSystemdTemplate("cofoundry-operations-mail-smoke.service")

  assert.match(heartbeat, /npm run operations:heartbeat -- --metadata schedule=hourly/)
  assert.doesNotMatch(heartbeat, /operations_heartbeat/)
  assert.match(alertSmoke, /npm run operations:alert-smoke -- --metadata runbook=systemd-manual/)
  assert.match(mailSmoke, /npm run operations:mail-smoke -- --to-email/)
  assert.match(mailSmoke, /COFOUNDRY_MAIL_SMOKE_TO_EMAIL/)
})

test("systemd README documents manual smoke service verification", async () => {
  const readme = await readSystemdTemplate("README.md")

  assert.match(readme, /systemctl start cofoundry-operations-alert-smoke\.service/)
  assert.match(readme, /systemctl start cofoundry-operations-mail-smoke\.service/)
  assert.match(readme, /COFOUNDRY_ALERT_WEBHOOK_URL/)
  assert.match(readme, /COFOUNDRY_MAIL_SMOKE_TO_EMAIL/)
})
