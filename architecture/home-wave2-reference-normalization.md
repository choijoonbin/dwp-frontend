# Home Wave 2 accepted-reference normalization

## Purpose

The 33 accepted source PNGs are visual and behavior references exported at heterogeneous pixel
dimensions. Their bitmap widths range from narrow mobile exports to enlarged review boards, and the
common 1600px height is an export characteristic rather than a shared CSS viewport. A raw
same-coordinate pixel diff would therefore compare export scale and canvas length as if they were
product differences.

This method creates a deterministic geometry record for each accepted-source and implementation
pair. It does not alter, resample, crop, or rewrite the accepted source files. It also does not make
an automatic visual acceptance decision.

## Inputs and integrity gates

The script reads these existing records:

- `architecture/home-wave2-design-source-registry.v1.json` for all 33 canonical IDs, accepted PNG
  paths, dimensions, and SHA-256 hashes.
- `architecture/home-wave2-evidence.v1.json` for the paired implementation screenshot, its hash,
  and the CSS viewport used for capture.
- The accepted package root supplied with `--source-root`, or the preserved workspace package found
  by the script's documented default lookup.

Before calculating geometry, the script requires a one-to-one ID set, reads dimensions from each
PNG IHDR header, and verifies both source and implementation hashes. A missing record, duplicate ID,
dimension mismatch, or hash mismatch stops the run. The script only writes when `--write` is passed,
and that output must remain an unsealed review artifact until the associated screenshots are final.
A normal run requires each implementation hash to match the sealed evidence manifest. During a
redesign review, pass `--allow-unsealed-implementation=true`; the report then marks each changed
screenshot as `MISMATCH_UNSEALED_SCREENSHOT` and remains ineligible for sealing.

## Canonical coordinate system

For pair `i`, let `Vw × Vh` be the CSS viewport recorded in the evidence manifest, `Sw × Sh` the
accepted source bitmap, and `Iw × Ih` the implementation bitmap.

Each image is independently width-normalized into the evidence CSS coordinate system:

```text
source scale         = Vw / Sw
source full height   = Sh × source scale
implementation scale = Vw / Iw
implementation height= Ih × implementation scale
```

The operation preserves aspect ratio and anchors both images at the top left. It removes export
scale from the comparison while retaining document-length differences. The report records overlap
height and each image's unmatched tail; an implementation cannot appear closer merely because it
is shorter or longer.

Browser zoom and text zoom remain explicit viewport metadata. For example, the C05 browser-zoom
reference uses its recorded 720 CSS pixel layout width. The method never infers browser zoom from
the PNG width.

## Required pairwise views

Reviewers use three views for every pair:

1. **First viewport, top crop.** Width-normalize both images and compare the first `Vh` CSS pixels.
   This checks whether the shell, first operational notice, hero, primary action, and start of the
   next section occupy the intended priority.
2. **Full document, top aligned.** Compare the width-normalized images through their shared height,
   then inspect the reported source-only or implementation-only tail. This checks section order,
   density, and document length without stretching either image.
3. **Contain overview.** Fit the complete image inside `Vw × Vh` and ignore the letterbox area. This
   is an orientation and large-composition aid only. It cannot establish spacing, type size, or
   first-viewport parity.

The report also records a top-anchored cover transform for a named semantic region. Cover is allowed
only after the reviewer names the region and confirms that the crop excludes no required content.
It must never be used as whole-page acceptance evidence.

## Decision tolerances

The reviewer input follows `architecture/home-wave2-reference-review.schema.json`. Each canonical
ID has separate first-viewport and full-document landmark decisions plus an overall decision. A
review stays `PENDING` until every landmark is explicitly `PASS` or `FAIL`; changing only an axis or
overall label is rejected.

A PASS must satisfy all of these limits:

- maximum measured landmark drift: 24 CSS pixels on desktop and 16 CSS pixels on mobile, on each
  axis;
- horizontal overflow: 0 CSS pixels;
- missing required landmarks: 0;
- section-order changes: 0;
- unexplained normalized document-height delta: at most 0.10.

If the raw normalized height delta exceeds 0.10, a PASS also requires a named applied adaptation
from that canonical ID's allowlist. The reviewer must reduce the _unexplained_ delta only after
documenting the exact dynamic-content or reference-export difference. An adaptation cannot excuse a
missing landmark, a changed order, overflow, or first-viewport drift above the limit.

Final PASS or FAIL records require findings for every landmark and both axes, reviewer identity and
time, and the exact source and implementation hashes reviewed. A PASS over a screenshot whose hash
has not yet been updated in the evidence manifest is recorded as `REVIEW_PASS_UNSEALED_INPUTS` and
remains ineligible for sealing.

## Semantic landmark review

Geometry is necessary but insufficient. The reviewer records findings for these landmarks where
they exist:

- application shell and navigation allocation;
- operational notice or priority hero and its primary action;
- approved 18-app composition and group order;
- primary work, news, or time-flow region;
- support/state region, including provenance and recovery action;
- footer or mobile navigation clearance.

Color hierarchy, typography, localization, interaction state, focus, content meaning, and source
placement are judged at the corresponding normalized landmark. A pair can fail even when its
dimensions are similar. Conversely, the script never promotes a pair to pass because its height
ratio is close.

## Command

From the frontend repository root:

```bash
node scripts/home-wave2-reference-normalization.mjs \
  --source-root=/absolute/path/to/dwp-home-implementation-readiness-2026-09-15 \
  --allow-unsealed-implementation=true \
  --write=/tmp/home-wave2-reference-normalization.json
```

Omit `--write` to emit JSON to stdout. The deterministic output contains every canonical ID, both
paths and hashes, both actual PNG dimensions, the evidence CSS viewport, first-viewport crop,
contain/cover geometry, normalized full heights, and unmatched tails. Regenerate it after any
implementation screenshot changes and before evidence sealing; do not edit the accepted registry,
accepted PNGs, or sealed evidence manifest to make a comparison pass.

Initialize the reviewer record once, then build the durable pairwise report and an optional local
contact sheet:

```bash
node scripts/home-wave2-reference-review.mjs \
  --normalization=/tmp/home-wave2-reference-normalization.json \
  --init-review=architecture/home-wave2-reference-review.v1.json

node scripts/home-wave2-reference-review.mjs \
  --normalization=/tmp/home-wave2-reference-normalization.json \
  --review=architecture/home-wave2-reference-review.v1.json \
  --write=architecture/home-wave2-reference-comparison.v1.json \
  --contact-sheet=/tmp/home-wave2-reference-contact-sheet.html \
  --source-root=/absolute/path/to/dwp-home-implementation-readiness-2026-09-15
```

The initializer refuses to overwrite reviewer work. The HTML contact sheet references the two input
files directly and shows a width-normalized first-viewport crop and full-document pair; it creates no
derived bitmap and changes neither input. After every record is reviewed, rerun with
`--require-reviewed=true`. A final seal is eligible only when all 33 records PASS and all current
implementation hashes match the evidence manifest.
