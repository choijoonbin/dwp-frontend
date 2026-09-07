# Approval Home and Inbox Completion

Verified: 2026-09-04. Scope: approval Home and action-oriented Inbox modernization.

## Product Contract

- `/approvals/home` remains the executive dashboard: daily briefing, operational metrics,
  priority review queue, submitted-request tracking, policy insights and actual workflow counts.
- `/approvals/inbox` contains the split list/detail review workspace. ALL, URGENT, DUE_TODAY
  and HIGH_RISK are child controls under the Inbox sidebar item, never a Home content menu.
- Selection and queue state are synchronized with URL parameters without a full page reload.
  Mobile presents one pane at a time with keyboard focus handoff and return to the selected row.
- The implementation uses the existing React Router, Vite, TanStack Query, MUI and DWP
  design system. The reference Next.js/Zustand prompt does not replace the application's stack.
- Risk summaries and workflow steps use actual server evidence. No fabricated AI analysis,
  future approvals, external integration status or unsupported document actions are displayed.

## Resume Audit and Repairs

The earlier Home, sidebar and split-pane implementation was preserved. The completion audit
found and repaired these remaining behaviors:

1. A pending final approval stage no longer appears 100 percent complete. APPROVED is the
   only completed state; absent or invalid stage data does not fabricate progress.
2. A Home request opens its exact detail. Closing or leaving that detail consumes the URL
   selection so a navigation transition cannot reopen the drawer.
3. Single-decision confirmation binds task ID, scope identity and reviewed version. Fetching,
   failure, permission loss or version drift invalidates it; the API callback checks authority again.
4. Batch revalidation updates the corresponding scoped detail cache, including skipped tasks,
   then invalidates all affected details. A revoked task cannot retain an enabled detail action.
5. Explicit URL task changes override previous selection and reopen the mobile detail pane.
6. The queue and sidebar share the same local-date clock behavior at midnight and tab return.
7. Mobile Enter-to-review focuses the detail region through loading and restores the row on back.
8. Radius tokens are expressed in pixels in MUI `sx`, avoiding accidental theme multiplication.

An independent read-only reviewer reproduced and then accepted the five Inbox issues.
Production files outside the approval integration boundary were not changed in this resume.

## Verification

Node 24.19.0 and Yarn 4.17.1:

- Approval feature, routing and API Vitest: 15 files, 81 tests passed.
- `approval-experience.spec.ts` and `approval-command-center-resilience.spec.ts`:
  Chromium/mobile 64 passed, no failures or skips.
- `approval-authority-revalidation.spec.ts`: Chromium/mobile 8 passed.
- Full non-incremental TypeScript, scoped ESLint/Prettier, i18n, API and feature boundaries passed.
- `nx run dwp-approvals:build` passed: initial raw 878.4/900 KiB, gzip 269.4/280 KiB,
  five initial requests; largest async raw 525.9/800 KiB, gzip 141.8/260 KiB.
- Screenshots and Axe checks cover 1440, 1280, 390 and 320px, dark, forced colors and reduced
  motion; the experience suite also covers 320px with 200 percent text sizing.
- Final screenshots are in `test-results-approval-complete`; authority evidence is in
  `test-results-approval-authority-complete`. These use explicit test fixtures, not live approvals.

Reproduction commands from the frontend repository, with the canonical test Vite server on 4324:

```sh
E2E_BASE_URL=http://127.0.0.1:4324 E2E_REUSE_EXISTING_SERVER=true corepack yarn playwright test e2e/approval-experience.spec.ts e2e/approval-command-center-resilience.spec.ts e2e/approval-authority-revalidation.spec.ts --project=chromium --project=mobile --workers=1
corepack yarn tsc --noEmit --incremental false --pretty false
corepack yarn nx run dwp-approvals:build
```

## Integration Boundary

The shared worktree contains unrelated ongoing changes. Repository-wide design-system checks
reported Home/Mail violations, and source-size reported `notifications/notification-center.tsx`
at 1021/1000 lines. Those gates are not claimed green and those files were left untouched.
Approval-owned production files remain within their source-size budgets. This is not a production
release or a claim that external rollout/approval evidence is complete. No commit or push was made.

The user's existing service at `http://localhost:4200/approvals/home` returned HTTP 200 and was
preserved. The separate 4324 verification server is stopped after the checks.
