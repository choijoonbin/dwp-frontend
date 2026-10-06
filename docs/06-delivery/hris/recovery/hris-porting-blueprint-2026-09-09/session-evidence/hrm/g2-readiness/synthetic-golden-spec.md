# HRIS-HRM synthetic golden specification

- Fixture: `synthetic-golden-fixtures.json`
- Status: `READY_FOR_G3_CODE`
- Owner: `ROLE.QA_EVIDENCE` with `ROLE.HRIS_HRM_SME`
- Independence: all identities, names, codes, dates, hashes, object references and encrypted-value tokens are invented. No production/customer row, expected result, formula, SQL, credential or template asset is present.

## 1. Purpose

The fixture is the executable product oracle for Core HR invariants before any customer migration exists. It proves effective dating, lifecycle guards, authorization, idempotency, correction, documents, integration reconciliation and partial failure. It is not tenant setup data and must never seed production.

Customer anonymized parallel-run evidence is added later for that customer’s parity/cutover Gate. It may extend but cannot weaken these product invariants.

## 2. Oracle construction

Expected results are derived from the target ADR, state contract, API/event contract and half-open interval mathematics—not from executing SKKF code. Review separates roles:

- HRM SME verifies business lifecycle and expected as-of results.
- QA owns independently written assertions and mutation/fault cases.
- DBA verifies database constraint outcomes and history reconstruction.
- Security/Privacy verify denial, masking, no-inference, cache and audit expectations.
- Architecture verifies command receipt, outbox/inbox and downstream contract outcomes.

Changing an expected result requires a versioned fixture change, linked decision and reviewer ACK. Implementations may not update the oracle merely to make a failing test pass.

## 3. Fixed semantic assumptions

- Date intervals are `[from,to)`; `2030-07-01` belongs to the new slice and not the slice ending that date.
- Tenant comes only from authentication. A payload tenant, organization or manager value is never authoritative for authorization.
- Public UUIDs are external identities. Numeric IDs are internal and absent from contracts/events.
- One active primary relationship per worker and one active primary assignment per relationship may overlap no other primary period.
- Secondary assignment overlap is allowed when relationship, policy and references are valid.
- Published events and issued artifacts are immutable. Correction/revocation appends evidence rather than overwriting bytes/history.
- Exact idempotent replay is single-effect; key/payload mismatch is conflict.
- Event delivery is at least once; projection application is inbox-idempotent.
- Unauthorized fields cannot be used to search, sort, aggregate, export or change visible counts.

## 4. Golden cases

| ID | Risk | Oracle |
|---|---|---|
| `HRM-GOLD-001` | date-boundary ambiguity | old org before 2030-07-01, new org on/after it, exactly one primary |
| `HRM-GOLD-002` | legitimate multiple assignment rejected | secondary slice accepted, primary remains singular, one semantic event |
| `HRM-GOLD-003` | duplicate primary employment state | 409, zero domain/outbox effect |
| `HRM-GOLD-004` | future self-service change | approved/apply state, old projection before date and new masked projection on date |
| `HRM-GOLD-005` | self approval | 403 SoD, zero business write, denial audited |
| `HRM-GOLD-006` | client retry after timeout | one receipt, one effect, one semantic event |
| `HRM-GOLD-007` | accidental key reuse | second request 409, original effect remains singular |
| `HRM-GOLD-008` | stale publish | 409 and safe current ETag, no write |
| `HRM-GOLD-009` | historical rewrite | original unchanged, one linked correction, deterministic reconstructed version |
| `HRM-GOLD-010` | tenant escape | non-disclosing 404, no shared PII cache, denial audited |
| `HRM-GOLD-011` | masked-field inference | field-operation denial without result/facet count |
| `HRM-GOLD-012` | document overwrite/reuse | issue digest immutable; revoke denies later download and preserves audit |
| `HRM-GOLD-013` | duplicate/out-of-order integration | one apply, one duplicate, one quarantine, stable cursor, zero unexplained difference |
| `HRM-GOLD-014` | bulk false success | two accepted, one rejected, three item receipts, batch partial |
| `HRM-GOLD-015` | home dependency failure | successful widgets remain; failed widget is retryable/dated; no field leak; no menu-map home |

