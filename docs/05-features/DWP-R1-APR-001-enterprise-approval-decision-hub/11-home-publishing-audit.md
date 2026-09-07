# Approval Home Publishing Audit

Date: 2026-09-04. Primary user: a requester or approver checking today's work.
Operational question: which decision needs attention first, and where are my submissions?
Primary action: open the highest-priority review. Archetype: operational dashboard, not an Inbox menu.

## Findings and Repairs

1. Responsive KPI border shorthands reset the divider color to current text color. Browser
   measurement reproduced `rgb(15, 21, 29)` instead of `rgb(203, 210, 217)`. Independent border
   widths preserve the theme divider in light and dark modes. The embedded strip has no duplicate
   bottom border; numeric foundation radii use native pixel styles, not MUI radius multiplication.
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

## Verification Contract

- New `e2e/approval-home-publishing.spec.ts` covers 1920/1440/1280/390/320px, Korean/English,
  balanced/expressive/focused layouts, dark mode, empty/error states, keyboard edit transitions,
  persisted list heights, long identifiers and 200 percent text.
- Tests measure actual browser divider/radius/overflow/focus styles and run Axe. Forced-color
  assertions distinguish browser capability: Chromium supports the emulation; the mobile WebKit
  project retains ordinary visible progress when that CSS feature is unavailable.
- The existing experience and command-center suites continue covering Home, sidebar queues,
  list/detail navigation, versioned decisions, stale authority and batch approval behavior.
- Screenshots use explicit test fixtures, not live business records. Enlarged, focused views use
  viewport captures to avoid mistaking fixed-header full-page stitching for a product overlap.
- Shared-component edits are limited to OperationalKpiStrip and ProgressMeter plus their tests.
  Their owning Home task was notified; no unrelated visual baselines were overwritten.

Reproduce with Node 24 and the canonical test server on port 4324:

```sh
E2E_BASE_URL=http://127.0.0.1:4324 E2E_REUSE_EXISTING_SERVER=true PLAYWRIGHT_OUTPUT_DIR=test-results-approval-home-audit corepack yarn playwright test e2e/approval-home-publishing.spec.ts e2e/approval-command-center-resilience.spec.ts e2e/approval-experience.spec.ts --project=chromium --project=mobile --workers=1
corepack yarn vitest run apps/dwp/src/features/approvals libs/design-system/src
corepack yarn typecheck --incremental false
corepack yarn nx run dwp-approvals:build --skip-nx-cache
```

## Integration Boundary

Repository-wide source-size and design-system adoption checks still report unrelated active
Notifications, Calendar, Home and Mail work. Calendar i18n findings were forwarded to its owner.
Approval-owned files have no reported adoption regression. No baseline allowance, public API,
backend, permission rule or external release evidence was weakened by this publishing audit.
No commit or push is part of this task. The user's existing port 4200 service is preserved.

## Verified Results

- Final publishing suite: 22/22 PASS, Chromium and mobile WebKit. Output:
  `test-results-approval-home-publishing-closed`. Axe serious/critical violations: zero.
- Existing experience and command-center browser regressions: 64/64 PASS in the preceding
  combined run. That run's single failure was the new container-query assertion reading before
  layout settled; the final publishing run polls the actual settled layout. These are separate
  runs, not a claim of one combined 86-test run.
- Approval and Design System unit tests: 26 files, 127/127 PASS.
- Full non-incremental TypeScript check, i18n, owned ESLint/Prettier, feature/API boundaries and
  `git diff --check`: PASS.
- Approval product production build and budgets: PASS. Initial raw 878.4/900 KiB, gzip
  269.4/280 KiB, requests 5/5; largest async raw 527.9/800 KiB, gzip 142.3/260 KiB.
- Repository-wide adoption/source-size findings described above remain outside this scope;
  the product build result is not a claim that the entire repository release gate is green.

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
