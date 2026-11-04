# Dependency compatibility

The npm workspace lock is authoritative. Nuxt DevTools 4 uses Vite DevTools and
its kit on the 0.8 API line. The current Unhead bundler and Vue DevTools plugin
declare the 0.7 API line. The frontend declares compatible 0.7 packages so npm
can install DevTools 4's independent 0.8 dependencies rather than hoisting one
incompatible version over the other consumers.

This uses ordinary dependency resolution, without forced peer ranges or an
ignored peer check. `npm ls --all` and `scripts/test-transitive-compat.mjs`
verify the installed graph and separate resolution paths. Review the bridge
dependencies when these consumers support the same API line.

The same regression suite exercises the installed JS-YAML workspace reader,
the beautifier's glob integration and Markdown math rendering with untrusted
links. Local compatibility checks, advisory audits, registry signature checks
and native artifact acceptance remain distinct release requirements.

## Compiler boundaries

The backend uses TypeScript 7.0.2's compiler CLI. Both workspaces use Node 26
type declarations. The frontend and root tooling retain TypeScript 6's compiler
API for the current Vue checker.

An isolated `vue-tsc` 3.3.14 installation with TypeScript 7.0.2 fails before
checking source: `ERR_PACKAGE_PATH_NOT_EXPORTED` for `typescript/lib/tsc`.
TypeScript 7's exported API is not a drop-in replacement for that integration.
Frontend migration therefore requires a compatible maintained Vue checker;
forcing or widening its peer metadata does not supply the missing API.
The compatibility regression exercises the backend's actual versioned CLI and
the frontend's compiler API independently.

## Request-handler boundary

The current Nitro 2.13.6 application server declares H3 `^1.15.11`. Application
handlers retain that supported ABI, while development tooling can install H3 2
independently. Replacing the application's H3 major requires a compatible
framework migration; a global override would not provide that compatibility.
