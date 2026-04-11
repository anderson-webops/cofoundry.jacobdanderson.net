# Repository Guidelines

## Project Structure & Module Organization

- `front-end/` hosts the Nuxt application. Route screens live in `src/pages`, shared UI in `src/components`, state in
  `src/stores`, and reusable logic in `src/composables`, `src/shared`, and `server/`.
- `back-end/` contains the operational Node workspace for environment validation, Supabase-backed service logic, health
  endpoints, and seed/test utilities. Keep source in `src/`, seed scripts in `scripts/`, and Node test coverage in
  `test/`.
- Root configuration (`package.json`, `eslint.config.js`, TypeScript base config, and workspace scripts) governs both
  workspaces. Update root tooling when a change affects either side of the monorepo.

## Build, Test, and Development Commands

- `npm install` at the repository root installs all workspaces with the pinned npm toolchain. Do not mix package
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

## Commit & Pull Request Guidelines

- Follow the existing history style: short, present-tense commit subjects under 72 characters.
- Keep unrelated changes in separate commits. If a change requires a follow-up fix after validation, commit that as its
  own step instead of amending mixed work.
- Before requesting review, document the commands you ran and call out any env/setup assumptions that reviewers need in
  order to reproduce the result.

## Security & Configuration Tips

- This repo validates environment at both Nuxt and back-end startup. Required values change based on mode, especially
  `NUXT_PUBLIC_BACKEND_MODE`, `NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NUXT_PUBLIC_BILLING_MODE`, `STRIPE_SECRET_KEY`, and
  `STRIPE_WEBHOOK_SECRET`.
- Keep secrets in ignored `.env` files or your deployment secret store. Never commit live Supabase or Stripe
  credentials.
- Re-run validation and tests when changing auth, billing, or environment-shaping code, because broken mode switches
  will fail the app early.

## Agent Delivery Workflow
- Do not leave completed work uncommitted. After each coherent, validated change set, create a commit and push it in the same session.
- Use multiple commits and pushes when that keeps unrelated changes, partial validations, or follow-up fixes clearly separated. Prefer small, logically grouped commits over one mixed commit.
- Keep `package-lock.json` synchronized before every commit or push.
- Use lowercase annotated semver tags only. Do not invent ad-hoc labels such as `V1`, `torca-r07`, `pre-lfs-migration-*`, or similar one-off names.
- This repo follows the stable `v1.x` line. Stay on `v1` for routine work; only cut `v2` for an intentional breaking product, data-contract, or deployment change.
- Before creating a new tag, check the latest tag in the active semver line and decide whether the new commit is still the same release milestone. If it is, move that existing tag forward to the new validated commit instead of minting a new version number.
- Keep the GitHub release aligned with that decision: when the commit still belongs to the same milestone, update or recreate the existing release so it points at the moved tag/current commit; only create a brand-new release when the change creates a genuinely new milestone.
- Cut a fresh semver tag and release only when the work crosses a real release boundary, such as a new deployable milestone, a materially different operator/user-facing state, or a version-line change that deserves its own notes and rollback point.
- Create an annotated tag when founder/onboarding flows, proposal or contract logic, billing behavior, Supabase integrations, auth/runtime behavior, dependency/security posture, or health/deploy behavior materially changes.
- Create a GitHub release when that tag represents a real production milestone for founders, operators, or rollback/reference needs. Release notes should summarize scope, validation, rollout notes, and any migration or recovery steps.
- If the existing tag or release history contains stale drafts, redundant entries, or ad-hoc labels, clean that history up instead of preserving clutter.
- Skip tags and releases for trivial doc-only edits, formatting-only changes, or routine housekeeping unless they change deployment, operations, or a consumer-facing contract.
