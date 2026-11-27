# Maintained auto-import providers

The exact archives in `vendor/maintained-providers.json` are adopted from
`anderson-webops/vitesse-nuxt-template` v2.1.41. Its source, independent build
locks, reproducible compiler, original upstream tests and native application
acceptance remain available at that immutable producer release.

Unimport 7.0.3+webops.2 preserves the supported Nuxt and explicit-import module
contracts. The original signed tag, commit, public signer and complete 226-file
source tree are retained here and verified independently. The archive contains
the derivative's source-patch and build-input identities. The original registry
reference and this independently built distribution have separate provenance.

The explicit-import module preserves its original CLI and all other original
implementation files, with a reviewed analyzer repair for declared type-only
and value bindings in TypeScript type queries. Its parser uses Oxc 0.159.
CoFoundry enables strict mode and imports its own composables, components and
server helpers explicitly.

`npm run verify:maintained-providers` checks the signed source, independently
reproduces the Picomatch repair, and compares every installed application copy
of all three providers byte-for-byte with the accepted archives. Focused
Picomatch security and legitimate-behavior checks remain part of `test:unit`.
Full and production audits, registry signature checks and CoFoundry's complete
application, browser, native artifact and retained-recovery checks remain
separate required gates.
