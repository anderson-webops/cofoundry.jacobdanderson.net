# Dependency compatibility

The npm workspace lock is authoritative. The frontend and Nuxt DevTools 4 use
the matching Vite DevTools 0.8.2 host and kit. The current Unhead bundler and
registry Vue DevTools 9.0.0-rc.2 plugin require the separate 0.7 API line. Root
tooling anchors that plugin and its supported kit so ordinary npm resolution
preserves those consumers without rebinding them to the newer host API.

This uses ordinary dependency resolution, without forced peer ranges or an
ignored peer check. `npm ls --all` and `scripts/test-transitive-compat.mjs`
verify the installed graph and separate resolution paths. The reviewed template
provider fixtures additionally verify the registry plugin's metadata and all
38 payload hashes, then initialize its actual dock, HMR injection and client
assets inside a loopback-only Vite 0.8 host. Review the bridge dependencies when
these consumers support the same API line.

Both application workspaces use Supabase JS 2.119.0. The generic template's
vendored `qs` parser is not installed in this application's graph; adding its
unrelated Express backend would replace CoFoundry's existing operations service.

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
