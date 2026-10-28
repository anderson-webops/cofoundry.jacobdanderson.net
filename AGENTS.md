# Repository Guidelines

## Standing Dependency Completion Policy

Treat dependency remediation as part of completing authorized work on this
site, not as an optional follow-up. Proactively resolve vulnerabilities,
compatibility problems, broken installations and lockfile issues. Cover direct
and transitive dependencies, production and development dependencies,
workspaces and root-level tools. Do not dismiss findings because they are
pre-existing or development-only.

Before creating a release tag or publishing a release, require a clean locked
installation for every applicable dependency graph, zero known dependency
vulnerabilities in both full and production audits, and all applicable project
checks. An unavailable or incomplete audit is not a clean result. Use supported
upgrades, replacements or maintainable patches that preserve functionality.
Do not silence findings, weaken checks or force incompatible versions merely
to obtain a passing result.

Intermediate commits may capture coherent progress. Commit and push validated
work through this site's authorized delivery process, and complete meaningful
releases rather than stopping after reporting fixable dependency blockers.
Documentation-only housekeeping does not require an application release.

Preserve unrelated work, coordinate with other active chats, and retain existing
security, approval and production-access boundaries. Existing maintenance pauses
and repository exclusions remain in force; this policy does not expand access
or authorize otherwise excluded work. If a genuine blocker prevents completion,
preserve progress and report the exact blocker and remaining work. Distinguish
a published release from verified live deployment.

Treat this as a standing instruction for this site.

Shared Sites policy (`../AGENTS.md` when available) applies. These essentials also apply in standalone checkouts:
- Keep server-AI and operator prompts only in ignored `.ai-work/server-instructions/`; never commit, push, tag, release, or package them. Preserve local originals and index moves in `.ai-work/INDEX.md`; public application contracts may remain tracked.
- Never SSH, SCP, SFTP, tunnel to, or configure access to production. Do not deploy it; protected server-side automation owns activation, and source delivery alone does not prove deployment.
- GitGuardian quota, authentication, network, or service failure is not a commit/push blocker. Review outgoing changes, run another available local secret scan, preserve other hooks, and stop on real secret findings.
- Commit small, coherent, validated changes frequently as work progresses and push completed work through this repository's authorized source path, usually its default branch; use pull requests only when required.
- Group related changes into meaningful deployable milestones. Align version metadata, create a new immutable annotated semver tag, and publish its matching verified GitHub release with the required accepted artifacts.
- Complete finished deployable work through the published release consumed by protected deployment. Independently verify public release identity and acceptance read-only, or report the exact remaining blocker. Never move published tags or replace published release assets.

## Project Structure & Module Organization

- `front-end/` hosts the Nuxt application. Route screens live in `src/pages`, shared UI in `src/components`, state in
  `src/stores`, and reusable logic in `src/composables`, `src/shared`, and `server/`.
- `back-end/` contains the operational Node workspace for environment validation, Supabase-backed service logic, health
  endpoints, and seed/test utilities. Keep source in `src/`, seed scripts in `scripts/`, and Node test coverage in
  `test/`.
- Root configuration (`package.json`, `eslint.config.js`, TypeScript base config, and workspace scripts) governs both
  workspaces. Update root tooling when a change affects either side of the monorepo.

## Build, Test, and Development Commands

- `npm ci` at the repository root installs the committed workspace lockfile with the pinned npm toolchain. Do not mix package
  managers.
- `npm run dev` starts the Nuxt app; `npm run serve` exposes the same dev server on LAN; `npm run preview` runs the
  production preview build.
- `npm run server` starts the back-end watcher; `npm run server:once` runs the back-end without `tsx watch` and is the
  better choice for IDE run configurations.
- `npm run build` builds both workspaces. `npm run generate` builds the front-end static output when needed.
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:unit`, and `npm run test:e2e` should stay green
  before shipping. `npm run seed` seeds the operational back-end mode when local data setup is required.

## Coding Style & Naming Conventions

- Follow the existing ESLint and Nuxt conventions enforced by the root config and `front-end/eslint.config.js`. Run
  `npm run lint-fix` before pushing when you touch code.
- Use PascalCase for Vue component filenames, `useFeature` naming for composables, and descriptive store names under
  `front-end/src/stores`.
- Keep route files lowercase and descriptive. Put server-only utilities under `front-end/server/` or `back-end/src/`
  instead of leaking them into shared client code.
- Prefer adding feature-specific helpers close to the feature directory instead of growing large generic utility files.

## Testing Guidelines

- Front-end unit coverage lives under `front-end/test/` and uses Vitest. Keep new tests near the feature area they
  exercise.
- End-to-end coverage uses Playwright via `npm run -w front-end test:e2e`. Use that path for flows that need the built
  Nuxt app instead of isolated component logic.
- Back-end coverage belongs under `back-end/test/` and runs through Node’s test runner with `tsx`.
- When changing environment validation, Supabase behavior, or billing toggles, add or update tests to prove the
  required env contract still holds.

## Security & Configuration Tips

- This repo validates environment at both Nuxt and back-end startup. Required values change based on mode, especially
  `NUXT_PUBLIC_BACKEND_MODE`, `NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NUXT_PUBLIC_BILLING_MODE`, `STRIPE_SECRET_KEY`, and
  `STRIPE_WEBHOOK_SECRET`.
- Keep secrets in ignored `.env` files or your deployment secret store. Never commit live Supabase or Stripe
  credentials.
- Re-run validation and tests when changing auth, billing, or environment-shaping code, because broken mode switches
  will fail the app early.

## Release Scope
- This repo follows the stable `v1.x` line. Stay on `v1` for routine work; only cut `v2` for an intentional breaking product, data-contract, or deployment change.
- Founder/onboarding flows, proposal or contract logic, billing, Supabase integrations, auth/runtime behavior, dependency security, and health/deploy behavior are release-worthy when deployable.

## Dependency & Lockfile Discipline

- Use the committed root `package-lock.json` with `npm ci` for dependency changes. Regenerate the lockfile from the root if manifests change; follow the shared audit and validation policy in `../AGENTS.md`.
