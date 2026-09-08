# U08 recap tab-rail stability — 2026-09-07

## Scope and evidence

This bounded correction addresses the U08 desktop tab rail changing after an accessibility scan and full-document capture. It does not replace the approved design, change recap content, grant evidence access, or claim that all production integrations are ready.

The independent visual run `/tmp/meeting-resume-owned-final-r10.json` reported 122 passed, one failed, and 21 skipped cases. Its only failure was the English dark 1440px U08 recap image: two unexpected scroll controls shifted the four tabs by 40px. The established implementation baseline already had the four intended tabs without controls. Neither that baseline nor its comparison threshold was edited by this task.

Directly reviewed actual: `/tmp/meeting-resume-owned-final-r10/video-meeting-visual-quali-0a14e-at-1440px-English-dark-mode-chromium/meeting-recap-published-en-1440-dark-actual.png`.

## Reproduction and cause

- Without the accessibility scan, three independent runs with six full-page captures each retained zero controls and zero horizontal overflow.
- With the same scan followed by capture, two of three runs reproduced the shift. `/tmp/dwp-u08-rail-diagnostic-r2.json` contains 45 geometry observations: the scroller's current overflow remained zero, while the first tab moved from x=282 to x=322 and the control count changed from zero to two.
- Temporary diagnostic `IntersectionObserver` instrumentation recorded a stale/transient 16px-wide intersection root, whereas the current measured scroller was 1136px wide. The first/last tab entries could report nonintersection despite current content fitting.
- MUI's scroll-control observer consumes `isIntersecting`; it does not independently require actual horizontal overflow. This explains the retained controls after the transient entry. The reproduction establishes the scan/capture sequence, not that every ordinary user interaction causes the same transient geometry.

The temporary diagnostic observer was removed from the final regression. No screenshot-only class, CSS hiding rule, fake clock advance, source replacement, or golden-image promotion is used to fix the rail.

## Production correction

`MeetingRecapTabs` permits MUI's normal `auto` scroll controls only when the current tab-list width exceeds the available root width, excluding root padding and allowing 1px rounding tolerance. The available width is measured before controls consume space, avoiding a self-sustaining control-width feedback loop.

ResizeObserver watches the root and list; window resize, font readiness, and font completion trigger remeasurement. Hidden zero-width layout is not accepted as proof that the content fits. Cleanup disconnects observers/listeners and ignores late callbacks. Width comparison does not assume positive `scrollLeft`, so the permission calculation is direction-independent. Actual narrow or enlarged-text overflow keeps the normal MUI controls and keyboard behavior.

Production changes are limited to:

- `apps/dwp/src/features/meetings/meeting-recap-tabs.tsx` — new local measured-overflow wrapper.
- `apps/dwp/src/features/meetings/meeting-recap-detail.tsx` — use the wrapper in place of the existing Tabs component; existing selection, four-tab contract, labels, panel targets, permissions, and styling remain intact.

Other changes:

- `apps/dwp/src/features/meetings/meeting-recap-tabs.runtime.test.tsx` — six focused runtime cases.
- `e2e/video-meeting-recap-tab-stability.spec.ts` — actual browser geometry and responsive behavior regression, with evidence captures but no snapshot baseline.
- This review record.

## Verification

All commands use the bundled Node 24 runtime on PATH and canonical Yarn. The isolated Vite server uses existing `e2e/support/meeting-design-review.vite.config.ts` on port 4476; no server configuration was changed.

```sh
corepack yarn vitest run apps/dwp/src/features/meetings/meeting-recap-tabs.runtime.test.tsx --maxWorkers=1
node scripts/check-source-size.mjs
corepack yarn eslint apps/dwp/src/features/meetings/meeting-recap-tabs.tsx apps/dwp/src/features/meetings/meeting-recap-tabs.runtime.test.tsx apps/dwp/src/features/meetings/meeting-recap-detail.tsx e2e/video-meeting-recap-tab-stability.spec.ts
E2E_BASE_URL=http://127.0.0.1:4476 E2E_REUSE_EXISTING_SERVER=true PLAYWRIGHT_OUTPUT_DIR=/tmp/dwp-u08-rail-final-r7 PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/dwp-u08-rail-final-r7.json corepack yarn playwright test e2e/video-meeting-recap-tab-stability.spec.ts --project=chromium --project=mobile --workers=1 --update-snapshots=none --repeat-each=3 --reporter=line,json
```

- Unit: **6/6 passed**. Covers fitting content, narrow/expanded resizing, font/list growth, hidden geometry, RTL width handling, and disposal/late callback rejection. The two mock getter functions explicitly type `this: HTMLElement`; production code was unchanged by that compile correction.
- Scoped ESLint: **passed**.
- Source-size: **passed**, 1,798 production files checked and four generated files excluded.
- First final browser run `/tmp/dwp-u08-rail-final-r4.json`: **12/12 passed**, zero skips, failures, or flaky cases, 45.1 seconds. Chromium and mobile WebKit each run both cases three times. All 36 desktop full-page captures retain zero controls and zero overflow after keyboard focus and axe; 90 recorded geometry observations preserve the first-tab x=282.
- The responsive case checks all four tabs at 390px and 320px, genuine overflow controls, keyboard selection via End/Enter, 200% root text enlargement, no document horizontal overflow, and no blocking axe findings. Returning to 1440px removes controls while preserving selection.
- Final evidence additions capture the actual 320px/200% rail itself as well as the viewport, after normal center scrolling and an explicit clearance assertion above the fixed mobile dock. The viewport and rail detail were directly reviewed in Chromium and mobile WebKit; the narrow rail remains horizontally scrollable rather than shrinking enlarged labels.
- Intermediate `r6` had 10 passed and two recap-readiness failures during concurrent shared HMR/load: the default five-second summary assertion expired, then the failure context already contained the expected summary. The initial zero loading-spinner count can precede lazy route mounting. The final helper therefore waits for actual recap content with the same bounded 15-second page-readiness budget; geometry/accessibility assertions were not relaxed.
- Final `/tmp/dwp-u08-rail-final-r7.json`: **12/12 passed**, zero skips, failures, flaky cases, or retries, **70.96 seconds**. Its 90 geometry observations retain arrows=0, overflow=0, and first-tab x=282; all 36 full-document captures and six enlarged-text viewport/detail pairs completed. This final run includes the actual-content readiness and dock-clearance checks.
- Scoped Prettier and `git diff --check`: **passed**. Production has been frozen since the measured-overflow correction; final refinements affect only tests and this record. The owned port 4476 server was stopped after verification.

These are deterministic fixture-backed UI regressions, not a live recording/transcription/LLM integration certification. The independent legacy screenshot gate and central clean typecheck/build remain owned by the integration agents.

## Source integrity

Rechecked approved source PNG SHA-256 values, unchanged:

- U08-D: `f2b8156e20111a211ccc876e02669ab56492cc35a48407dddd434ca9414a9c5b`
- U08-M: `e5bf93d863b7ac6553935999578e70d1a100cec91ca3e39492672b80a7aad5ff`

The files are under `/Users/a10697/Work/DWP/output/meeting-design-review-30-2026-09-07/source/`. This correction modifies no approved source, implementation golden PNG, global threshold, generated contract, backend, Agent, or unrelated product file. Previous U08 authority/transcript revocation and U09 delayed-receipt/403 evidence remain documented in reviews 23 and 26; their behavior is not relaxed here.
