# Resumed Meeting browser regression — 2026-09-07

Status: **CLOSED / FROZEN for the bounded browser-regression scope**. This is an implementation-regression record,
not approval that the implementation matches the received design 100%.

## Preserved source and reproducibility

- The historical `/tmp/dwp-meeting-*` runner files referenced by document 22 were
  no longer present after resumption. Their old outcomes were not relabelled as
  fresh verification.
- The retained export is
  `/Users/a10697/Downloads/stitch_enterprise_grid_calendar_application (10).zip`.
  Its SHA-256 remains
  `0a2fc4d7881a01f9b3ba0e6f164f3b9f980f8aa8afc53c29ea53afecb5d22787`.
- A fresh, read-only comparison copy was extracted to
  `/tmp/meeting-resume-source.ZVbtmr/stitch_enterprise_grid_calendar_application`.
- Original `screen.png`, `code.html`, node identities, source hashes, and visual
  error thresholds are unchanged. Updated application regression images, if any,
  are independent implementation baselines; they do not replace Stitch originals.
- Node 24, canonical Yarn Playwright `webServer`, isolated port 4484, two workers,
  Chromium and mobile WebKit. No pre-existing server was reused.

## First fresh owned-scope run

The seven owned specifications (desktop density, visual quality, preparation,
schedule management, schedule, workspace menus, and video meetings) scheduled
136 cases: **78 passed / 37 failed / 21 intentional project skips / 0 flaky**.
Evidence: `/tmp/meeting-resume-owned-r1.json`, 677.6 seconds.

Thirty-two failures reached PNG comparison: preparation 10, schedule 6, legacy
visual quality 14, and preferences 2. Five other failures were independently
investigated, not hidden by updating images:

1. Cold-start mobile pagination awaited a result for only five seconds although
   the captured failure DOM already contained the correct authoritative page.
   The readiness allowance is now 15 seconds; page size and server-bound page
   change assertions remain unchanged.
2. Mobile material validation text had moved into its visible disclosure summary.
   The test now selects that summary instead of the hidden desktop-only chip.
3. Provider/model evidence had two valid representations; the admin assertions
   now scope to the runtime-evidence disclosure and use exact text.
4. `Save policy` was a substring of the mobile review action. The command selector
   is now exact and still checks the actual persisted request and returned state.
5. The host prejoin/content-plan/room keyboard journey exceeded a 30-second test
   allowance in WebKit. It is a deliberately slow end-to-end journey; its boundary,
   commands, content removal, and keyboard assertions are unchanged.

Fresh targeted rerun: **18/18 passed**, `/tmp/meeting-resume-functional-r2.json`.
Preparation and native disclosure units: **25/25 passed**, two test files.

## Product defects found by direct image inspection

### U04 participant roster at 200% text

The roster reserved a fixed 64px name column even when the root font doubled.
English participant names became one word per line and response labels escaped
the column. The minimum width is now `4rem`, which keeps the original default
width but scales with text enlargement, and response text wraps inside its item.
The 200% E2E checks the actual item width and every text descendant's bounds;
global horizontal-overflow and accessibility assertions are retained.

### U07 narrow evidence inspector

At 1280px the compact five-stage pipeline used an icon and label side by side,
splitting ordinary English words (`Recording`, `Transcript`, `Published`).
Only the compact inspector now puts icons above labels. The five-stage order,
state evidence, full-size recap pipeline, and embedded mobile recap remain intact.
The legacy U07 E2E checks that ordinary stage words fit on one line.

## Full-document evidence is not the live viewport

The old full-page screenshots placed fixed mobile navigation or a save/action
dock halfway through a long stitched document. Some desktop captures also retained
a previous scrolled position. These were capture artifacts, not proof that the
live fixed action region should be removed.

`withMeetingDocumentCapture` resets document/main scroll. For a visible fixed dock
below 900px, it temporarily extends only the capture viewport to document height,
checks that the dock is at its bottom, takes the full-document image, and restores
the original viewport in `finally`. Live-viewport checks and viewport-only images
remain at their original dimensions. It does not hide content or change CSS.

Four helper regressions in each engine verify document-end placement, viewport
restoration after success/failure, no resizing of desktop evidence, and a deliberately
paused media clock: **8/8 PASS** in `/tmp/meeting-resume-legacy-evidence-r5.json`.
The paused-clock case exposed a test-helper issue: awaiting animation frames can
hang with mocked media time. The helper now flushes layout without advancing or
unpausing that clock.

