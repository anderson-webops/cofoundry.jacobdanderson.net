# CoFoundry Next-Build Roadmap

## Product Decision

CoFoundry's original product idea is a founder-formation system, not only a discovery directory. The complete primary loop is:

1. discover
2. send structured intro
3. accept or decline
4. message
5. run trial
6. negotiate proposal
7. create and revise an agreement
8. optionally send an exact version to user-selected in-house or outside counsel
9. resolve requested changes and collect version-specific signatures

The single-relationship loop is substantially implemented in source. Work should optimize for authoritative persistence, mutual visibility, privacy, security, operational continuity, and evidence that the hosted release is running the same code.

## Expanded Completion Map

### Primary founder-formation loop

Status: implemented and locally release-validated; hosted promotion and deployment-identity verification remain the completion gate.

- Intent-rich profiles, opportunities, matching, structured mutual intros, and messaging
- Trial collaborations, relationship decisions, sectioned proposals, counters, comments, and acceptance
- Proposal-derived agreements, authoritative revisions, field-level redlines, current-version signatures, printable exports, and execution certificates
- Version-bound legal-review invitations, reviewer responses, signing holds, participant revocation, revision supersession, and account export

### Team / Studio operating model

Status: implemented and locally release-validated; hosted promotion and deployment-identity verification remain the completion gate.

- Organization workspaces with multiple seats and explicit owner, operator, member, reviewer, billing, and counsel roles
- Venture portfolios, projects, tasks, decisions, shared searches, linked relationship resources, and organization-level audit history
- Reusable agreement policies, version-bound internal approval routing, separation-of-duties controls, required legal review, and signing-time enforcement
- In-house counsel queues spanning multiple relationships without turning outside counsel into ordinary network members
- Team-plan sponsorship, seat limits, retention settings, role-scoped projections, stale-write protection, durable local persistence, and service-role-only Supabase persistence

Still staged for later depth after the operating foundation:

- Consolidated cross-relationship analytics and richer portfolio reporting
- External identity-directory or single-sign-on provisioning for larger studios

### Independent professional-help ecosystem

Status: neutral referral resources and direct user-selected invitations implemented; a CoFoundry lawyer marketplace is intentionally not launched.

- Keep official bar-association referral resources available for users who have not selected counsel
- Consider a vetted partner directory only after conflicts, licensing, geography, engagement, fee, endorsement, privacy, and support responsibilities have explicit product and legal ownership
- Never imply that CoFoundry forms an attorney-client relationship, chooses counsel, or guarantees professional quality

### Optional investment path

Status: implemented and locally release-validated behind a disabled-by-default feature flag; partner-specific compliance review, hosted infrastructure, promotion, and deployment-identity verification remain the enablement gates.

- Applicant fundraising readiness, round planning, private prospect and interaction tracking, secure data-room records, founder updates, and revisioned program applications
- Strict projections that exclude applicant prospect and interaction records from staff, exclude unshared data-room records and updates from review, and exclude staff notes and internal rationale from applicant views and exports
- Isolated admin and investor-admin review queue with assignment, priority, information requests, diligence, review notes, committee decisions, and status transitions
- Separate applicant consent and selected-record controls for counsel, broker-dealer, funding-portal, investment-adviser, or other regulated-partner handoff preparation
- Service-role-only Supabase aggregate persistence, durable local persistence, optimistic concurrency, private uploads, malware-review gates, authenticated downloads, realtime invalidation, notifications, and organization approval integration
- CoFoundry does not discover or rank investors, recommend investments, handle funds or securities, execute transactions, or receive transaction-based compensation; program acceptance remains a next-stage workflow decision rather than a financing commitment

Enablement work that remains partner- or deployment-specific:

- Complete counsel review of the supplemental terms and the intended exemption/intermediary path for each live program
- Contract with and technically integrate any registered intermediary required for actual securities activity; keep transaction execution outside CoFoundry
- Apply migrations and provision durable private storage and scanning on the host, repeat applicant/reviewer browser evidence against that environment, deploy, and verify the exact live release before setting the feature flag in production

### External service depth

Status: source interfaces exist; host/provider proof remains separate.

- Optional e-signature/PDF provider, transactional mail, OAuth, Stripe, file scanner, backup, monitoring, and multi-instance realtime
- Each provider remains disabled or explicitly degraded until its own staging and hosted smoke evidence passes

## Now

### 1. Unified inbox and action queue

Status: implemented for the aggregate route and granular read endpoints.

Front-end scope:

