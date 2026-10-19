# BASE-TFR-PER-004 module result — 2026-10-19

State: **module implementation and bounded verification complete; deployment/activation not authorized**. This supersedes the earlier transient `BLOCKED-central-state-matrix.md` claim. The corrected central successor was fast-forwarded only into the backend worktree before further edits; the frontend stayed on its sealed baseline. No `dwp-dev` merge was made.

Authority: replacement token `base-tfr-per-004.start-token-replacement.v2.json`, SHA-256 `93e6d485a8d30eeb1dbd23334641696c2713084e2bd8d753a0e636ffeb6c0c63`. Backend corrected baseline `0ef034f1e57380fec256095122297a6d8bc87d37` (tree `2ce7e49f0b7a12f8cd2b6d55053e326bd97e424b`); frontend baseline `29d3993e769fc49a4692d79732b0c7d054c5b42f` (tree `a13b8d922211008570d88888e97367cef673146b`). Source/evidence hashes are in `SHA256SUMS.md`.

Primary user: HR performance administrator. Operational question: which governed form, scale or policy version is current and which exact lifecycle action is allowed? Primary action: advance one Platform-bound policy version; the forms/scales surface remains inspect-only. Page archetype: focused workflow, deliberately unmounted until independent admission.

## Twelve acceptance conditions

| AC | Result | Bounded evidence |
| --- | --- | --- |
| 01 | PASS | Platform remains sole lifecycle/central receipt authority; People only stores typed artifacts and owner evidence. The corrected Platform synthetic state is consumed, not recomputed from a local terminal state. |
| 02 | PASS | Three closed schema keys/version 1; canonical payload digest, protected content and immutable template/form/scale reference checks. Overflowed schema versions and nested field smuggling are rejected. |
| 03 | PASS | Leased Performance V19 extends V17 in place, adds exactly preparation, binding and evidence tables with FORCE RLS; PostgreSQL migration/immutability/RLS tests pass. |
| 04 | PASS | Prepare is idempotent and stores one artifact; finalize binds exact Platform create receipt/version and rejects conflict; full replay receipt equality is tested using persisted timestamps. |
| 05 | PASS | Validation precedes simulation. Simulation requires owner-resolved exact sample scope and deterministic domain evaluation digest; mismatch/outage cannot mint evidence. The owner simulator port remains intentionally unbound in production. |
| 06 | PASS | Submit lies between simulation and approval; approve/publish require exact feature/action decision and maker-checker/step-up gate. |
| 07 | PASS | IAQ-020 forms/scales is read-only with separately verified form and scale snapshots and no actions. |
| 08 | PASS | IAQ-056 returns at most one target-bound action. Create is exclusive to `NO_MUTABLE_VERSION_AND_CREATE_ELIGIBLE`; raw terminal states never create. A Platform-authoritative unbound create candidate can appear without a local binding; ineligible/outage returns no action. |
| 09 | PASS | Exact configuration/version/CAS/href/action keys are checked at BE and browser adapter boundaries; no masked field or caller-provided target supplies authority. Browser owner path includes `/api/people`. |
| 10 | PASS | Missing ports, stale/partial projection, malformed tuple, replayed workload proof, inconsistent local artifact and signed absence outside the freshness window fail closed. |
| 11 | PASS | Unmounted view covers eight states at 1440/1280/390/320px, normal and 200% text zoom: 64 no-horizontal-overflow/action-count checks. 23 screenshots include narrow, dark/forced-colors/reduced-motion evidence. Named/focusable retry and submit controls, keyboard focus order, and step-up transition are tested. |
| 12 | PASS | Feature default OFF; enrollment list empty; no production owner/field/candidate provider bound; no route/menu mounted or production release. |

## Verification

- Backend: `./gradlew :dwp-people-server:test --tests 'com.dwp.services.people.hris.performance.per004.*'` — 23 tests, 0 skipped/failures/errors across eight classes, including real PostgreSQL V19, FORCE RLS, append-only, replay inbox and receipt equality cases.
- Frontend: two configuration contract/client files — 15 tests; exact G3 slice — 3 tests; portable Playwright/Vitest visual harness — 1 test with 64 state/width/zoom checks. Changed-root TypeScript and ESLint passed. Temporary local dependency-resolution configs were removed; the committed visual harness has no absolute `node_modules` paths.
- Visual audit JSON SHA-256 `453e8ed1707ece9d62a179f86a8a320dd3480a44dfc37e1031dd63468d1a94f4`; 23 sorted PNG SHA-256 lines have aggregate SHA-256 `4546289e908a52ffb259729950c85da14e673f1593d3160b38705fd6d9576d53`.

These are module-branch acceptance results, not activation permission. The trusted context, Platform projection/create-candidate, PER-014 template, and sample simulation ports remain unbound in production by design. Independent central admission is required before any `dwp-dev` merge or rollout.
