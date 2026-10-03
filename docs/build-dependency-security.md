# Guarded build dependencies

This repository adopts the reviewed `v2.1.4` Vitesse Nuxt template fixes for two unpatched build-tool advisories. Root npm overrides resolve every transitive `listhen` and `braces` instance to local, MIT-licensed forks under `vendor/`.

- `vendor/listhen` replaces `node-forge` with `selfsigned` for the development listener's temporary TLS certificate while preserving HTTP, PEM, PFX, ESM, CommonJS and CLI behavior. This removes the vulnerable dependency chain for [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv).
- `vendor/braces` rejects excessive structural nesting in parser and recursive AST walkers without disabling ordinary brace patterns. This addresses [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

The root `test:unit` command verifies both compatibility boundaries and lockfile resolution. Keep these forks until upstream publishes reviewed fixes that pass the same tests and full and production dependency audits. This change does not alter CoFoundry's runtime auth, billing, environment, or host promotion contracts.
