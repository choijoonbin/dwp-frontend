# Workforce policy S1 native PG16 — functional counterexamples before fixture correction

- Boundary: `AUTHOR_ONLY_READ_NOT_COMMAND_NATIVE_TEST_ONLY`
- Whole G3 approved: `false`
- Command permit / durable fence / People owner validation: **not provided by this evidence**
- HEAD: `db0d2b5067e6fbee27ee58121c5a4406cab132b9`
- Command: `./gradlew :dwp-auth-server:test --rerun --tests com.dwp.services.auth.service.WorkforcePolicyGovernanceAuthorityAdapterV1PostgresTest --no-daemon --max-workers=1`
- PostgreSQL: `postgres:16-alpine`
- UTC: `2026-09-14T12:07:13.572690Z` to `2026-09-14T12:07:40.166733Z`
- Semaphore: `hris-verification`, acquired `12:07:12.908Z`, released `12:07:41.007Z`
- Timeout: `false` (120-second harness bound)
- Source manifest: 3,068 files, pre/post identical
- Result: **28 unique = 26 PASS / 2 FAIL / 0 ERROR / 0 SKIP**

## Preserved actual failures

1. `[2] row=TENANT_INACTIVE`
   - The test attempted `UPDATE public.com_tenants SET status='INACTIVE' WHERE tenant_id=41`.
   - PostgreSQL rejected that test-fixture statement through `ck_com_tenants_status`; the allowed tenant lifecycle values are `PROVISIONING`, `ACTIVE`, `SUSPENDED`, and `RETIRED`.
   - This fails before the adapter is evaluated. The smallest fixture correction is `INACTIVE` -> `SUSPENDED`; the asserted business result remains `TENANT_INACTIVE`.
2. `[4] op=POLICY_REVOKE_PREFLIGHT_AUTH_READ`
   - The actual adapter response was `Failure`, while the test expected `Success`.
   - The original helper asserted only the response class and therefore did not retain the failure code. Before any behavioral correction, a test-only diagnostic assertion must surface `Failure.code()` on the next actual run.
   - The historical 80-character role string is explicitly permitted by the fixed request and response schemas. No expectation or production correction is inferred at this checkpoint.

All other cases passed, including baseline-deny, list/organization/create reads, 14 other native denial variants, current-role boundary cases, read-only database role restrictions, two-context change detection, exact HTTP/session revocation, clock/expiry behavior, and superseded-session grace.

## Integrity and cleanup

- Lossless envelope: `workforce-policy-s1-native-functional-counterexamples-lossless-2026-09-14.json`
- Envelope archive SHA-256: `34905e920b3a4d1bc6537a2e5d5645e32eddd58915bf7a4b971a6578519e0764`
- Decoded receipt SHA-256: `0ad6ab24afedab58746998ee8a29afecfba573fc92bcbe0f79171e1751f717a3`
- Fresh XML SHA-256: `5d8f169a68532d8b987956f1f8a984558fcff7aa6c3879335ff1bc1f67c54739`
- Test-source SHA-256: `99372293352ad9fc677c4005e1c9d87d4606e4b507da4c515a5c0f3af3fe46f9`
- Production contract SHA-256: `d943478c91b82943bc2684885da442a7f0a58d6fb0d50e25e973faf500e9ceef`
- Production adapter SHA-256: `430fec043235f47f21d9546e2926b2ba2f13474442b54a451e2c09a318678cb9`
- Owned PostgreSQL container: `76f64df3aa5689688e20989b7ddf5065524be2f28d16bdf0c0affe6d09ccb69f`; event stream records destroy, and later exact inspection returns `no such object`.
- Owned Ryuk container: `34acf09d509607c18f852403b5b0585567a37402961f16780cbe68e28097f65a`; later exact inspection returns `no such object`.
- Manual server/container stop: `0`
- Production change at this checkpoint: `0`

This document is a pre-correction counterexample record. It is not a PASS claim and does not open any gate.
