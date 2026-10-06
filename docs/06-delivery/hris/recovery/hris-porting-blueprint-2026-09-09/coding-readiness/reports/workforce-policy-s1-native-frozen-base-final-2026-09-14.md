# Workforce Policy S1 native frozen-base verdict — 2026-09-14

## Outcome

The frozen `db0d2b5067e6fbee27ee58121c5a4406cab132b9` baseline is **27 PASS / 1 FAIL** across 28 unique PostgreSQL 16 native cases. It is not a passing S1 verdict and must not be promoted to the newer `dwp-dev` baseline.

The sole remaining counterexample is `[4] op=POLICY_REVOKE_PREFLIGHT_AUTH_READ`. The actual result is `Failure(MALFORMED_REQUEST)`; the expected result is a read-only `Success` carrying `LegacySubjectFact` for the 80-character historical role code. The preserved XML message is `Expected Success but was Failure code=MALFORMED_REQUEST`.

## What the evidence proves

- The same 80-character historical revoke request is accepted by the existing `allFourServerOperationsHaveAnExactTypedCandidate` decoder unit case.
- The native failure therefore occurs after request decode, in the end-to-end legacy revoke evidence/carrier response path. The focused follow-up surface is `VerifiedRead.carrier()` and its `LegacySubjectFact`/historical-role response validation.
- The fixture was not weakened to a 50-character current role. Historical compatibility remains an explicit requirement.
- The supported tenant lifecycle value `SUSPENDED` now exercises `TENANT_INACTIVE` successfully; that prior fixture error is closed.
- All other native authority, stale-row, session, SoD, scope, target, digest, HTTP-chain, read-role restriction and operation cases passed.

## Execution and integrity

- PostgreSQL: `postgres:16-alpine`
- Single class; `--no-daemon --max-workers=1 --rerun`; 120-second harness bound
- Run: `2026-09-14T12:13:10.182512Z` through `2026-09-14T12:13:32.435277Z`; exit 1; no timeout
- Host semaphore `hris-verification`: acquired `12:13:09.449Z`, released `12:13:34.013Z`
- Source manifest: 3,068 entries, stable before/after
- Contract SHA-256: `d943478c91b82943bc2684885da442a7f0a58d6fb0d50e25e973faf500e9ceef`
- Adapter SHA-256: `430fec043235f47f21d9546e2926b2ba2f13474442b54a451e2c09a318678cb9`
- Test SHA-256: `7fff8bacff5f38a63c194be8c57928f829e654f37039bde0a42d8672b69d8713`
- XML SHA-256: `f77b01f26732c1d529af41e22884d97e6cc73701abe381c4e4aeab6cbe98fe70`; mtime ns `1789388011988827911`
- Lossless receipt SHA-256: `3846aab29be3450595ef499dadae1914c4aa52d99b1f716d01e7b8b8782f7400`
- ACK archive SHA-256: `38bf68cfd75322ebe93802308cdb0d3104b587adcfca3ffa9df3cc7fd097b520`; all chunks 0–44 were received

No production source or business expectation was changed by this recovery. Changes are confined to TEST_ONLY fixture correctness and diagnostic visibility: reserved maker/checker/target IDs `941010/941011/941012`, clean-DB v5→v6 governed catalog lifecycle with absent-pointer revision 0, supported `SUSPENDED` tenant state, and actual failure-code display.

## Cleanup

The owned PostgreSQL container `70b164038a9463f64832cd9269e1b0c8b1c9b3947ade0dd4913efddafbb4cc4f` and owned Ryuk container `2107e22b789da0a9c7d50c02cce938a1fa19b59bfe2969fba45a111be08972a6` both returned `no such object` on exact post-run inspection. No manual server or container stop was performed.

## Boundary and required follow-up

`G3=false`. This evidence is only S1 Auth **read-only**, native, TEST_ONLY verification. It is not a People command permit, durable fence, production registration, module coding authorization, or whole-HRIS readiness approval.

`dwp-dev` has advanced to `315e1b2`. After its controlled integration, a separate latest-baseline specialist must reproduce the 80-character historical-role carrier case, correct the production response path without reducing historical compatibility, and rerun this exact PostgreSQL native class with lossless evidence. Until that passes, S1 remains open.

Machine-readable counterpart: `workforce-policy-s1-native-frozen-base-final-2026-09-14.json`.
