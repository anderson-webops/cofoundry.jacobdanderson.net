# Native Mac artifact transport

This application uses the shared analytics Ed25519 transport format with its own
native runtime contract. The canonical native codec is maintained in Scheduler;
the mirrored codec and regression suite are byte-identical across these three
applications. Existing analytics enrollment is independent of these native profiles.

`deploy/mac-artifact-profile.json` declares application `cofoundry.jacobdanderson.net`, builder
`jacob-m3`, Linux ARM64/glibc, Node 24.18.1 and build-only npm 12.0.2.
No public build-environment overrides are declared. Credentials, protected runtime
configuration and mutable state remain external. A profile does not enroll a key,
install an adapter, authorize activation or establish rollback acceptance.

The common stable annotated release has exactly these six assets:

- `cofoundry.jacobdanderson.net-<tag>-linux-arm64-runtime.tar.gz`
- `anderson-runtime-manifest.json`
- `anderson-runtime-manifest.sig`
- `public-build-configuration.json`
- `acceptance-receipt.json`
- `SHA256SUMS`

The detached signature is 64 raw Ed25519 bytes over the exact UTF-8 manifest,
including whitespace and its trailing newline. The existing public key's
SubjectPublicKeyInfo DER SHA-256 is
`9312fb21bf79162b8bf481d22190fe8e7352be8d80ceae99ad435faa1249f316`.
This identifies a key, not authorization for an additional application.

The schema-1 envelope binds the exact repository/site, builder, clean source
commit, matching version/tag, application runtime, archive size/hash, public
configuration hash, native-contract hash, four acceptance checks and complete
`runtime/` inventory. The independent native `runtime-manifest.json` stays inside
the archive unchanged. Files retain 0644 and directories 0755; these applications'
native contracts reject links. Native objects must be declared ELF64 AArch64.
`SHA256SUMS` binds the other five assets. The receipt is exactly
`{commit, tag, checks}`, with true `tests`, `dependency_audit`,
`package_signatures` and `native_bindings` results from actual acceptance.

`scripts/native-artifact-transport.mjs prepare` takes explicit `--runtime`,
`--output`, `--profile`, `--contract`, `--commit`, `--tag` and `--receipt`.
It creates four unsigned assets in a new directory. `verify` takes `--output`,
`--profile`, `--contract` and, for a complete signed release, `--public-key`.
It checks inventory, embedded identity, native architecture, exact asset names,
signature and checksums without executing candidate application code.

The codec has no private-key or publication interface. A separately trusted
Mac-side boundary must verify clean main/annotated tag identity, independently
accepted bytes and the exact approved application scope before signing/publishing.
It must keep repository-controlled build/test code outside credential authority.
Candidate receipts and synthetic signature tests are not production acceptance.

Regression command: `node --test scripts/native-artifact-transport.test.mjs`.
Publication, scoped host intake, application/runtime acceptance, genuine retained
runtime/data recovery and public activation remain independently verified outcomes.
