# Approval Home Publishing Audit

Date: 2026-09-08. Primary user: a requester or approver checking today's work.
Operational question: which decision needs attention first, and where are my submissions?
Primary action: open the highest-priority review. Archetype: operational dashboard, not an Inbox menu.

## Executive Portal Completion

The supplied Stitch Executive Portal was treated as the visual and information-hierarchy reference,
then reconciled with DWP's existing React Router, MUI design system, TanStack Query authority model
and workspace personalization contract. It was not copied as a parallel Next.js/Tailwind/Zustand app.

- The Home is now an executive work overview: governed daily brief, four independent KPI signal
  cards, priority review queue, permission-filtered quick actions, submitted-request progress,
  policy/SLA navigator, recorded flow and recent canonical activity.
- Quick actions use only real DWP routes and remain hidden when the corresponding authority is not
  available. The reference's form shortcuts were not fabricated because Home has no canonical
  per-form shortcut payload.
- Recent activity is derived from the existing Home response and is intentionally labelled recent,
  not live. No event stream, recommendation, approval amount or delegation limit is invented.
- Queue filters remain exclusively beneath the Inbox item in the product sidebar. Home does not
  render a second workflow menu inside its content canvas.
- At 320px the brief actions stack, KPI cards become a single column, and every work section remains
  reachable in document flow. At desktop widths the content follows the reference's wide-left and
  compact-right operational hierarchy.

## Findings and Repairs

1. The former full-width metric strip made the brief read as one large outlined block. Four
   independent signal cards now carry icon, value, label and supporting evidence with restrained
   tone rails. Browser measurements verify real borders, non-transparent surfaces and design-system
   radii in every responsive layout.
2. Expressive Home used a fixed light background under dark text tokens, making dark-mode
   content unreadable. Theme surfaces and theme-aware accents now apply to the brief, metrics,
   insight rows and editor toolbar. The urgent state also passes contrast on the tinted brief.
3. The brief colored every risk score red while queue rows used another threshold. Both now
   use the existing decision-view bands: under 70 neutral, 70-84 warning, 85+ critical. Zero
   due-today items are not colored as a warning. With no urgent item in the priority list, the
   secondary action opens the general Inbox instead of advertising an empty urgent queue.
4. Long names and workflow-step identifiers could push adjacent content out of its container.
   Shrinkable, wrapping text preserves values and labels. KPI cells collapse to one column at
   narrow effective container widths, including 320px with 200 percent root text.
5. Full-width buttons could have their focus outline clipped by a framed section. Inset focus
   outlines remain visible. Entering customization focuses its toolbar; cancel/save restores the
   Customize button. If a personalization failure disables that opener, Cancel instead focuses
   the available retry control, with the page heading as a final fallback. Insight rows remain
   left-aligned on wide screens.
6. Progress bars disappeared in forced colors. System-color track outlines and fills remain
   distinguishable without disabling forced colors for unrelated text or controls.
7. Queue/request height choices did not affect saved content. Short/standard/tall/expanded
   list budgets now show 1/2/4/6 rows with existing View All navigation. Non-list sections expose
   only their actual supported height; insight signals are not silently truncated.
8. Initial loading/error screens retain the page heading, and an unavailable Home has an
   explicit retry path. Authority-sensitive Home failures remain fail-closed; this audit does not
   retain sensitive cached data across permission failures.
9. Briefing counts are concise, and English singular/plural queue labels agree with the count.
   Home remains a dashboard; queue submenus remain under the Inbox sidebar item.
10. Quick-action labels were initially rendered as visual `h6` elements inside buttons, creating a
    heading-order violation. They are now ordinary text within the correctly labelled action. The
    success KPI uses a theme-specific dark-mode color so its value meets contrast requirements.
11. Work-owned approval tasks and information requests could open their exact Approval records, but
    Approval initially had no governed return handoff. A canonical `returnTo` contract now retains
    the original `/work` query and hash through task selection, successful decisions and information
    responses. Both the Inbox command center and the request detail drawer expose an explicit Return
    to work action. Authority revocation removes the handoff, while absolute, protocol-relative,
    non-Work, traversal, backslash, encoded traversal, control-character and over-length targets fail
    closed before a return control is rendered. A version conflict preserves the user's response and
    cannot make an untrusted return target actionable.
12. The Approval pilot-fixture adapter assumed the informational product-surface lineage ended at
    v5. When the shared signed fixture advanced to v6, all fixture-backed Approval tests failed
    before exercising their assertions. The adapter now verifies a canonical, contiguous
    `1..latestAliasVersion` lineage with exact bundle keys and SHA-256 values, while each Approval
    case remains pinned to its earliest required registry version.
