# U07 / U08 navigation and candidate-review correction

## Scope and reference

This is the bounded follow-up to `09-review-U07-U09-2026-09-07.md`, not a claim that all Meeting screens or all production integrations are finished. The four supplied Records Library 07 and AI Recap Review 08 desktop/mobile PNGs and their HTML were read directly from the approved Stitch export. The previous application's canonical screenshots were compared separately and were not treated as the approved design.

- U07: participant looking for the right completed meeting; select a record and inspect its evidence; list/detail archetype.
- U08: participant examining confirmed decisions and their source; inspect an exact action candidate without silently creating work; evidence studio archetype.

The original user-approved navigation and information order take precedence over replacing them with a generic media dashboard. Existing source authorization and retention boundaries remain mandatory.

## Root cause and implemented correction

| Screen             | Cause                                                                                                                                                                                     | Correction                                                                                                                                                                                                                                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U07 desktop/mobile | Media format tabs replaced the approved audience/workflow navigation. The missing server projections were not distinguished from presentation choices.                                    | Restore All / I participate / Shared with me / Needs review / Favorites. All and confirmed membership operate on the current authorized page. Media becomes a secondary filter alongside period and organizer. Publication and retention remain explicit disabled axes until authoritative projections exist. Unsupported facet counts are not invented. |
| U08 desktop/mobile | Every action led to a generic workbench rather than the exact source candidate. The API already carried candidate ID, source version and action index, but the presentation ignored them. | Each valid published action has a read-only candidate review link with exact opaque meeting/report/candidate IDs. The destination reads the exact report, selects only its matching current-version candidate and preserves the Work-authority lock. Unknown candidates never fall back to another action or latest report.                              |
| U08 mobile         | The desktop analysis section preceded the user's next action and occupied substantial mobile scroll depth. Evidence explanations were repeated verbosely.                                 | DOM and visual order are summary/decisions, follow-up candidates, compact evidence, then expandable detailed analysis. Desktop analysis stays visible. The mobile disclosure retains topics, climate, questions and risks; expansion is keyboard accessible. Transcript details are expanded explicitly without changing their authorization check.      |

The candidate creation control remains disabled. A Meeting read/review capability is not Work command authority. Candidate assignee and due date are identified as unconfirmed, not filled from example people or dates. No new mutation, transcript logging, media URL exposure or inferred provider success was added.

## Exact candidate boundary

`meeting-recap-candidate-model.ts` requires the current meeting identity, a published participant-visible report, a safe version, unexpired retention or an authoritative legal hold, a valid opaque candidate ID, the same source version, and a unique action-index binding. Duplicate or ambiguous bindings are rejected. Retention expiry clears the candidate projection while the view remains mounted. The URL contains no action text, participant name or transcript content.

The source parser rejects duplicate identifiers, candidate without an exact report, invalid identifiers and a candidate selection mixed with review intent. A candidate dialog is a read-only view of the already authorized exact report, not a source of new access rights. Existing source refresh/revocation and identity-mismatch behavior is preserved.

## Unprovided server contracts at this owner's handoff

Restored but disabled controls are **not counted as implemented features**. On handoff, All and confirmed participation are current-page client facets, not global server search. Membership indicates an explicit registered role; it does not assert actual attendance.

| Axis           | Required authoritative contract                                                                                                                                                                                 | Acceptance boundary                                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared with me | Current viewer's effective sharing relation in the authorized library projection; server-side filtering and pagination.                                                                                         | Grant revocation must remove row and count together; no title/count disclosure across tenant or scope boundaries. Never infer sharing from `canHost === false`.                   |
| Needs review   | Pending report/version plus current reviewer eligibility and required action, derived from existing report authority.                                                                                           | Review rows and counts use the same current authorization predicate; publication or authority changes remove stale work. Meeting review rights never become Work creation rights. |
| Publication    | Current visible report ID/state/version metadata, not raw analysis or a guessed media badge.                                                                                                                    | Private drafts cannot reveal metadata to unauthorized participants; list and exact detail agree.                                                                                  |
| Retention      | Current viewer-safe retention deadline/hold/disposition metadata from the governed artifact/report projection.                                                                                                  | Expired content is removed or redacted before response; filters cannot bypass report or artifact checks.                                                                          |
| Favorites      | Authenticated-user bookmark persistence and a server `favoriteOnly` filtered history page. Proposed composite ownership is tenant/user/meeting with versioned idempotent updates; bookmarks never grant access. | Add/remove survives reload; pagination and count share the exact access predicate; revoke/cross-tenant/unknown meeting and concurrent changes are tested.                         |

