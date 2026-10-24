# UX and Readability Redesign — 2026-10-21

Branch: `claude/ux-redesign`

This document records the audit of the public site and member workspace, the redesign implemented on this branch, and the recommended follow-up phases. The goal is better usability, easier reading, and a clearer path from "what is this?" to "I have an agreement."

## 1. Audit findings

### Public site

| Area | Problem | Impact |
| --- | --- | --- |
| Homepage | Only a headline, one sentence, and two buttons before the footer. No explanation of the process, trust model, pricing, or common questions. | First-time visitors leave the page to learn anything. The page does not sell the product or build trust. |
| Pricing | The price sat in a small badge in the card corner. The recommended plan looked the same as the others. No billing questions near the plans. | The page's most important number was the hardest to find. Common hesitations went unanswered. |
| How it works | Six identical boxed cards. Step labels were tiny uppercase text ("1. Start with a clear search"), and titles were full sentences running over 900px wide. | Hard to scan. Long lines slowed reading. The sequence did not read as a sequence. |
| Header | Hid itself on scroll-down, with no current-page indicator. "Founder guides" pointed to agreement resources. | Users lost their place and their navigation. The label did not match the destination. |
| Footer | Three unlabeled link columns. | Hard to scan. Screen-reader users heard nine links with no grouping. |
| Typography | Body text often 14px in muted grey. Kicker labels at 0.74rem with wide tracking. DM Serif Display was loaded on every page but never used. | Lower legibility, especially in light mode. Font bytes were downloaded for nothing. |
| Light-mode contrast | Muted text `#657080` on `#f4f5f8` measured about 4.6:1, just above the AA minimum for body text. | Secondary text was tiring to read. |

### Member workspace

| Area | Problem | Impact |
| --- | --- | --- |
| Sidebar | 13 links in one flat list, with no grouping by task. | Members could not tell where to go next. Related tools were not grouped. |
| Sidebar icons | 12 of 13 icons rendered at 0px. UnoCSS did not scan `front-end/shared/**/*.ts`, where the navigation constants live, and three icon names (`inbox`, `ibm-cloud-direct-link-1`, `queue`) do not exist in Carbon. | The navigation looked broken and unfinished. |
| Topbar | Repeated the page H1 ("Overview" twice). Always showed "0 unread" and "0 alerts" badges. Settings and Sign out duplicated items reachable elsewhere. | Visual noise. Zero-count badges train people to ignore badges. |
| Shell | Sidebar scrolled away with the page. The mobile menu did not close after navigating and had no `aria-expanded`/`aria-controls`. | Members lost navigation on long pages. The mobile menu stayed open over the new page. |
| Surfaces | Heavy glass panels (24px radius, blur, large shadows) nested inside other panels. | Every box had the same weight, so hierarchy was flat. |

## 2. What this branch changes

### Design foundation (`main.css`, `theme.ts`, `uno.config.ts`)

- **Type and measure.** Body text is 16px at 1.6 line-height. New `lede`, `measure` (68ch), and `section-header` primitives. `text-wrap: balance` on headings and `pretty` on paragraphs. Kicker labels are larger with tighter tracking.
- **Display face.** The DM Serif Display font, already downloaded, is now used for hero and closing headlines through `.display-heading`. This gives editorial contrast at no extra cost.
- **Contrast.** Light-mode muted text is darker in all three schemes (Ledger `#56606f`, Foundry `#57615d`, Ember `#66594f`). Dark-mode dividers are slightly stronger.
- **Surfaces.** Panel radius tokens are `--radius-lg`/`--radius-md`, with lighter blur and a calmer page background (one soft glow, fixed).
- **Touch targets.** `BaseButton` has explicit minimum heights (40/44/52px) and a consistent radius. Form controls have a 44px minimum height.
- **Motion.** All animations and transitions respect `prefers-reduced-motion`.
- **Icon extraction fix.** UnoCSS now also extracts classes from `shared/**/*.ts`. The three invalid Carbon icon names were replaced (`task`, `partnership`, `queued`).

### Public site

- **Homepage** now tells a complete story: hero with clear CTAs and three reassurances → "Why structure matters" (commitment, control, ownership) → the six-step path → trust pillars → pricing preview → top questions → closing CTA. All copy comes from existing product facts in `shared/data/marketing.ts`, with no invented stats or testimonials.
- **How it works** is a numbered vertical timeline with short step names, a sticky step index on desktop, comfortable line lengths, and a closing next-step CTA.
- **Pricing** shows large prices and a highlighted "Most popular" Pro plan. The CTA sits above the feature list, and billing FAQs sit under the plans.
- **Header** stays visible (no hide-on-scroll), marks the current page (`aria-current`), adds a skip link, and closes the mobile menu on navigation. Navigation follows the visitor journey: How it works → Find a cofounder → Pricing → Guides → Trust.
- **Footer** has labeled Explore / Learn / Company groups (as `nav` landmarks), a tagline, and a bottom bar.
- **Auth layout** adds a "Back to site" link and a skip link.

### Member and admin workspace

- **Grouped sidebar:** *Today* (Overview, Inbox, Activation), *Find people* (Discover, Opportunities, Matches, Messages), *Formalize* (Proposals, Contracts, Studio, Legal review, plus Fundraising when enabled), and *Account* (Billing, Settings).
- **Active state** is an accent bar plus `aria-current="page"`. Live **count pills** appear on Inbox and Messages only when the count is above zero.
- **Account block** at the bottom of the sidebar shows the member's name and email and a sign-out button.
- **Sticky sidebar** on desktop with its own scroll area. The **mobile drawer** has proper ARIA and closes when the route changes.
- **Topbar** is now a breadcrumb ("Workspace › Matches") instead of a second H1. It shows an unread/alerts summary only when there is something to see, an Inbox button with a count, and refresh with the sync time.
- **Admin layout** gets the same nav treatment, sticky sidebar, and accessible mobile menu.
- **`useWorkspaceCounts`** composable shares count logic between the sidebar and topbar.