13. The OIDC step-up callback exchanged its one-time authorization code twice under React
    StrictMode and checked `window.closed` immediately after requesting popup closure. The callback
    is now single-flight, completion is signalled before closure, and a bounded grace period uses
    only the server-normalized fallback destination when the browser keeps the popup open. The
    high-risk browser fixture also exposes the two step-up response headers through CORS, matching
    the Gateway contract instead of silently treating the response as an ordinary login.
14. A canonical `/work/**` return target was initially sufficient to render the Approval-to-Work
    handoff even after the destination product entitlement had been revoked. Rendering and
    activation now both require the exact current `APP.WORK:VIEW` authority in addition to the
    canonical target and Approval record authority. The raw permission set is evaluated with DENY
    precedence, a runtime session refresh removes the control immediately, and a stale click cannot
    navigate after the revocation.
15. Work-owned decisions and information responses originally resolved mutation authority only from
    the actor's selected Approval administration scope. A legitimate Work task therefore reached the
    independent Approval owner PEP but failed with `AUTHORITY_RESOLUTION_UNAVAILABLE` when the actor
    had no unrelated admin scope selection. Work commands now lock the current Approval object and
    bind authorization to its database-canonical `management_resource_set_key`. The exact
    `route.approvals.work.*` decision context is required when supplied, and any simultaneous admin
    context must identify the same object scope. PostgreSQL regressions prove that a team-scoped
    decision or information response updates only the intended team object while a sibling team's
    object remains unchanged.

## Verification Contract

- New `e2e/approval-home-publishing.spec.ts` covers 1920/1440/1280/390/320px, Korean/English,
  balanced/expressive/focused layouts, dark mode, empty/error states, keyboard edit transitions,
  persisted list heights, long identifiers and 200 percent text.
- Tests measure actual browser divider/radius/overflow/focus styles and run Axe. Forced-color
  assertions distinguish browser capability: desktop Chromium supports the emulation; the mobile
  browser profile retains ordinary visible progress when that CSS feature is unavailable.
- The existing experience and command-center suites continue covering Home, sidebar queues,
  list/detail navigation, versioned decisions, stale authority and batch approval behavior.
- Screenshots use explicit test fixtures, not live business records. Enlarged, focused views use
  viewport captures to avoid mistaking fixed-header full-page stitching for a product overlap.
- This completion pass changes no shared visual component. It composes existing ActionButton,
  ApprovalSurface and ProgressMeter primitives; no unrelated visual baseline is overwritten.

Reproduce with Node 24 and an isolated canonical test server:

```sh
DWP_FRONTEND_DEV_PORT=4325 E2E_BASE_URL=http://127.0.0.1:4325 PLAYWRIGHT_OUTPUT_DIR=test-results-approval-final corepack yarn playwright test e2e/approval-home-publishing.spec.ts e2e/approval-command-center-resilience.spec.ts e2e/approval-experience.spec.ts e2e/approval-authority-revalidation.spec.ts e2e/approval-high-risk-commands.spec.ts e2e/approval-work-handoff.spec.ts --project=chromium --project=mobile --workers=1
corepack yarn vitest run apps/dwp/src/features/approvals apps/dwp/src/pages/auth/oidc-callback.test.ts libs/shared-utils/src/api/auth-api.test.ts libs/shared-utils/src/auth/product-surface-step-up-popup.test.ts
corepack yarn typecheck --incremental false
corepack yarn nx run dwp-approvals:build --skip-nx-cache
(cd ../dwp-backend && ./gradlew :dwp-approval-server:check checkSourceSize --no-daemon --max-workers=1)
```

## Integration Boundary

Repository-wide Gateway and Agent OpenAPI checks, non-incremental typecheck, design-system adoption
and architecture checks pass on the final shared tree. The latest full lint passes feature/API
boundaries, cycles, reachability, internal exports, production and maintenance source-size,
design-system adoption and display-dictionary validation. The latest full production build also
passes all generated-contract, architecture, TypeScript, Vite and bundle-budget gates. A transient
6/5 initial-request failure was traced to size-splitting one static application-shell graph into
three mutually dependent chunks; removing that ineffective split restored four initial requests
without expanding the eager module graph or changing any Approval behavior. No baseline allowance,
public API, production backend behavior, permission rule or external release evidence was weakened
by this publishing audit. No commit or push is part of this task.

## Verified Results