- Add `/app/inbox` as the single attention surface for:
  - inbound intros
  - unread conversations
  - proposal responses
  - contract signatures
  - unread system updates
- Make the workspace shell acknowledge the inbox:
  - sidebar navigation
  - route context
  - topbar entry point
  - dashboard primary action
- Define a stable inbox contract in shared code so the backend can own the same shape later.

Current front-end contract:

- `front-end/shared/utils/inbox.ts`
  - `buildInboxQueues()`
  - `buildInboxSnapshot()`
  - `getUnreadConversationsForUser()`
  - `getProposalsNeedingResponse()`
  - `getContractsNeedingSignature()`
  - `getPendingIncomingConnectRequestsForUser()`
  - `getPendingOutgoingConnectRequestsForUser()`

### 2. Real persisted workspace state

Status: durable mock/access-request and Supabase-ready workspace foundation implemented.

Current persisted slice:

- Supabase-backed credential sign-in and sign-up on the Nuxt server
- signed CoFoundry app sessions revalidated against persisted member state
- persisted member-owned records for:
  - user identity and role
  - profile state
  - subscription state
  - owned opportunities
  - bookmarks
  - saved searches
- frontend workspace hydration from `/api/workspace`
- safe member-owned writes through `/api/workspace/member`
- server-routed collaboration writes for intros, messages, proposals, trials, agreements, relationship decisions, notifications, and inbox read state
- a dedicated relationship read endpoint at `/api/relationships/[id]`
- durable local mock/access-request stores for invited-account production mode before Supabase cutover

Still external or host-provisioned for now:

- Supabase mode still needs the production host to apply migrations, inject service-role secrets, and run first-admin bootstrap before cutover.
- Live email, OAuth, Stripe, scanner, backup, and alerting providers still need host/provider smoke evidence before those modes are treated as live.
- Multi-instance realtime still needs a host-side relay if production scales beyond one Node process.

Backend-owned entities:

- users
- profiles
- startup opportunities
- connect requests
- matches
- conversations
- messages
- trials
- proposals
- proposal versions
- proposal comments
- contracts
- contract versions
- contract legal reviews
- signatures
- relationship decisions
- notifications
- reports
- admin actions
- subscriptions

Current result:

- Pinia becomes a client cache, not the source of truth.
- Refreshing the browser does not lose state.
- Two different devices can see the same conversation, proposal, and contract status when they are backed by the same durable local store or Supabase project.

### 3. Server-enforced roles and admin operations

Backend requirements:

- user role claims: started
- admin role enforcement: started
- audit log persistence: started for admin user/report/privacy actions in Supabase mode
- suspend / reinstate: started with Supabase persistence
- report review / resolve: started with Supabase persistence
- first-admin bootstrap script wired to the Supabase service-role path

Additional production controls now started:

- server-side rate limits on auth, contact, billing, collaboration, member writes, inbox reads, admin actions, exports, and privacy requests
- JSON account data export from settings
- privacy and trust-review request submission from settings, with `/admin/privacy` reading Supabase or the local mock-mode queue
- `/admin/readiness` launch-readiness scoring from server-side environment, queue, worker, and operations evidence
- provider-independent trust-verification evidence intake, with worker-authenticated local/Supabase persistence and `/admin/operations` visibility for future phone, social/OAuth, work-domain, identity, and opportunity-ownership providers

### 4. Production billing path

Keep Stripe guarded until ready, but finish the real path cleanly:

- checkout session creation
- webhook handling
- subscription sync
- admin billing visibility through a read-only billing console
- entitlement enforcement on the server for intros, saved searches, proposals, agreement drafts, and signatures

## Next

### 5. Relationship workspace

The current product still spreads one live relationship across matches, messages, proposals, and contracts.

Status: implemented as a consolidated route with server-owned reads, cross-links from the related conversation/proposal/contract detail surfaces, a filtered relationship timeline, file/artifact visibility, upload policy integration, scan-status display, a decision log derived from relationship notes plus proposal/trial/agreement records, and writable relationship-level decision notes.

The user-facing consolidation is:

- `/app/relationships/[id]`

That route should unify:

- counterpart summary
- trust and alignment state
- latest messages
- current trial
- active proposal
- active contract
- next required action

Remaining depth:

- run the checked-in scanner worker against real host storage and confirm file scan status recovers from pending to clean/flagged in `/app/relationships/[id]` and `/admin/operations`
- implement a shared atomic rate limiter and cross-instance abuse tests before allowing production to run multiple app instances; only then validate the host realtime relay with `npm run operations:realtime-smoke -- --min-delivered 1`

