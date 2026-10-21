# Editorial review, 2026-10-20

Initially reviewed the main checkout at `e22aaf9bedc949534bdba1cb56f7d5d4f9287a91` under the physical Storage path as a local-only change set. The 2026-10-21 delivery follow-up below records the later source-delivery authorization and validation. No production action was performed.

## Changes

55 application files and one existing browser-test file were changed. The edits remove unnecessary text rather than adding replacement explanations:

- Removed the homepage's static sample deal, repeated process section, and closing promotional panel. Kept the main heading, a factual feature summary, and access/navigation links.
- Removed the authentication layout's promotional panel. Each form now supplies its own primary heading inside a main landmark.
- Removed directory commentary about how hubs work, repeated category labels, duplicated privacy explanations, generic introductions, and obvious form instructions.
- Removed repeated workspace descriptions, sidebar promotion, dashboard coaching, and generic onboarding tips. Kept current records, counts, missing requirements, and actionable controls.
- Removed visible implementation commentary such as “Enforcement in the MVP,” references to an administrative request queue in member confirmations, and notes about future product nudges.
- Reduced interaction feedback to the result and any consequential next requirement.
- Added the missing accessible name to the shared workspace refresh button after the mobile accessibility check identified it.
- Updated existing browser assertions that depended on removed slogans to check headings and usable access/navigation links.

## Retained content and no-change findings

Public profile and startup data, proof-of-work content, pricing amounts and feature allowances, agreement and proposal terms, and the substantive founder guides were retained. Terms of Service and Privacy Policy source content was not changed by the editorial patch. Counsel identity/authority limitations, legal-advice disclosures, signature and version consequences, investment-sharing consent, required password/input formats, validation errors, and contact-visibility restrictions remain.

“Prototype” and “MVP” remain where they identify a startup's actual stage. Those values are data, unlike the removed description of CoFoundry itself as an MVP.

The pre-existing edits to `AGENTS.md` and `GEMINI.md` were preserved. The separate security-retention and CI-artifact worktrees were inspected for overlapping ownership and left untouched.

## Verification

Used the repository's Node 24.18.1 and npm 12.0.2 toolchain.

- Native frontend/backend lint passed. Two homepage whitespace warnings were corrected; subsequent checks of the final edited files were clean.
- Frontend/backend type checking passed.
- Regression tests passed: 454 frontend tests, 74 backend tests, and six compatibility tests.
- The final production build passed for both workspaces, including the built-output secret-boundary check. It used synthetic, process-scoped local values. No environment file or credential store was changed.
- All three existing Playwright browser tests passed against the built application.
- The repository's production accessibility sweep passed on 14 public routes in both light and dark schemes, for 28 successful scans.
- Additional Playwright checks covered 22 public routes, 14 member routes, and five administrative routes at 1280px and 390px widths. Of the 82 unique route/viewport checks, 80 had no automated WCAG A/AA violations. The two exceptions are the unchanged readiness command blocks described below. Public routes had one primary heading each and no horizontal overflow. No uncaught page errors were observed.
- Screenshots were inspected for the homepage, mobile sign-in, mobile discovery, and administrative analytics. The final analytics wording was checked again after its last deletions.
- Git whitespace checks passed. No package manifest, lockfile, API contract, permission, or safety-gate change was made.

The optional fast preflight wrapper declined to run because its installed engine version differed from its audited version. Native repository lint supplied the actual lint result.

## Rendering and accessibility limitations

These findings were recorded without expanding the editorial patch into routing or layout repair:

1. `/app/profile/edit` renders the read-only profile screen. The unchanged parent `profile.vue` has no child-route outlet. The editor's source was checked, but its form could not be visually reviewed through that route.
2. `/app/relationships/match_olivia_malik` has horizontal overflow at 390px. The relationship layout was not changed by this review.
3. `/admin/readiness` has non-focusable scrollable command blocks at desktop and mobile widths, reported by axe as `scrollable-region-focusable`. It also has horizontal overflow at 390px. The command-block markup is unchanged from the baseline.

Local diagnostic logs, browser scripts, and screenshots are retained in `.ai-work/runs/20261020-editorial-review/`, with an entry in the local work index. Browser checks used repository sample accounts and isolated local data. External resources were intercepted for the expanded browser sweep; an initial homepage probe had already produced two rejected analytics requests before that interception was installed. No analytics implementation change was made because a separate worktree owns that area.

## Delivery follow-up, 2026-10-21

Jacob subsequently authorized committing and pushing completed editorial work in the Consolidated: Sites chat. His direct instruction was verified in that chat before proceeding. The checkout was fast-forwarded to `09f5b57d036046e10e54da8e0fc788282a33ad67`, preserving its separate analytics correction. No editorial source edits were needed during this delivery follow-up. The unrelated `AGENTS.md` and `GEMINI.md` edits and both isolated worktrees remain outside this patch.