- Final combined Approval browser regression: 160/160 PASS, split evenly between desktop Chromium
  and mobile profiles, with zero failures and zero skips. One isolated Node 24 command exercised the
  Home publishing, command-center resilience, experience, authority-revalidation, high-risk command
  and Work handoff suites against a dedicated test-mode Vite server on port 4325.
- The browser matrix covers 1920/1440/1280/390/320px, Korean/English, dark and forced colors,
  200 percent text, keyboard operation, responsive list/detail transitions and Axe. The generated
  desktop Home, Inbox and 320px mobile captures were inspected after the run; content does not
  overlap or escape its viewport.
- Work return handoff regression: 18/18 PASS across desktop and mobile profiles, covering successful
  task decisions, information responses, exact query/hash return, immediate authority revocation,
  destination entitlement revocation, mixed ALLOW/DENY precedence, version conflict at 320px and
  untrusted-target suppression, including asynchronous Product Surface bootstrap.
- Authority revalidation and high-risk command regression: 50/50 PASS across Chromium and mobile,
  including exact callback single-flight, popup completion, reconfirmation, mutation single-flight,
  deterministic rejection, transport retry, typed conflict/replay, proof expiry, provider selection,
  popup block/timeout and stale or foreign completion suppression.
- Approval and step-up callback/API protocol unit checkpoint: 16 files, 92/92 PASS.
- Product Surface Approval pilot: 67 PASS, 9 intentional project skips and zero failures across
  Chromium and mobile. Its 1,296-line E2E source remains exactly within the maintenance budget.
- Approval backend module check: 32 suites, 226/226 PASS with zero failures, errors or skips. The
  database-backed scope regressions execute real Work decision and information-response commands.
  The signed pilot
  fixture also passes its 71 cases, 46 negative cases and 41 generator mutation controls at the
  current v6 registry lineage.
- Integrated local-stack evidence uses real Gateway and owner-service paths. Work item `SKAX-42-1`
  opened its exact Approval task, returned HTTP 200 from the versioned decision command, changed the
  task from pending to approved and the request from in-review to approved, then returned to the
  exact Work query/hash with no browser console error. Supplement item `SKAX-900018-2` likewise
  submitted its information response with HTTP 200, changed the request from needs-info version 1 to
  in-review version 2, returned to Work and disappeared from the terminal queue without a failed
  response or console error.
- Final shared-tree integration checkpoint: 518 frontend test files, 4,235/4,235 tests PASS;
  non-incremental TypeScript, full application build, Workspace build, static architecture and
  formatting gates PASS at the recorded Work-owned snapshot before the isolated Approval browser
  run. No Approval production source changed between those checkpoints.
- Full non-incremental TypeScript check, full repository lint, generated OpenAPI checks,
  design-system adoption, architecture, i18n, owned ESLint/Prettier, feature/API boundaries and
  `git diff --check`: PASS.
- Approval product production build and budgets: PASS. Initial raw 882.2/900 KiB, gzip
  270.2/280 KiB, requests 5/5; largest async raw 535.4/800 KiB, gzip 143.9/260 KiB.
- Full application production build and budgets: PASS. Initial raw 1063.0/1074.2 KiB, gzip
  309.7/317.4 KiB, requests 4/5; largest async raw 505.5/537.1 KiB, gzip 119.0/166.0 KiB.
- Runtime health: `/approvals/home`, Gateway, all nine Java owner services and Agent return HTTP
  200 with readiness/health `UP` on the local integrated stack.

## Sidebar Disclosure Follow-Up

The selected Inbox parent previously remained a navigation link and always rendered its four
queue filters. It now acts as a native disclosure button, with a directional chevron,
`aria-expanded` and a unique `aria-controls` target for each desktop/mobile navigation surface.
Click, Enter and Space toggle the children without changing the selected queue, task, URL or
right-hand content. Collapsing does not dismiss the mobile drawer. Navigating away and returning
opens the Inbox children again; other navigation entries retain their ordinary link behavior.

Two regressions in `approval-command-center-resilience.spec.ts` cover pointer and keyboard
toggle, URL/filter preservation, re-entry, dark mode, 320px/200 percent text, focus, unique IDs
and Axe across Chromium and mobile WebKit. The mobile helper waits for the existing drawer's
exit transition before reopening it after a navigation.

Follow-up verification: combined experience/resilience E2E 68/68 PASS (including the four
desktop/mobile disclosure cases), layout/navigation unit 4 files/22 tests PASS, scoped ESLint,
Prettier and diff check PASS. Full non-incremental typecheck passed at the final verification
checkpoint after transient Messaging compilation errors were corrected by its owner.