### 6. Production-grade onboarding

Status: implemented as a shared activation read model, dashboard module, and `/app/activation` route.

The activation path now separates:

- minimum profile
- trust-critical profile completion
- first recommended intro
- inbox-first follow-through

The dashboard now shows the member's current activation gate, and the full activation route lists profile and trust blockers before members increase intro volume.

### 7. Operational notifications

Status: source-level lifecycle notification layer, launch-facing event templates, member workflow-email preference gating, primary app trigger wiring, optional worker-side alert webhook support, and alert-smoke readiness checks are implemented; live provider/host wiring remains.

The source now has shared lifecycle notification templates, worker-authenticated event delivery, durable delivery telemetry in mock/access-request mode, Supabase migration support for lifecycle metadata, admin operations visibility for event/target rows, non-blocking lifecycle emits from collaboration, report-review, and mock billing mutations, plus optional JSON alert webhooks for warning/error worker events with `/admin/readiness` evidence checks. The launch-facing names are explicit so provider templates can be mapped without guessing which generic workflow event fired.

Covered lifecycle events:

- `intro.received`
- `intro.accepted`
- `match.created`
- `message.unread`
- `proposal.received`
- `proposal.updated`
- `contract.signature_required`
- `report.reviewed`
- `billing.state_changed`
- `subscription.changed`

Remaining work:

- Verify SMTP/sendmail provider behavior in Supabase mode before enabling real sends.
- Install worker/timer or queue processing on the production host.
- Choose and configure the host alert webhook destination if external alerting is wanted, then run the checked-in alert-smoke event from the server.
- Wire any future provider-only events, such as Stripe webhook-only subscription reconciliation, after live providers are configured.

### 8. Agreement artifacts

Status: first-party agreement artifact layer implemented; external e-signature/PDF vendors remain optional provider work, with provider envelope evidence intake now ready in source.

The contract detail flow now supports:

- print-ready HTML agreement downloads
- plain-text agreement export through `?format=text`
- field-level redlines between contract versions
- agreement execution certificate downloads with document SHA-256, version metadata, typed-signature evidence, and pending/complete status
- optional provider envelope evidence in certificate downloads when a worker reports e-signature/PDF provider status for the matching contract version
- server-side auth, participant ownership checks, paid-plan entitlement checks, and rate limits for downloadable artifacts

Remaining work:

- Decide whether production needs a dedicated e-signature provider or whether typed signatures plus certificate packets are sufficient for the launch use case.
- If a provider is selected, configure the provider webhook bridge to report envelope IDs, statuses, signer IDs, completed PDF upload IDs, and completed PDF hashes through `/api/operations/contract-envelopes`.

### 9. Relationship analytics

Status: implemented as a shared read model and admin dashboard section.

The admin analytics page now reports:

- intro acceptance rate
- trial activation rate
- proposal coverage rate
- agreement draft generation rate
- signature completion rate
- average time to first reply
- average time from match to proposal
- average time from proposal to agreement draft
- average time from proposal to fully signed agreement when completed samples exist
- actionable relationship bottlenecks for pending intros, missing proposals, missing agreement drafts, and incomplete signatures

## Later

### 10. Version-bound legal review

Status: implemented and locally release-validated; hosted promotion remains.

The agreement workflow now supports:

- paid-plan handoff to a named in-house or outside legal representative
- a confidential HMAC-signed 14-day bearer link bound to one review, agreement, version, expiration, and reviewer-email digest
- selectable review scopes and requester context
- a reviewer-only page that exposes the selected agreement version without requiring a CoFoundry member account
- recorded approval or requested changes with a typed responder name, authority attestation, and participant notifications, while making clear that identity and licensure are not verified
- a server-enforced signature hold while review is requested, opened, or has unresolved requested changes
- revocation by either agreement participant and automatic supersession when a new agreement version is created
- email delivery through the existing server mail transport, with a manual share-link fallback
- a dedicated local private store and Supabase table, account-export coverage, privacy disclosures, and neutral bar-association referral resources

Migration and workflow tests, participant and external-reviewer browser coverage, responsive checks, the full local release gate, and Playwright end-to-end tests pass. Release completion now requires only hosted promotion, migration application in Supabase mode, provider/host configuration where enabled, and hosted identity verification.

### 11. Realtime

After persistence is stable:

Status: production-safe single-process refresh bridge, first-party SSE invalidation, non-persistent typing presence, guarded operations-authenticated experimental fanout ingress, and worker-reported fanout smoke evidence are implemented. Horizontal production scaling remains blocked until rate limits use a shared atomic store.

