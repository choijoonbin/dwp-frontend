# Meeting full regression triage — 2026-09-07

This records implementation regression evidence, not user approval or 100% fidelity
to the immutable Stitch originals. Original ZIP, node, screen, and code hashes and
visual error thresholds remain unchanged. No screenshot was updated in the first run.

## First complete run

Node 24.19.0 / Yarn 4.17.1, fresh isolated Vite port 4482, two workers:

```sh
DWP_FRONTEND_DEV_PORT=4482 E2E_BASE_URL=http://127.0.0.1:4482 \
E2E_REUSE_EXISTING_SERVER=true \
MEETING_STITCH_EXPORT_PATH='/Users/a10697/Downloads/stitch_enterprise_grid_calendar_application (10).zip' \
PLAYWRIGHT_OUTPUT_DIR=/tmp/dwp-meeting-all-regression-20260907-r1 \
PLAYWRIGHT_JSON_OUTPUT_FILE=/tmp/dwp-meeting-all-regression-20260907-r1.json \
corepack yarn playwright test video-meeting --project=chromium --project=mobile \
  --update-snapshots=none --workers=2 --reporter=json
```

37 spec files, 502 scheduled cases: **375 passed / 59 failed / 48 intentional skips /
20 not run after a serial predecessor failure**, zero flaky results, 591.7 seconds.
The JSON aggregates the last two groups as 68 skipped. Intentional project ownership
skips are not mobile coverage; 17 of the 19 legacy visual declarations own explicit
Chromium viewport dimensions. The 20 serial omissions were 18 visual-quality cases
and both U14 admin-surfaces cases. They must be run independently before closure.

## Failure classification before correction

Line numbers below are from the first-run JSON and may move after test edits.
The 26 PNG-only failures reached screenshot comparison without another assertion
error; that alone does **not** establish that the received image is correct.

| Class / owner                                                   |  Count | Exact first-run evidence and next verification                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------- | -----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PNG-only; review before changing implementation baseline        |     26 | admin-intelligence-visual:169; follow-ups:468/544/680; live-facilitation:338; personal-room:279; preparation:255/332/498/528; schedule:83/177/430; visual-quality:305; workspace-menus:245. Per-project identities and actual/expected/diff paths are in the JSON.                                       |
| Admin legacy structure/disclosures; root                        |      9 | admin-recording-policy:42 mobile `Allow recording` hidden; admin-stitch-content:46 four viewport cases expect 7 regions but get 8 including policy boundaries; :151 both projects expect seven open but mobile core four are open; admin-surfaces:77 both projects expect removed `User impact` heading. |
| Desktop-density legacy expectations / one runtime investigation |      4 | desktop-density:48 both projects use an unscoped duplicate page-filter message; :10 mobile rejects the approved hero accent gradient; :10 Chromium did not find the hero and requires independent re-run, not automatic dismissal.                                                                       |
| Work command evidence; root                                     |      3 | follow-ups:362 Chromium/mobile and :387 Chromium cannot find `Command application confirmed` after a command. Investigate receipt lifetime across collection revalidation before changing assertions.                                                                                                    |
| Intelligence selector scope; recap owner                        |      2 | intelligence:92 Chromium finds two recap buttons; mobile finds two `Published` labels. Scope to the selected meeting/report, retaining review, publish and revoked-access checks.                                                                                                                        |
| Preparation disclosure workflow                                 |      4 | preparation:295 both projects assume checklist initially open; :360 mobile helper text is hidden; :389 mobile material access button is inside a closed disclosure. Open the actual control and retain exact mutation/access assertions.                                                                 |
| My-meetings selected inspector workflow                         |      2 | schedule-management:151/:177 mobile expects management before selecting a row. Select the bound meeting into its dialog before the fenced schedule/cancel command journey.                                                                                                                               |
| Transcript access journey; recap owner                          |      2 | transcript:124 both projects cannot find access CTA. Verify active result tab and authorization before classifying missing functionality.                                                                                                                                                                |
| Newly implemented native background capability                  |      1 | workspace-menus:245 Chromium expects `Soft blur` disabled although supported local blur is now implemented. Assert supported local preference behavior and no media acquisition instead. Unsupported office/image choices remain disabled.                                                               |
| Live-room keyboard boundary                                     |      2 | video-meetings:308 both projects expect close → reverse Tab → textarea, omitting the new shared roving rail. Investigation also exposed a real inactive-tab focus wrapping defect, corrected below.                                                                                                      |
| Recap target / admin selector and disclosure scope              |      4 | video-meetings:891 both projects find multiple recap buttons (ended, cancelled, selected inspector); :1024 Chromium finds two governance notices, mobile notice is inside its disclosure. Retain cancelled disabled state and recording governance assertions.                                           |
| Total failed                                                    | **59** | 26 PNG-only + 33 other failures. No assertion is waived merely because the screen was previously called complete.                                                                                                                                                                                        |

## Confirmed live overlay correction

`meeting-overlay-focus-boundary.ts` used a union selector whose general `button`
branch included `tabindex=-1` inactive rail tabs; its `[tabindex]` branch also admitted
disabled elements. Forward wrapping could focus inactive Agenda rather than the
selected Chat tab. This is a real keyboard defect, separate from the obsolete test
assumption about Close being the first control.

- New unit first failed with actual `Inactive agenda` versus expected `Selected chat`.
- The candidate predicate now excludes negative tab index, disabled, hidden/inert,
  and CSS-hidden/transparent controls and ancestors.
- Unit: 4/4 PASS after correction.
- Actual host content-plan → private entry → room → mobile overlay flow: 2/2 PASS
  on Chromium and mobile; `/tmp/dwp-meeting-focus-product-r2.json`.
- E2E checks Close → reverse Tab → selected rail Chat → reverse Tab → textarea →
  Tab → selected Chat, then independently tests Escape focus restoration. WebKit's
  platform-dependent interior button traversal is not confused with the boundary.

## Remaining work

Independent legacy visual execution, per-failure source comparison, narrowly scoped
test/fixture corrections, reviewed implementation PNG updates, and a final full
no-update run remain pending. This document must not be cited as an all-green result.
