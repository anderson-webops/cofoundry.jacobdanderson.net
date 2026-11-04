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
