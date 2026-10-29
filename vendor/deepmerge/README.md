# Guarded deepmerge

This local package preserves the MIT-licensed `deepmerge@4.3.1` API and
filters `__proto__` from both source and target key enumeration before
property access or assignment. It addresses the returned-object prototype
poisoning described in
[GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).

The root override routes the Nuxt build dependency to this guarded package.
Replace it with an upstream patched release only after the security regressions,
clean-install and full audit gates pass.
