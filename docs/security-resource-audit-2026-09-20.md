# CoFoundry security and resource audit, 2026-09-20

## Disposition

The `v1.2.1` source candidate resolves the confirmed dependency, memory-growth, shutdown, and release-integrity issues found in this audit. No production deployment is implied by this report. The immutable runtime artifact must still pass `npm run package:runtime -- .ai-work/runs/<empty-run>` on clean Linux ARM64 before activation.

## Remediated findings

- Updated the affected dependency graph to patched `devalue`, `fast-uri`, `js-yaml`, `svgo`, and Vitest releases. The root lock retains exact GNU Linux ARM64 optional bindings for both Rolldown and `oxc-parser`; `.npmrc` requires optional packages and the toolchain check now prevents those lock entries from drifting away from their loaders.
- Replaced the unbounded in-process rate-limit map with a 2,048-identity bounded store and at most 128 overflow scopes. Excess identities share a strict scope bucket and fail closed after its allowance, instead of allocating attacker-controlled entries indefinitely. Long key material is hashed before storage.
- Removed duplicate process-lifetime account and session maps. Local authentication and member state now use their existing durable, authoritative stores rather than retaining a second copy for every account.
- Added backend draining readiness, a 256-connection ceiling, one shared graceful-shutdown promise, idle-connection closure, and a 10-second forced-connection fallback. `/healthz` remains available while `/readyz` returns 503 during drain.
- Production services now execute compiled JavaScript directly with the pinned Node 24.18.1 runtime. The public service uses a measured 192 MiB V8 heap ceiling, systemd soft/hard memory boundaries of 320/384 MiB, and a 64-task ceiling. Operations jobs no longer start npm or a TypeScript runtime.
- Applied the same measured heap, memory, and task ceilings to the attacker-facing scan worker. Source tests require the heap ceiling to remain below `MemoryHigh`, `MemoryHigh` below `MemoryMax`, and `TasksMax` at or below 64; real cgroup allocation and fork enforcement remains part of target-host acceptance.
- Replaced entrypoint-only promotion with a source-bound runtime contract. The packager records every file hash and required path, copies only the root-lock-backed backend production closure, rejects private or writable state, links, hard links, unexpected executables, development tools, unreviewed native bindings, and generated frontend dependency drift, and tests the unpacked artifact in a network-isolated sandbox without source or development dependencies.
- Replaced privileged copies from the mutable checkout with a separate commit-bound host-control archive. The installer copies that archive once into root-only staging, verifies its reviewed digest and exact file manifest, installs a versioned root-owned bundle, and atomically switches one control activation symlink while retaining prior bundles.
- Promotion now requires an independently retained archive digest and exact commit, verifies protected ownership and modes, serializes mutations, checks exact identity plus health/readiness, and revalidates the retained rollback archive both before promotion and before restoration. A failed rollback preserves both candidate and rollback archive paths, SHA-256 values, commits, targets, timestamps, and state in a root-only JSON record. Interruption, failed readiness, lock contention, tampering, first deployment, immutable control installation, and rollback failure have a Linux isolation test matrix.

## Resource evidence

Matched local macOS ARM64 measurements used the same built route mix and 1,000 requests at concurrency 20 for three baseline and three candidate runs. The median idle RSS changed from 146.84 MiB to 137.38 MiB. The median peak changed from 263.22 MiB to 247.97 MiB with the production heap setting. Candidate p95 latency was 43.82 to 45.87 ms, and graceful shutdown completed in 12.21 to 13.80 ms.

A separate 25,000-identity rate-limit flood retained 381.97 MiB RSS on the old implementation. The bounded candidate retained 273.91 MiB and returned 429 for 22,712 excess requests, about 108 MiB less retained memory while failing closed. These are comparative development-host measurements, not production capacity guarantees.

## Verification

The exact Node 24.18.1/npm 12.0.2 local release gate passed from a clean locked install:

- full and production dependency audits: zero vulnerabilities
- registry provenance: 1,047 verified signatures and 413 verified attestations
- reviewed dependency install scripts and standalone workspace install contracts
- lint and frontend/backend type checks
- 433 frontend tests and 74 backend tests
- 23 runtime-artifact, host-control-bundle, and protected-path tests
- production frontend/backend build with build-secret boundary verification
- deployment identity, shared-shim, analytics, production smoke, 59-route public crawl, and light/dark accessibility checks

The build emitted only upstream plugin-timing and unused-import notices. They do not indicate a failed check or a runtime security defect.

An independent Daybreak security pass found the mutable privileged-control copy, scan-worker resource ceiling, and incomplete rollback-evidence issues described above. After those corrections, it reported no additional actionable issue in the dependency lock, archive hardening, network isolation, bounded rate limiting, authentication consolidation, readiness/shutdown behavior, or native binding entries.

## Release and host boundary

The Linux ARM64 artifact gate is intentionally separate from the macOS source gate because it executes the target native bindings and the Bubblewrap-isolated promotion recovery matrix. Do not activate a release, edit an existing release tree, copy host secrets into an artifact, or bypass this gate. Preserve the existing service user, `/srv/cofoundry` paths, loopback port 3000, environment files, writable state, Nginx policy, certificates, and IPv4/IPv6 listeners.