Full-document and viewport screenshot assertions are independent soft assertions:
every mismatch still fails the case, but the first mismatch no longer suppresses
the second image or the remaining functional assertions. No pixel threshold changed.

## Design review boundaries

Source and actual images were opened directly, including U01–U05, U07, U10, and
U12 variants; the independent U08 owner inspected both recap variants. The source
workflow order, rounded surfaces, primary action hierarchy, selected work item,
and narrow-screen disclosure behavior are checked separately from business-state
differences. No manufactured participants, recordings, model confidence, security
certification, or unavailable capability is used to make an image look complete.

Remaining source differences are not reclassified as success: the shared DWP shell
differs from Stitch's sample shell, some source share/audit/official-version controls
lack owner-service contracts, and operational recording/provider availability
requires real governed infrastructure. Final screenshots must be described as
reviewed implementation evidence, not user-approved design originals.

## Narrowly reviewed implementation image changes

- U03/U04: directly inspected R1 and R3 actuals and corresponding Stitch sources
  before running the eight named screenshot cases in both engines with
  `--update-snapshots=changed`. **16/16 PASS**;
  `/tmp/meeting-resume-reviewed-u03-u04-r4.json`. Exactly sixteen pre-existing
  application PNGs were updated, not the approved-size source comparison images.
- Legacy and workspace evidence R5: **11 PASS / 15 PNG-only failures / 14 intentional
  skips / 0 flaky**. All 23 mismatched actual images (including first-viewport images)
  were directly opened before narrowly aligning those implementation baselines.
  Source U01/U02/U03/U04/U05/U07/U10/U12 pairs and the independent U08 review were
  used for comparison. U08 now includes the separately verified four-tab structure.
- R5 independently confirms both engines preserve the long edited schedule title
  across desktop/mobile width changes and 200% text. The input-value assertion is
  retained; a visually plausible screenshot alone cannot prove draft preservation.
- U14 and all other owners' baselines are excluded. The root owns the newer online
  U14 export and its independent source override; this record does not approve it.

## Fresh ten-frame source/actual audit

Each of the following ten source images and ten actual images was opened directly
from `/Users/a10697/Work/DWP/output/meeting-design-review-30-2026-09-07/`.
The gallery manifest preserves source-code/image hashes and the original ZIP identity.
The findings below distinguish visible layout from real data and unimplemented or
unverified capability. None of these comparisons is a pixel-identical approval.

| Frame               | Direct comparison                                                                                                                                                                                              | Remaining boundary or correction                                                                                                                                                                                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U06-D live room     | Dark shared stage, participant strip, right-side agenda/tools, timebox and bottom controls correspond to the studio composition.                                                                               | Actual is still connecting with no remote media, not the source's six-video, active screen-share session. Recording, live transcription, measured quality, speaker identity, and compliance badges must not be fabricated; connected-provider visual/operational verification remains open.                         |
| U06-M live room     | Fullscreen dark stage, participant strip, poll CTA, secondary controls and bottom mute/video/hand/chat/leave row are present.                                                                                  | One placeholder participant and a connection notice cannot certify the source's three active videos or raised-hand alert state. The connection banner is real state, not an approved substitute for the connected design.                                                                                           |
| U07-D library       | Filter workspace, selected result list and right inspector, five-stage evidence flow, summary, governed-media entry and recap CTA remain legible. Compact English stage labels no longer split ordinary words. | Actual counts/roles/content differ from sample records. Shared/review/publication/expiry filters, CSV export, independent-signature and permission-sharing actions are not fully provided by the current library contract. Disabled/unavailable copy does not close those feature gaps.                             |
| U07-M library       | Single actionable list, horizontal scope tabs, collapsible filter controls and bottom navigation follow the mobile list archetype.                                                                             | Direct inspection found a favorite button wrapping onto its own empty line. It is now a separate trailing grid column; the new geometry test also found the former 38px target, now explicitly 44px. Unsupported filter explanations and additional real-state copy still make the page less dense than the source. |
| U10-D templates     | Search/scope/category toolbar, selected left template, right overview, primary reservation action, ordered agenda and policy blocks align structurally.                                                        | Two rather than three agenda items and personal rather than organizational selection come from the authorized fixture. No organization certification, success rate, usage statistics or recommendation is invented. Shared shell typography and selected template content are not the source's exact pixels.        |
| U10-M templates     | Intro, search, scope/category chips, expanded selected template with timeboxes and reservation/preview, compact other templates, recommendation region and dock are preserved.                                 | Extra fourth record and two agenda slots are data differences. Real usage/success analytics and AI recommendation remain unavailable; their explanatory state is not completion of those capabilities.                                                                                                              |
| U11-D personal room | Identity/link/copy/QR and start/preflight hero, left access/rotation/device guidance, right current session/history/isolation explanation match the information hierarchy.                                     | Opaque revision-bound invitation replaces a vanity URL. Session polling/latency, editable policy and automatic AI defaults are not claimed without contracts. Rotation preserves the room identity and changes invitation revision rather than pretending to crypto-erase all prior session records.                |
| U11-M personal room | Identity/link/actions, start/preflight, current state, access policy, rotation, recent history and supplemental disclosure retain the source order.                                                            | The final Korean character in the invitation-copy button was isolated on a line. Local `keep-all` wrapping preserves complete words and the full accessible action name. Tests also retain current-revision clipboard content and zero automatic media/session creation.                                            |
| U12-D preferences   | Five section tabs, local/account separation notice, left audio/video/join/notification-language controls and right readiness/data guidance match the settings layout.                                          | Camera is deliberately off before consent; the source's live portrait, device brand, 14ms/0% metrics, named denoiser and compliance certification are not real evidence. Unsupported HD/background/STT-model controls remain explicitly unavailable.                                                                |
| U12-M preferences   | Audio, video, join defaults, readiness, supplemental disclosures and bottom save dock remain in the source order. All visible labels/actions fit the narrow column.                                            | WebKit native blur/noise suppression capability differs from Chromium; disabled controls and explanatory copy are required. Actual camera/mic activation, joined-device application and governed processing must be verified separately from a safe-off screenshot.                                                 |