## 5. Required automated layers

### Unit/property tests

- Generate adjacent, nested, open-ended and overlapping date ranges; only valid non-overlap/containment passes.
- Generate lifecycle transitions; only the enumerated graph passes and terminal update/delete always fails.
- Generate canonical request permutations; semantically identical commands hash equally and changed business intent hashes differently.
- Generate field-policy combinations; deny precedence and `OMIT > MASK > VIEW` restriction ordering are stable.
- Generate relationship/assignment combinations; primary uniqueness remains invariant while valid secondary cases work.

### Database integration tests

- Run every new PK/UK/FK/check/exclusion constraint against PostgreSQL, including concurrent overlap insertion.
- Verify aggregate + receipt + audit + outbox atomic rollback by fault injection at each write boundary.
- Verify terminal-row triggers and linked correction.
- Verify tenant composite FKs prevent cross-tenant reference despite valid foreign numeric IDs.
- Verify query plans use tenant/as-of/work-queue indexes at the agreed synthetic volume.

### API/security tests

- Exercise each endpoint with absent app entitlement, absent duty, wrong population, wrong purpose, wrong field group, expired step-up, SoD conflict and tenant escape.
- Verify direct API behavior equals menu authorization and error bodies contain no target existence or restricted value.
- Verify ETag/If-Match, cursor binding, receipt recovery, rate limit and no-store/private cache headers.
- Verify bulk per-item results, cancellation boundary and 5xx result-unknown flow.

### Contract/event tests

- Validate JSON schema and compatibility for snapshots/events.
- Deliver every event twice, out of order and with a version gap; assert one projection effect and correct quarantine/snapshot recovery.
- Verify TIM, PAY and PER projection allowlists exclude unrelated private fields.
- Verify event payloads exclude internal IDs, clear identifiers/accounts, document bytes and secret material.

### Document/integration tests

- Render from a synthetic approved template double, store an object reference and digest, sign/issue/revoke, and prove no overwrite.
- Simulate adapter timeout, duplicate response, malformed schema, secret-resolution denial, out-of-order source version and reconciliation mismatch.
- Verify logs/metrics contain only fixture/correlation identifiers and safe error codes.

## 6. Synthetic volume profile

Functional Gate tests begin with the small canonical fixture, then deterministically expand to:

- 2 tenants, with no shared business/public keys.
- 10,000 people and workers per tenant.
- 1–3 relationships and 1–5 assignment slices per worker.
- 20,000 organization nodes with three relationship types and depth up to 12.
- 100,000 assignment events, 100,000 change requests, 50,000 documents and 1,000,000 inbox/outbox/receipt rows.

This is a test assumption, not a production capacity promise. Production SLO and partition decisions require measured customer volumes and retention at activation. Until then, the Gate checks query budgets and absence of tenant-wide unbounded scans.

## 7. Reconciliation assertions

For every migration or connector run:

```text
source_count = accepted_count + rejected_count + duplicate_count
accepted_count = applied_count + quarantined_after_acceptance_count
unexplained_difference = 0
```

Per aggregate, the last applied source version/cursor, current target version, history-slice count and digest must match the run receipt. Cursor advances only after committed effects. Redacted reject details are sufficient to fix/replay; unrestricted payload copies are forbidden.

## 8. Gate evidence

An HRM slice can request `G2-CODE-GO` when:

1. The module validator passes and the integration checkpoint is live/clean.
2. Named Product, HRM SME, Architecture, DBA, Security, Privacy and QA bindings acknowledge the slice-relevant contracts.
3. The physical migration is centrally numbered and its data-profile/precondition plan is approved.
4. P0 golden cases for the slice are automated before implementation or alongside the first failing specification test.
5. API/event and authorization registries are integrated by their central owners without weakening owner PEP.

Actual operating menu exports, SKKF DDL/batch history, real connector specifications and customer data are not needed for this generic oracle. They become required only when claiming tenant parity, enabling that connector/country feature or entering customer production.
