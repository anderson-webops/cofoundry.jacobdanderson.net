# Dependency acceptance

The maintained Node 26.13.1 and npm 12.2.2 build profile is shared with the
Vitesse template. Its source inputs and four selection/verification helpers are
byte-identical. The independent locked profile verifies its package graph and
payload before use, retains the three-profile cache bound, and stays outside
production artifacts. `npm run verify:build-toolchain` binds that accepted
profile to this application's build contract. CI uses fresh runner-local
download caches and retains immutable artifact verification before publication.

The root and frontend retain TypeScript 6.0.3 because Vue's current declaration
checker imports its compiler API and typescript-eslint requires that API line.
The backend uses TypeScript 7.0.2. The existing compatibility regression checks
the actual compiler executable and this supported split.

The direct frontend H3 dependency is 2.0.8. Nuxt 4.6.4 and Nitro 2.13.6 retain
their supported H3 1.15.11 dependency graph. Both complete source checks and
compiled application/artifact checks are required; a dependency declaration
alone establishes neither runtime compatibility nor production adoption.

The exact maintained Picomatch repair, signed-source Unimport compiler and
explicit-import analyzer are identified in `vendor/maintained-providers.json`.
Provider checks compare every installed consumer against its accepted archive.
The parser retains bounded hostile-input regressions and ordinary matching.
The strict import check covers client imports, components and server helpers.

Braces and Listhen use the same reviewed standalone archives as the template.
Deepmerge 4.3.2 adds CoFoundry's existing stricter policy: omit own `__proto__`
keys before accessing values or invoking hooks. Its CJS and browser packages
reproduce the reviewed shared archive plus that exact key filter. Original
source, licenses and both provenance records remain preserved. Every dependency
stays inside the locked application graph; linked local library projects can
otherwise retain unpatched nested providers. All six maintained providers
require exact archive and installed-consumer verification.

Nuxt's selected Vite DevTools host and kit use the same reviewed 0.8.3 release.
The Vue plugin retains its independently supported 0.7 peer graph. The existing
real-host fixture exercises initialization, injected modules and exact dock UI
bytes; mismatched pairs and unreviewed versions remain rejected. Glob 14.0.6
and Minimatch 11.0.9 advance the existing supported override line. The unused
Tab override is removed because the current dependency graph has no consumer.

Required qualification includes clean locked installation, full and production
audits, registry signatures, lint, types, source/browser/accessibility checks,
and native runtime, missing-module, promotion and retained-recovery acceptance.
Published source delivery and protected production activation retain separate
evidence and approval requirements.