All ten actual frames retain the shared DWP shell rather than the sample's independent
logo/header/sidebar. That is a deliberate integration boundary, not evidence of exact
source fidelity. The root's final U07-D/M and U11-D/M gallery recaptures (18:55 KST)
were also opened directly: the trailing favorite column and whole Korean `복사` word
are preserved in the final gallery, with no new overlap. Fresh targeted U07/U11 checks passed **16/16**, both engines at
320/390px in Korean and English (`/tmp/meeting-narrow-layout-r12.json`), including
authoritative bookmark mutation and current-revision invitation copying. All five
relevant actual images were opened after correction. The three affected U07 legacy
implementation images were then explicitly aligned: **2/2 PASS** in
`/tmp/meeting-reviewed-library-r13.json`. No U11 baseline was automatically updated.
The source archive, source images, source HTML, and comparison thresholds are unchanged.

## Final closure

The first full no-update closure attempt (R7) recorded **120 PASS / 3 FAIL /
21 intentional skips**. These failures were not counted as a completed green run:

- The recap desktop baseline had captured MUI's transient scroll arrows before
  its four-tab measurement settled. R5 and R7 actual images independently showed
  the correct arrow-free rail. An explicit zero-scroll-button wait and one reviewed
  realignment were insufficient: R10 reproduced the arrows **after** that wait.
  Independent U08 investigation reproduced stale IntersectionObserver entries after
  axe (root width 16 and stale Y, while the actual rail width was 1136 and overflow 0).
  The owner therefore added Meeting-local measured-overflow gating, preserving actual
  narrow/200% overflow controls. This was a runtime correction, not pixel tolerance
  relaxation or CSS hiding. U08's independent repeated screenshot/geometry checks and
  the subsequent full owned run exercise the correction with the same baseline.
- WebKit reported the pre-paint 64px roster width immediately after 200% font
  enlargement, despite a 32px root font. The same exact width/text containment
  assertions now poll for the finished layout; no bound is weakened.
- The root's newer U14 design opens one policy accordion at a time. The old
  editor helper opened three sections consecutively, hiding the earlier controls.
  Its single consumer now checks recording, edits collaboration, then edits retention
  through the actual sequential disclosures. Disabled recording, fail-closed Egress
  copy, policy validation, idempotency, and persisted request assertions remain.

The latter two corrections passed **4/4** fresh Chromium/WebKit cases in
`/tmp/meeting-resume-r7-corrections-r8.json`. The core helper used by other admin
tests is unchanged. `video-meetings.spec.ts` is now 1173 lines after this meaningful
policy-journey helper extraction; no size budget was increased.

Fresh related units: **87/87 PASS**, seven files: preparation, mobile disclosures,
schedule-workspace runtime, overlay focus boundary, history model, personal-room
runtime and personal-room model. The final extra three files contributed **35/35**.
Owned ESLint/Prettier/diff-check and i18n passed; the latest source-size check covered
**1799 production files**, four generated files excluded. Interim full typecheck
failures in concurrent Approvals and U08 test edits were reported to their owners,
not hidden or repaired outside ownership; the clean final rerun is recorded below.

