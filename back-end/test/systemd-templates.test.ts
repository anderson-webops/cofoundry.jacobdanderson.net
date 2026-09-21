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

test("application service uses a hardened direct Node loopback runtime", async () => {
  const service = await readSystemdTemplate("cofoundry-app.service")
  const envExample = await readSystemdTemplate("cofoundry-app.env.example")
  const nginxProxy = await readRepoFile("deploy", "nginx", "cofoundry-proxy.conf.example")

  assert.match(service, /User=cofoundry/)
  assert.match(service, /Group=cofoundry/)
  assert.match(service, /Environment=NITRO_HOST=127\.0\.0\.1/)
  assert.match(service, /Environment=NITRO_PORT=3000/)
  assert.match(service, /Environment=NITRO_SHUTDOWN_TIMEOUT=25000/)
  assert.match(service, /Environment=NODE_OPTIONS=--max-old-space-size=192/)
  assert.match(service, /ExecStart=\/opt\/node-24\.18\.1\/bin\/node front-end\/\.output\/server\/index\.mjs/)
  assert.match(service, /MemoryHigh=320M/)
  assert.match(service, /MemoryMax=384M/)
  assert.match(service, /NoNewPrivileges=true/)
  assert.match(service, /ProtectSystem=strict/)
  assert.match(service, /ReadWritePaths=\/var\/lib\/cofoundry \/run\/cofoundry/)
  assert.match(service, /TasksMax=64/)
  assert.doesNotMatch(service, /npm|docker|podman/i)
  assert.match(envExample, /NUXT_PUBLIC_BACKEND_MODE=mock/)
  assert.match(envExample, /COFOUNDRY_EXPECT_MULTI_INSTANCE=false/)
  assert.match(envExample, /COFOUNDRY_APP_INSTANCE_COUNT=1/)
  assert.match(nginxProxy, /proxy_pass http:\/\/127\.0\.0\.1:3000/)
  assert.match(nginxProxy, /IPv4 and IPv6/)
})

test("application installer and promoter require trusted artifacts and atomic rollback", async () => {
  const installer = await readSystemdTemplate("install-app-unit.sh")
  const promoter = await readSystemdTemplate("promote-release.sh")

  assert.match(installer, /--dry-run/)
  assert.match(installer, /--force-env/)
  assert.match(installer, /--bundle/)
  assert.match(installer, /--sha256/)
  assert.match(installer, /host-control-bundle\.py/)
  assert.match(installer, /control-bundle\.tar\.gz/)
  assert.match(installer, /bundles\/\$bundle_sha/)
  assert.match(installer, /current_dest/)
  assert.match(installer, /systemctl_bin.*daemon-reload/)
  assert.match(installer, /\/usr\/local\/libexec\/cofoundry/)
  assert.match(installer, /install -o root -g root/)
  assert.match(installer, /runtime-artifact\.py/)
  assert.match(installer, /trusted-paths\.py/)
  assert.match(installer, /runtime-artifact\.json/)
  assert.doesNotMatch(installer, /"\$script_dir\/[^"\n]+"/)
  assert.doesNotMatch(installer, /run systemctl enable/)
  assert.match(promoter, /mv -Tf/)
  assert.match(promoter, /\/api\/health/)
  assert.match(promoter, /\/healthz/)
  assert.match(promoter, /\/readyz/)
  assert.match(promoter, /previous_target/)
  assert.match(promoter, /ROLLBACK_ARCHIVE/)
  assert.match(promoter, /ROLLBACK_SHA256/)
  assert.match(promoter, /ROLLBACK_COMMIT/)
  assert.match(promoter, /runtime-artifact\.py.*verify/s)
  assert.match(promoter, /trusted-paths\.py/)
  assert.match(promoter, /flock -n/)
  assert.match(promoter, /trap 'exit 143' TERM/)
  assert.match(promoter, /verify_rollback/)
  assert.match(promoter, /"candidate"/)
  assert.match(promoter, /"rollback"/)
  assert.match(promoter, /"archiveSha256"/)
  assert.match(promoter, /rollback_failed/)
  assert.match(promoter, /systemctl restart/)
  assert.doesNotMatch(promoter, /rm -rf|docker|podman/i)
})

test("systemd templates use canonical operations worker scripts", async () => {
  const heartbeat = await readSystemdTemplate("cofoundry-operations-heartbeat.service")
  const alertSmoke = await readSystemdTemplate("cofoundry-operations-alert-smoke.service")
  const mailSmoke = await readSystemdTemplate("cofoundry-operations-mail-smoke.service")
  const realtimeSmoke = await readSystemdTemplate("cofoundry-operations-realtime-smoke.service")

  assert.match(heartbeat, /\/opt\/node-24\.18\.1\/bin\/node back-end\/dist\/operations-worker\.js heartbeat --metadata schedule=hourly/)
  assert.doesNotMatch(heartbeat, /bash|-lc|shell/)
  assert.doesNotMatch(heartbeat, /operations_heartbeat/)
  assert.match(alertSmoke, /operations-worker\.js alert-smoke --metadata runbook=systemd-manual/)
  assert.match(mailSmoke, /operations-worker\.js mail-smoke --metadata runbook=systemd-manual/)
  assert.match(realtimeSmoke, /operations-worker\.js realtime-smoke --metadata runbook=systemd-manual/)
})