The integrator assigned Favorites as a **separate active vertical implementation** after this owner reached a safe point. History UI/navigation/model ownership was handed to the root for connection to that new backend contract. This document records the handoff state, not the subsequent Favorites completion result. Shared/review/publication/retention axes remain distinct contracts; completing Favorites does not implicitly complete them.

## Visual review and limits

All four latest desktop/mobile document captures were viewed beside the corresponding supplied originals. The original navigation, individual result cards, list/detail split, decision/action tonal groups and mobile information order are represented. The U08 mobile review fixture is 2,309 CSS pixels high versus 3,189 in the prior application capture, a reduction of approximately 28%. This is a measurement of those fixed fixtures, not a pixel-fidelity score.

The original source contains example approved assignees/dates, compliance claims, independent-review detail and playing media that the current contract does not provide. Those are not fabricated. Current source fixture content, shared shell typography and additional legacy role/order filters still differ from the original. Therefore no 100% visual or functional parity claim is made. These review artifacts do not replace approved PNG baselines.

## Verification

- Node 24 clean `corepack yarn typecheck --incremental false`: PASS, zero errors.
- Three targeted model suites: 43/43 PASS, covering membership, strict report references and candidate bindings/expiry/ambiguity.
- Scoped ESLint: PASS, zero errors. Prettier applied only to owned files.
- Global source-size: PASS, 1,764 production files checked. i18n: PASS after the integrator merged new keys into the correct `designReview.recap` group.
- New audience-navigation/exact-candidate/mobile-priority browser journeys: 10/10 PASS, Chromium and mobile WebKit, 52.8 seconds. The existing U08 mobile-priority journey includes 320px, 200% text, forced colors, disclosure state and accessibility checks.
- Four source-review captures: 4/4 PASS, with no blocking axe violations, horizontal overflow or runtime exceptions, 24.4 seconds. Files: `/tmp/meeting-library-recap-source-review-0907-final/`.
- Exact-source security regression: 40/40 PASS, Chromium and mobile WebKit, 1.6 minutes. Covers exact source selection across tabs/reload, 403/404/410/503 with retry and no latest substitution, immediate cached-content concealment during revoked refresh, identity mismatch, private/draft/deleted/null reports and malformed references. Files: `/tmp/meeting-recap-source-0907-final/`.

The initial browser invocation was 5 PASS / 5 FAIL: a locale merge placed eight labels under the wrong group, and two test locators used an outdated candidate UUID/filter label. The integrator corrected the locale group; this owner corrected the test identities to the actual contract. The fresh 10/10 run used no retries and no screenshot baseline update. The initial failures are not counted as passes.

### Reproduction

Use the bundled Node 24 prefix `PATH=/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH`.

```sh
corepack yarn typecheck --incremental false
corepack yarn vitest run apps/dwp/src/features/meetings/meeting-history-model.test.ts apps/dwp/src/features/meetings/meeting-recap-source.test.ts apps/dwp/src/features/meetings/meeting-recap-candidate-model.test.ts
E2E_BASE_URL=http://127.0.0.1:4471 E2E_REUSE_EXISTING_SERVER=true PLAYWRIGHT_OUTPUT_DIR=/tmp/meeting-library-recap-closure-0907-final corepack yarn playwright test e2e/video-meeting-library-recap-navigation.spec.ts e2e/video-meeting-mobile-priority.spec.ts --grep 'library restores|each published|unknown candidate|mobile keeps|U08' --workers=1
E2E_BASE_URL=http://127.0.0.1:4471 E2E_REUSE_EXISTING_SERVER=true PLAYWRIGHT_OUTPUT_DIR=/tmp/meeting-library-recap-source-review-0907-final corepack yarn playwright test e2e/video-meeting-design-review-20.spec.ts --grep 'U07|U08' --workers=1 --update-snapshots=none
E2E_BASE_URL=http://127.0.0.1:4471 E2E_REUSE_EXISTING_SERVER=true PLAYWRIGHT_OUTPUT_DIR=/tmp/meeting-recap-source-0907-final corepack yarn playwright test e2e/video-meeting-recap-source.spec.ts --workers=1 --update-snapshots=none
node scripts/check-source-size.mjs
node scripts/check-i18n.mjs
```

No common shell, backend/API generator, baseline, operating data or production runtime was changed by this bounded correction. The separate port 4471 uses the root-owned test-only isolated Vite cache configuration. No commit was created.
