# PER frontend request-settlement remediation — 2026-09-14

## Scope and gate boundary

- Scope: `apps/dwp/src/features/hris/performance` only.
- No backend, Docker, database, authority catalogue, Native PEP/CAS, route permission, commit, or Gate state was changed.
- These are mocked frontend contract tests and scoped static checks. They do not open G3 and do not establish native authorization.

## Actual failure-first proof

The unchanged production hook was exercised after adding exactly two runtime counterexamples:

1. An A-scope mutation starts, the UI visits B and returns to A, then the mutation from the first A visit settles late.
2. A GET that started before a successful mutation settles afterward with version 3 and attempts to replace the mutation's version 4 cache value.

The lossless run from `2026-09-14T11:54:07.724679Z` to `2026-09-14T11:54:13.242276Z` produced 62 total assertions: the existing 60 passed and only the two new counterexamples failed. There were no skipped tests or timeout, and all 17 pinned sources were stable. Receipt SHA-256: `49c635dead946a9131a0f2d7142d56c64fecd41f30167e1ea60c06063a0519c5`; compressed archive SHA-256: `2bea97c26f8a68e5dd99881d538e855960a9fe96ca38d6f2a4c7393ae2445232`.

## Minimal production remediation

Only the performance hook changed for the race repair:

- Each committed request-scope visit now receives a monotonic generation, so returning from A through B to A cannot make a response from the first A visit current again.
- Read settlement captures both scope visit and settlement generation. A superseded read can retain an already-current projected cache value but cannot publish its stale response.
- Saving advances the settlement generation and cancels the exact personal-goals query before governed mutation execution.
- Successful mutation settlement advances the generation again, cancels the exact query, then stores only the already-existing strict display projection.
- Mutation success, mutation failure, and conflict reload all verify the same visit/settlement boundary before changing cache, draft, or toast state.
- The existing `personal-goals-v2` cache namespace, strict privacy selector, governed command authority callback, optimistic-CAS version field, 403/409 classification, AbortSignal propagation, and old 60 behavioral expectations were retained.

The first remediation run passed all 62 assertions. The subsequent scoped lint found one pre-existing `no-control-regex` error in `sourceText`. The rule was not disabled: the same U+0000–U+001F and U+007F rejection was expressed as a code-point check. No accepted/rejected payload meaning changed.

## Final actual results

- Final runtime/unit run: 62 passed, 0 failed, 0 skipped, 8 suites; `2026-09-14T12:01:34.268028Z` to `2026-09-14T12:01:39.675754Z`.
- Final receipt SHA-256: `7b25d5f9973c9f6157d6cce4a1cb1bfe54a6745c1a2d571b2eeefa8ee0d01a03`.
- Final compressed archive SHA-256: `04947c61aefbf9c6d54cf189390bd3217f4531b25ca0c2bcb25433c11772677d`.
- Performance ESLint: pass.
- HRIS layer scan, performance slice: 10 of 10 files classified, 0 performance-layer errors.
- Full HRIS layer scan remains structurally failed with 21 findings outside this scoped closure; `readinessPass=false` and `g3StartAuthorized=false` were preserved.
- Independent archive/source readback: pass. It verified unique test names, the unchanged original 60-test set, exact two failure-first cases, complete gzip/hash reconstruction, full UTF-8 snapshots for all 10 performance files, and equality between current sources and the final PASS snapshot.
- Global TypeScript checking is intentionally deferred to the root-coordinated stable window while the HRM source set is being changed; no typecheck success is claimed here.

## Exact source deltas

- Existing 60-pass snapshot → failure-first snapshot: runtime test file only.
- Failure-first snapshot → first 62-pass snapshot: performance hook only.
- First 62-pass snapshot → lint-safe final snapshot: performance model only, semantically equivalent control-character check.

Current final source hashes:

- Hook: `bb97b6f56ed225fa07ea22b3acfb73b5d9e4e11cbd026521fb51272218e57eab`
- Runtime test: `a16a5b28127ee19b4ffa70adbdd7448d9a6bb726438088af2cab0849f9aeebe7`
- Model: `a7d8ef35363f0dcaffdb8d51b96384f3ea819189f5cb48db03eae34b44176f65`

The authoritative machine-readable results are the failure-first, final-pass, scoped-quality-final, and final-readback JSON files alongside this report.