Fresh validation used Node 24.18.1 and npm 12.0.2 after a successful clean locked install:

- Frontend/backend lint and type checking passed.
- 455 frontend, 74 backend, and six compatibility tests passed, for 535 regression tests. All 23 runtime-artifact, protected-path, and control-bundle unit tests passed.
- The production build and built-output secret-boundary check passed using synthetic process-scoped settings.
- Deployment identity, shared shims, analytics output, toolchain, and dependency install-script policy checks passed.
- Production smoke checks, all three existing Playwright browser tests, and the public crawl across 59 sitemap routes and 90 internal links passed.
- The production accessibility sweep passed on all 14 configured routes in both color schemes, for 28 scans. The broader rendering limitations recorded above remain outside this editorial patch.
- GitGuardian scanned all 56 application/test files and found no secrets. Independent Gitleaks scanning of the editorial diff also found no secrets.

The full local release gate stopped at dependency audit after the clean install. The unchanged lockfile has 33 workspace audit findings: 22 moderate, four high, and seven critical. The production-only workspace audit reports three findings, through `source-map-js`, `unplugin`, and `vite`. The separately run application checks above do not make that release gate pass.

No deployment-ready tag or release is authorized by these results. Dependency remediation and a clean release-gate rerun remain necessary. Exact packaged runtime acceptance also requires Linux ARM64; this checkout runs on Darwin ARM64, and the tagged artifact-release workflow remains an unintegrated draft in its separately owned worktree. No production access, permission change, artifact substitution, or relaxed gate was used.

Delivery validation evidence is retained in `.ai-work/runs/20261021-editorial-delivery/`. Source commit and remote publication identity are reported separately after Git confirms them.

## Changed files

Application and existing test files, relative to the repository root:

```text
front-end/e2e/marketing.spec.ts
front-end/shared/data/marketing.ts
front-end/src/components/app/ActivationCockpit.vue
front-end/src/components/app/AppSidebar.vue
front-end/src/components/app/AppTopbar.vue
front-end/src/components/app/ConnectRequestInbox.vue
front-end/src/components/app/FirstCallAgenda.vue
front-end/src/components/app/MinimumOnboardingForm.vue
front-end/src/components/app/ProfileEditorForm.vue
front-end/src/components/marketing/SiteFooter.vue
front-end/src/components/proposals/ProposalEditorForm.vue
front-end/src/layouts/admin.vue
front-end/src/layouts/auth.vue
front-end/src/pages/[...all].vue
front-end/src/pages/admin/access-requests.vue
front-end/src/pages/admin/analytics.vue
front-end/src/pages/admin/operations.vue
front-end/src/pages/admin/queue.vue
front-end/src/pages/admin/readiness.vue
front-end/src/pages/app/activation.vue
front-end/src/pages/app/billing.vue
front-end/src/pages/app/discover.vue
front-end/src/pages/app/inbox.vue
front-end/src/pages/app/index.vue
front-end/src/pages/app/matches.vue
front-end/src/pages/app/messages/index.vue
front-end/src/pages/app/opportunities/index.vue
front-end/src/pages/app/profile/edit.vue
front-end/src/pages/app/proposals/[id].vue
front-end/src/pages/app/proposals/index.vue
front-end/src/pages/app/relationships/[id].vue
front-end/src/pages/app/settings.vue
front-end/src/pages/app/studio/index.vue
front-end/src/pages/auth/recover.vue
front-end/src/pages/auth/sign-in.vue
front-end/src/pages/auth/sign-up.vue
front-end/src/pages/contact.vue
front-end/src/pages/contracts/index.vue
front-end/src/pages/email/preferences.vue
front-end/src/pages/faq.vue
front-end/src/pages/find-cofounder.vue
front-end/src/pages/how-it-works.vue
front-end/src/pages/index.vue
front-end/src/pages/industries/[slug].vue
front-end/src/pages/industries/index.vue
front-end/src/pages/onboarding.vue
front-end/src/pages/people/[slug].vue
front-end/src/pages/people/index.vue
front-end/src/pages/pricing.vue
front-end/src/pages/roles/[slug].vue
front-end/src/pages/roles/index.vue
front-end/src/pages/safety.vue
front-end/src/pages/stage/[slug].vue
front-end/src/pages/stage/index.vue
front-end/src/pages/startups/index.vue
front-end/src/pages/trust/index.vue
```

This report is the additional documentation file. The two pre-existing instruction-file edits are not part of the editorial change set.
