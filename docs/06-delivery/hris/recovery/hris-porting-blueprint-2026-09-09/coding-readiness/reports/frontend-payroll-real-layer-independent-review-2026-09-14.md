# PAY actual layering — independent source review, 2026-09-14

Result: source-layer separation and existing valid-input behavior are supported; **three preexisting P1 groups and one native-adapter OPEN boundary remain**. No new layering regression was found. This is not whole PAY/FE/native PEP or G3 approval; G3 remains CLOSED_FAIL_SAFE. No correction was applied.

## Exact scope and actual evidence

Integration frontend HEAD `aaeba79eefae7cc2d1ba6151f47fa9e891a75bfd` is an uncommitted root-owned layering worktree, not a clean-source release. Eight PAY files were read completely: public index, API+test, hook, model+test, page, runtime test. AGENTS and its two detailed product documents (274/248 lines) were read by this reviewer in full; original profile/IA/copy/layout/route and authority boundary are preserved. Root-owned browser QA test/config are excluded from this independent pin/replay scope.

Fresh installed Node v24.19.0 argv:

```text
/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run --project dwp-app apps/dwp/src/features/hris/payroll/ --maxWorkers=1 --reporter=json
```

Actual UTC 2026-09-14T09:24:01.736961+00:00 → 2026-09-14T09:24:09.666387+00:00, 7.929496s: exit0, three physical test files, 25 unique cases, passed25/failed0/pending0. The 23 selected PAY/config/rule/common/helper source SHA and exact decimal mtimeNs values match before/after. Host lock requested/acquired 2026-09-14T09:24:01.728Z, released 2026-09-14T09:24:09.672Z; wait0ms. Exact argv/cases/raw stdout+stderr gzip archives/pins are in the JSON.

All author25 IDs and original baseline23 remain. Author baseline timeout executed0 and stays excluded. Saved author whole-TypeScript + seven quality results and their raw hashes were verified, not rerun or inherited as native/G3 approval. Saved HRIS AST still fails: 32 unclassified / 45 errors, PAY errors0 only.

## Preserved contracts

The old public exports/default, `/hr/pay` route, Gateway `/api/people/v1/hr/pay` path and source copy remain. API source bytes and PAYROLL_COPY/downloadStatement initializers equal HEAD. The hook retains the full authority cache key/meta, ready gating, AbortSignal and 60-second staleTime. Existing late-response25 proves old scope data is not revived.

For valid primitive inputs, the explicit cycle projection drops sensitive extras and source object identity; page/cache receives the model, not employee/monetary transport data. A repository read-only search found no other non-test `hcm/pay` cache consumer. This does not certify future/unpublished consumers or server field policy. The current route provides no download callback and correctly shows disconnected guidance.

## Reproduced gaps and smallest corrections

| ID | Actual counterexample | Narrow correction |
| --- | --- | --- |
| FE-PAY-P1-001 | Wrong wire `downloadable='false'` yields DOWNLOADABLE/action; redaction string displays Yes. Object in declared cycle.name retains nested data/reference in model/cache. | Runtime exact leaf codec before projection: real booleans/strings/arrays/date values/data-origin; reject without coercion/defaults, then copy primitives. |
| FE-PAY-P1-002 | Valid statement A/B downloads overlap; B replaces A progress and A settlement clears still-pending B. | Per-statement operation token/state, or explicit all-action single-flight; clear only matching token. |
| FE-PAY-P1-003 | Real shared GET removes caller abort listener/timeout after headers, before deferred body read; caller abort leaves fetch controller active and API later resolves. | Keep body parsing inside abort/timeout lifecycle; classify body-read ABORT/TIMEOUT consistently; common owner correction, not PAY8 mutation here. |
| FE-PAY-OPEN-004 | Authority remount clears UI but an old external callback can finish a side effect. | Keep native handler disabled until pay-purpose/current authority+owner-ref/refetch/signal-or-lease contract exists. Source flag is not authority; autogrant0. |

Pointers: model lines89/118/122, page lines108–120 and78, shared axios lines333–337, route hcm.tsx135. Exact files/lines and branch closing tests are in JSON. Wrong-wire tests are synthetic malformed responses, not an observed native catalog/grant/PII vulnerability. Nested object **screen disclosure is not claimed**: React rejects object children; model/cache retention is what was proved.

All three P1 groups existed at HEAD: old model already used truthy booleans/direct cycle objects; old download initializer is exact equal; current shared HTTP source is byte equal HEAD. They are not newly introduced layering regressions. React Query rekey protects UI from old query revival despite the shared full-body cancellation gap.

The dedicated [counterexample driver](frontend-payroll-real-layer-independent-counterexamples-2026-09-14.cjs) executes actual TypeScript source in memory, actual ReactDOM/jsdom state, and explicit visual/query/i18n/env/tenant/locale/fetch mocks. Final actual replay exit0 UTC 2026-09-14T09:29:44.555463+00:00 → 2026-09-14T09:29:47.159332+00:00, source11 SHA/ns stable. It asserts counterexamples/controls; these are not additional PASS counts or native journeys. Installed-runtime source/driver hashes and complete raw archives are preserved in the JSON.

## Remaining boundary

Root may independently replay these frozen counterexamples and apply narrowly scoped corrections without changing layout/IA/public behavior or weakening permission guards. Re-run all existing25 plus typed invalid-leaf, concurrency settlement and full-body abort tests. Native statement purpose/owner binding, current PEP/download receipt, other modules' layering and global Gate approval remain separate OPEN work. No production SQL, BE/main, canonical/Gate or historical report bytes were changed.