test("attacker-facing scan worker has bounded heap, memory, and tasks", async () => {
  const scanner = await readSystemdTemplate("cofoundry-operations-scan.service")

  assert.match(scanner, /Environment=NODE_OPTIONS=--max-old-space-size=192/)
  assert.match(scanner, /MemoryHigh=320M/)
  assert.match(scanner, /MemoryMax=384M/)
  assert.match(scanner, /TasksMax=64/)

  const heapMiB = Number(scanner.match(/max-old-space-size=(\d+)/)?.[1])
  const memoryHighMiB = Number(scanner.match(/MemoryHigh=(\d+)M/)?.[1])
  const memoryMaxMiB = Number(scanner.match(/MemoryMax=(\d+)M/)?.[1])
  const tasksMax = Number(scanner.match(/TasksMax=(\d+)/)?.[1])
  assert.ok(heapMiB > 0 && heapMiB < memoryHighMiB)
  assert.ok(memoryHighMiB < memoryMaxMiB)
  assert.ok(tasksMax > 0 && tasksMax <= 64)
})

test("every operations service runs without a shell and enables the host sandbox", async () => {
  const serviceNames = [
    "cofoundry-operations-alert-smoke.service",
    "cofoundry-operations-backup.service",
    "cofoundry-operations-digest.service",
    "cofoundry-operations-heartbeat.service",
    "cofoundry-operations-mail-smoke.service",
    "cofoundry-operations-realtime-smoke.service",
    "cofoundry-operations-restore-drill.service",
    "cofoundry-operations-scan.service",
  ]

  for (const serviceName of serviceNames) {
    const service = await readSystemdTemplate(serviceName)
    assert.doesNotMatch(service, /ExecStart=.*(?:bash|sh -c|-lc)/)
    assert.match(service, /NoNewPrivileges=true/)
    assert.match(service, /ProtectSystem=strict/)
    assert.match(service, /ProtectHome=true/)
    assert.match(service, /CapabilityBoundingSet=\n/)
    assert.match(service, /Environment=PATH=\/opt\/node-24\.18\.1\/bin:\/usr\/local\/sbin:\/usr\/local\/bin:\/usr\/sbin:\/usr\/bin/)
    assert.match(service, /ExecStart=\/opt\/node-24\.18\.1\/bin\/node back-end\/dist\/operations-worker\.js/)
    assert.doesNotMatch(service, /npm|tsx/i)
    assert.match(service, /PrivateMounts=true/)
    assert.match(service, /ProcSubset=pid/)
    assert.match(service, /ProtectProc=invisible/)
    assert.match(service, /RemoveIPC=true/)
    assert.match(service, /RestrictNamespaces=true/)
    assert.match(service, /TimeoutStartSec=1h/)
    assert.match(service, /UMask=0077/)

    if (serviceName.includes("backup") || serviceName.includes("restore-drill"))
      assert.match(service, /ReadWritePaths=.*\/var\/backups\/cofoundry/)
    else
      assert.doesNotMatch(service, /ReadWritePaths=.*\/var\/backups\/cofoundry/)
  }
})

test("systemd README documents manual smoke service verification", async () => {
  const readme = await readSystemdTemplate("README.md")

  assert.match(readme, /install-operations-units\.sh --dry-run/)
  assert.match(readme, /--enable-restore-drill/)
  assert.match(readme, /systemctl start cofoundry-operations-alert-smoke\.service/)
  assert.match(readme, /systemctl start cofoundry-operations-mail-smoke\.service/)
  assert.doesNotMatch(readme, /systemctl start cofoundry-operations-realtime-smoke\.service/)
  assert.match(readme, /COFOUNDRY_ALERT_WEBHOOK_URL/)
  assert.match(readme, /COFOUNDRY_MAIL_SMOKE_TO_EMAIL/)
  assert.match(readme, /shared atomic rate limiter/)
})

test("server operations handoff prompt enforces the single-process security boundary", async () => {
  const prompt = await readRepoFile("docs", "server-ai-operations-prompt.md")

  assert.match(prompt, /COFOUNDRY_COMMIT_SHA/)
  assert.match(prompt, /Nuxt build fallback/)
  assert.match(prompt, /COFOUNDRY_EXPECT_MULTI_INSTANCE=false/)
  assert.match(prompt, /COFOUNDRY_APP_INSTANCE_COUNT=1/)
  assert.match(prompt, /shared atomic limiter/)
  assert.doesNotMatch(prompt, /systemctl start cofoundry-operations-realtime-smoke\.service/)
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
  assert.match(installer, /PATH=\/usr\/sbin:\/usr\/bin:\/sbin:\/bin/)
})
