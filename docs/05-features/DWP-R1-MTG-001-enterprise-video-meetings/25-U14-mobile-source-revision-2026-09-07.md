# U14-M approved source revision, not an implementation approval

The same Stitch node `7baadb2159e3411db77faaadb0dc52f5` was selected again in the
[user-provided project](https://stitch.withgoogle.com/projects/13391261371843159731).
The September 7 export changes mobile policy composition: four section chips,
section 01 expanded, and sections 02–04 represented as compact accordion summaries.

The existing September 4 `(10).zip` SHA and all 30 original source tuples remain
unchanged. The active U14-M contract has an explicit revision override, with its
old PNG/HTML/raster metadata retained in `sourceArtifactHistory`. U14-D and the
other 28 active source frames are unchanged. No implementation golden hash or
PNG was edited by this source-provenance task.

| Artifact                | Exact evidence                                                                 |
| ----------------------- | ------------------------------------------------------------------------------ |
| Download                | `/Users/a10697/Downloads/stitch_enterprise_grid_calendar_application (15).zip` |
| ZIP SHA-256             | `39425824a002e9c551df53975828723c0d91b120c9fb3c231df1812a78f351bb`             |
| Root entry `code.html`  | `cc8fd54553f03ff22d05f7cf70b685553b4d7837345b90c80a3c58f280344ff0`             |
| Root entry `screen.png` | `52afa62d0ac12f37fb50ee9e7ffcb1577251e79333bbbc3288f420efd92f744e`             |
| Source raster           | 390 × 942                                                                      |
| Existing extraction     | `/tmp/meeting-latest-policy.IgHgMe`                                            |

The loader reads ZIP entries in memory and checks the archive, PNG, HTML and
raster independently. It does not modify/extract an archive, execute source HTML,
or start a browser/Vite server. Negative regressions reject an older archive
substituted for the revision and mismatched code, PNG or raster evidence. The old
U14-M entries are also verified from the original ZIP, not inferred from strings.

```sh
MEETING_STITCH_EXPORT_PATH='/Users/a10697/Downloads/stitch_enterprise_grid_calendar_application (10).zip' \
MEETING_STITCH_U14_M_EXPORT_PATH='/Users/a10697/Downloads/stitch_enterprise_grid_calendar_application (15).zip' \
PLAYWRIGHT_OUTPUT_DIR=/tmp/meeting-source-revision-traceability-0907 \
PLAYWRIGHT_JSON_OUTPUT_FILE=/tmp/meeting-source-revision-traceability-0907.json \
corepack yarn playwright test --config=e2e/meeting-source-traceability.config.ts \
  --project=chromium --project=mobile --workers=2 --reporter=json
```

Result: **68 PASS, 0 fail, 0 skip**, latest run 4.8 seconds, using the two named
Playwright projects without launching browsers. The JSON result preserves 60
frame attachments (30 frames × 2 projects), all with source bytes verified; both
U14-M attachments reference `(15).zip` and retain the old source in history.
Scoped ESLint, Prettier and diff checks pass.
When the original-archive verification environment is enabled, omitting the
latest override archive fails closed. Without local source archives, attachments
explicitly say source bytes were not verified; the two archive-dependent revision
tests are skipped rather than claiming source verification.

The review-gallery builder must separately select the latest U14-M source and
record its archive/revision/code hash alongside the earlier source version.
Gallery regeneration and the new implementation screenshot remain the root
integration task's responsibility. These provenance results do not assert visual
parity with the newly revised design.