The app shell now:

- refreshes the authoritative workspace when a signed-in member returns to a visible tab
- refreshes when the browser comes back online
- subscribes to authenticated `/api/workspace/events` server-sent events for same-process workspace invalidation
- publishes authenticated, non-persistent typing presence without writing keystroke-level state to workspace storage
- can publish signed realtime envelopes to a server-side relay when `COFOUNDRY_REALTIME_FANOUT_URL` is configured, and can receive relay envelopes through `/api/operations/realtime-events`
- can record fanout smoke evidence with `npm run operations:realtime-smoke -- --min-delivered 0`, or require delivered SSE evidence with `--min-delivered 1` or higher when a cross-instance member stream is connected
- falls back to conservative visible polling when SSE is unsupported or disconnected so inbox, message, proposal, contract, notification, and billing state do not require a full reload
- exposes a manual topbar refresh control with last-sync status
- avoids write amplification by distinguishing authoritative server snapshots from member-authored edits

Remaining work:

- implement a shared atomic rate-limiter store and cross-instance abuse tests
- after that boundary passes, configure the host-side relay and run the checked-in realtime smoke worker against every staging instance
- provider-level presence semantics if production needs richer online/offline state beyond typing presence

### 12. Email and outbound system events

Status: worker-authenticated mail smoke telemetry and `/admin/readiness` evidence checks are implemented; live provider setup remains.

Mail transport can now be proven with `systemctl start cofoundry-operations-mail-smoke.service` after installing the checked-in systemd templates, or directly with `npm run operations:mail-smoke -- --to-email <monitored-inbox>`. Both paths record `mail.smoke` delivery rows for `/admin/operations` and `/admin/readiness`.

Provider-backed template names now exist in source for intro received, intro accepted, proposal received, signature required, and billing state change. Optional relationship workflow emails are now gated by a member preference in `/app/settings` and include a signed preference-management footer plus `List-Unsubscribe` header when sent; scheduled digests keep their separate opt-in, signed footer, and header. Provider suppression events now have a worker-authenticated ingestion endpoint and admin visibility. Remaining work is SMTP/provider verification, provider webhook setup, and host-side scheduling or queue processing.

## Backend Contract Status

The backend now exposes the inbox read model from the persisted member foundation. Future server work should keep extending this path instead of creating another inbox contract.

Implemented endpoints:

- `GET /api/inbox`
  - returns counts plus ordered action items for the signed-in user
- `GET /api/inbox/requests`
  - returns pending inbound and outbound connect requests
- `GET /api/inbox/conversations`
  - returns unread conversation summaries
- `GET /api/inbox/proposals`
  - returns proposal items that need the user’s response
- `GET /api/inbox/contracts`
  - returns contract items needing signature or revision
- `GET /api/inbox/notifications`
  - returns unread operational notifications
- `POST /api/inbox/notifications/:id/read`
  - marks an operational notification as read

Recommended response shape for `GET /api/inbox`:

```ts
interface InboxActionItem {
  id: string
  kind: "intro" | "message" | "proposal" | "contract" | "notification"
  priority: "high" | "medium" | "low"
  title: string
  summary: string
  href: string
  createdAt: string
  badgeLabel: string
  badgeTone: "accent" | "warning" | "neutral" | "success" | "danger"
}

interface InboxSnapshot {
  counts: {
    pendingIntros: number
    waitingOnReplies: number
    unreadConversations: number
    proposalsNeedingResponse: number
    contractsNeedingSignature: number
    unreadNotifications: number
  }
  actions: InboxActionItem[]
}
```

## Manual Setup Still Needed

These items still need to be provisioned outside the repo:

### Required for real accounts and persistence

- Supabase project
- Supabase URL
- Supabase anon key
- Supabase service role key
- applied schema and RLS policies
- a production `SESSION_SIGNING_SECRET`

### Required for real billing later

- Stripe account
- Stripe product and price IDs
- Stripe secret key
- Stripe webhook secret
- webhook endpoint registration

### Required for real email and support

- transactional email provider
- support inbox or helpdesk destination
- domain and sender verification

### Required for production operations

- error monitoring
- structured logging destination
- alert webhook destination if worker-reported warning/error events should page or notify operators
- backup / restore plan
- documented first-admin bootstrap script
- deployment secret store / Vault wiring

### Required decisions

- canonical production auth mode
- whether self-serve sign-up is open at launch
- whether the first production admin is bootstrapped by email or by user id
- support ownership and SLA
- Stripe go-live timing