### Verification

- `npm run lint` passes.
- `npm run typecheck` passes.
- `vitest run`: 86 files, 455 tests pass.
- `npm run test:e2e`: 3 Playwright tests pass.
- `npm run a11y:production`: axe passes on 28 route × theme combinations (light and dark), including the redesigned home, how-it-works, pricing, and sign-in pages.
- The production `nuxt build` succeeds, and the emitted CSS was checked for the previously missing icon classes.
- Manual browser review at 1366×900 and 375×812, in light and dark mode. No horizontal overflow on the public pages checked.

## 3. Information density guideline

Added 2026-10-24 after reviewing research on how much people take in at a glance (working-memory, glanceable-display, web eye-tracking, and ballot-usability studies). The research found no hard cutoff where people stop reading. What it does show is that attention, comparison accuracy, and recall drop as more independent facts compete for the first look, and that information kept visible on screen relieves memory. The numbers below are conservative design limits drawn from that evidence. They are not laws of cognition.

### Rules

| Object | Limit | Applied here |
| --- | --- | --- |
| Summary card | One identity anchor (name plus a one-line description) and **up to 4 facts**. Treat a 5th fact as a reason to review the card. | `ProfileCard`, `OpportunityCard`, `ProposalCard` |
| Card fields | The **same fields in the same order** on every card of a type. Show "Not listed" or "Not set" rather than leaving a fact out. | New `CardFacts` primitive (`src/components/ui/CardFacts.vue`) |
| Card actions | **1 primary and at most 1 secondary** action. Supporting meta such as match score is muted text, not another badge. | Overview recommendations; Discover already complied |
| Comparison | Never hide facts that people compare across options. Show them side by side on aligned rows. | Pricing plan limits |
| Critical information | Within the first one or two screens. Lead with the single next action. | Overview "Your next step" panel |
| Disclosure | Only secondary detail goes behind a link or accordion, and the summary must be enough to decide whether to open it. | Trial sprint detail, FAQ answers |
| Lists | Several cards are fine when they share one schema. Add a heading or other structure after about 4–7 cards on mobile and 6–10 on desktop. | Existing directory pages are within this |

### Changes made under this guideline

- **Profile cards** went from about ten competing elements (headline, role, trust %, work mode, commitment, location, featured proof title and outcome, three skill pills) to name and headline, a role badge, and four facts: Commitment, Works (work mode and location), Top skills, Profile signals. Featured proof is still on the profile page.
- **Opportunity cards** went from about ten elements to name and pitch, a verification badge, and four facts: Looking for, Stage, Commitment, Compensation. Problem, traction, and work mode are still on the detail pages. The equity range was only ever shown on the card, so it was **added to both detail pages** rather than dropped.
- **Proposal rows** use the same fact grid (Role, Relationship, Cash, Equity), and the summary is clamped to two lines. Contract notes are clamped to two lines.
- **Pricing** gives every plan four aligned rows (New intros, Proposal sends, Agreement drafts, Signature-ready agreements). The values come from `getPlanLimits()`, the same `PLAN_LIMITS` that enforce quotas, so the page cannot drift from what the product enforces. Descriptions reserve the same height so the rows line up across cards. The full feature list stays open below under "Everything in this plan".
- **Overview:**
  - The next step is an emphasized panel with one large call to action.
  - Recommendation cards have a single button with muted match meta.
  - The trial sprint uses a new `compact` mode: title, objective, status line, and one link. Scope, cadence, deliverables, and success signals stay on the match and relationship pages.
  - Notifications are single tappable rows. The redundant "New" badge is gone, since the list only contains unread items.
- **Activation panel:**
  - Each step's status badge now sits beside its label, and the action sits beside the row rather than across the full width.
  - Bug fix: compact mode showed the first two *unlocked* steps, which could both be finished while the pending gate stayed hidden. It now shows pending gates first.

## 4. Recommended next phases

These were out of scope for one pass, but they follow from the same audit.

1. **Workspace Overview, remaining density.** The next step, activation, trial and notification changes are done (see section 3). Still open: the pipeline panel repeats "0 open intros" when there are none, and the Overview could hide the activation panel entirely once every gate is clear.
2. **Merge Overview and Activation** once activation is complete. After all gates clear, the Activation item can drop out of the *Today* group.
3. **Discover and Opportunities filters.** Use one shared filter bar with chips that show the active filters and a "Clear all" control. Remember the last filter set per member.
4. **Long legal pages** (`/terms`, `/privacy`). Use the new `measure` width for body copy. The table of contents is already there, so add "Back to top" links and a highlight for the current section.
5. **Onboarding.** Show progress ("Step 2 of 4") and save each step automatically, so members can leave and come back.
6. **Empty states.** `EmptyState` already takes an icon. Every workspace list should give one concrete next action, never just "nothing here".
7. **Proposal and contract editors.** Use a two-column layout on wide screens: the form on the left and a live, readable preview on the right.
8. **Theme toggle hydration.** `ThemeToggle` shows "Light" until it mounts, even in dark mode. Render a neutral icon until the client theme is known.

## 5. Rollback

The changes are presentational and confined to the files listed in the branch diff. No data contracts, routes, auth, billing, or API behavior changed. To roll back, do not merge the branch, or revert its commits.