R10 ended **122 PASS / 1 FAIL / 21 intentional skips**, the remaining U08 image issue
described above. R14 includes the new 16 U07/U11 cases and two root-owned sticky-dock
helper cases: **162 scheduled**. Source-matching updates in the root's U02 mobile
layout legitimately affect two existing implementation images; the root directly
reviewed both actual images before authorizing their specific alignment.

R14 ended **138 PASS / 3 FAIL / 21 intentional skips**. Besides the two U02 images
in one case, one mobile schedule capture contained the shell's transient loading
skeleton after its earlier content assertions; it was not accepted as a new baseline.
The 200% schedule capture exposed a late document reflow: height grew from 1725 to
1791px after the first viewport measurement, leaving the fixed dock 66px above the
document end. The capture helper now awaits font readiness and matching measured
heights, converges in at most four resizes, enforces the 32,000px ceiling and final
document/viewport/dock bounds, and restores the real viewport in `finally`. It does
not use a blind fixed delay. New tests verify resize-induced growth and bounded
failure with restoration when growth never converges.

R16 fresh one-worker no-update closure: **19 PASS / 1 intentional skip / 0 FAIL**,
27.7 seconds (`/tmp/meeting-final-corrections-r16.json`). This covers 14 helper cases,
both schedule regressions in both engines, and the root-reviewed U02 case. **Neither
schedule baseline was changed** to accommodate the two R14 capture failures.

## Owned final handoff paths

The shared worktree contains prior owners' unfinished changes. These are the specific
resumed-scope paths and small responsibilities, not a claim that every existing diff
in each file was authored in this resumed run:

- Product: `meeting-preparation-sections.tsx` (font-relative roster),
  `meeting-recap-pipeline.tsx` (compact inspector labels),
  `meeting-schedule-draft-controls.tsx` (dock identity only),
  `meeting-history.tsx` (metadata/favorite column and 44px target), and
  `meeting-personal-room.tsx` (whole-word invitation actions), all beneath
  `apps/dwp/src/features/meetings/`.
- Owned E2E: `video-meeting-desktop-density.spec.ts`,
  `video-meeting-visual-quality.spec.ts`, `video-meeting-preparation.spec.ts`,
  `video-meeting-schedule-management.spec.ts`, `video-meeting-schedule.spec.ts`,
  `video-meeting-workspace-menus.spec.ts`, `video-meetings.spec.ts`, and
  `video-meeting-document-capture.spec.ts`, all beneath `e2e/`.
- Support: `e2e/support/meeting-document-capture.ts`,
  `video-meeting-admin-intelligence-assertions.ts`, `video-meeting-admin-policy.ts`,
  and `video-meeting-room-assertions.ts`. The root's sticky-policy extension and
  corresponding test are preserved in the final helper. Existing interrupted-work
  support files `meeting-visual-focus.ts` and
  `meeting-implementation-regression-fixtures.ts` remain dependencies.
- Exactly 39 named existing implementation PNGs are enumerated with SHA-256 and
  directly reviewed actual evidence in `24-reviewed-image-manifest-2026-09-07.json`.
  U02's final two images were explicitly reviewed by the root. U14 and foreign
  baselines are excluded. No source archive or error threshold changed.
- This document and the adjacent compact browser-gate evidence JSON provide the
  durable handoff. Full ephemeral Playwright reports are also retained at the listed
  `/tmp` paths for immediate diagnosis.

Final complete owned-scope R17: **145 PASS / 21 intentional project skips / 0 FAIL /
0 flaky**, 166 scheduled across eight specifications, 225.814 seconds. Every executable
case passed in one fresh two-worker Chromium/WebKit run with `--update-snapshots=none`.
The exact command, per-file counts, skipped-case identities, prior failed checkpoints,
and report SHA-256 are preserved in `24-browser-gate-evidence-2026-09-07.json`.

Final non-incremental `corepack yarn typecheck --incremental false`: **PASS**, after
all helper/test changes. Source and maintenance budgets, scoped lint/format/diff,
i18n and architecture integrity: **PASS**. Architecture's separate operational
readiness remains **BLOCKED**, with 37 incomplete release evidence items; schema and
internal authorization integrity passing is not release approval.

No commits were created. Port 4484 is no longer listening, and this agent has no
running verification command or pending source/test/image edit. The parent owns
final integrated product/backend/Agent/build release decisions. The source fidelity,
unsupported contract and external infrastructure boundaries above remain explicit;
this handoff must not be described as 100% design or operational completion.
