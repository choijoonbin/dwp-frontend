# PER Synthetic Golden Oracle Specification

## Purpose

`performance-golden-fixtures.json` is an internally owned, synthetic and versioned oracle for the generic Performance core. It proves deterministic rules, state guards, authorization and recovery without customer data. It is not an SKKF production export and does not encode current customer policy.

Real anonymized customer results are optional parity/UAT/cutover evidence. They do not block core coding. A real connector is activated only after its contract and sandbox cases are supplied; production retention/privacy requires named owners. Those later gates do not change the synthetic oracle's role.

## Oracle rules

1. Parse decimals as arbitrary-precision decimal values and quantize to six places with `HALF_UP` only at the policy-defined boundary.
2. Weight groups must total exactly `1.000000`. Missing, not-applicable and zero are distinct inputs.
3. Cycle stage intervals use `[opensAt, closesAt)` and must be valid, ordered and non-overlapping unless an explicit code-owned parallel-stage policy permits overlap.
4. Population evaluation is deterministic for `(tenant, rule version, HRM snapshot ID, HRM snapshot revision, as-of instant)`. A freeze retains its exact result after later HR changes.
5. Review submission requires a frozen assignment, matching stage, open window, current version, published template snapshot and complete valid answers.
6. Calibration appends adjustments. It never overwrites source submissions or prior results.
7. Anonymous feedback is released only at or above the configured threshold; identities and exact suppressed counts remain hidden.
8. Same idempotency key and same normalized request hash return the same receipt/effect. A different hash under the same key is a conflict.
9. Cross-tenant IDs do not disclose existence through status, counts, search, errors, receipts or exports.
10. Import reconciliation satisfies `accepted + rejected <= total` and `applied <= accepted`. Atomic publish never occurs for a partial/invalid run.

## Fixture coverage

| Case family | What it proves | Required implementation tests |
|---|---|---|
| cycle 001/002 | valid schedule and overlap rejection | unit + API contract + DB constraint/property test |
| weight 001/002 | exact decimal score and invalid total | unit/property + persisted lineage |
| population 001 | HRM snapshot, deterministic membership, freeze immutability | HRM contract stub + integration + event replay |
| review 001/002 | legal submit transition and assignment-scope denial | application + API authz negative |
| calibration 001/002 | append-only adjustment and calibrate/publish SoD | aggregate + persistence + Auth contract |
| feedback 001/002 | minimum cohort and identity suppression | policy + serialization negative |
| idempotency 001/002 | replay and key/body mismatch | concurrent integration + receipt query |
| tenant negative 001 | no cross-tenant existence leakage | repository/API/search/count negative |
| home 001 | widget partial failure and no menu map | frontend contract + API composition |
| import 001 | partial validation, no premature apply/publish | job/integration/reconciliation |

## Test harness mapping

- Java unit/property tests consume fixture case subsets as immutable resources under the future Performance package.
- API integration tests use the same IDs and expected problem codes.
- PostgreSQL integration tests prove tenant composite constraints, immutable grants and receipt uniqueness.
- Frontend tests consume only the public expected responses, not database fixtures.
- The module validation script checks structural and arithmetic consistency before the fixture is admitted to a code Gate.

## Change control

- Increment `schemaVersion` for fixture schema changes.
- Never modify expected values merely to make a failing implementation pass. A rule change requires a new case/version, G2 reviewer rationale and retained predecessor oracle.
- Record the rule/policy version and source-of-truth owner for every future non-synthetic country, contract or tenant pack.
- Synthetic IDs, names and dates must remain obviously fictional and contain no copied person, customer or production values.

## Exit criteria for a vertical slice

The central Gate is open because every referenced fixture is structurally valid, independently reviewed, mapped to tests and paired with negative cases for tenant, scope, field and state. Each G3 slice must preserve these conditions; module validation alone never authorizes G6 production activation.
