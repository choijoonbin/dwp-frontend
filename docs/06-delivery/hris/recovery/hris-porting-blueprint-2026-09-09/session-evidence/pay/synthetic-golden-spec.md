# HRIS-PAY synthetic golden specification

`synthetic-golden-fixtures.json` is a customer-free oracle for global Payroll mechanics. `TST` is an intentionally synthetic currency. The file asserts no current tax, insurance, retirement or YEA result.

## Harness contract

1. Create a clean synthetic tenant, fixed test clock, public IDs and published test-only configurations.
2. Drive cases through application commands, PEP, expected-version and idempotency paths used in production.
3. Freeze input/rule/function/rounding digests before calculation.
4. Compare state, exact decimal results, line/control totals, revisions, digests, receipts, reconciliation and audit—not screen output.
5. Rebuild and replay result/balance projections from immutable facts and require exact equality.
6. Inject crash/timeout at pre-commit, post-commit/pre-response and partner-result-unknown boundaries.
7. Execute negative cases with separate persona accounts and two tenants/pay groups.

## Monetary rules

- Use decimal arithmetic only; no binary floating point.
- Every value declares currency/unit and scale. Addition across currencies/units is rejected.
- Rounding is applied only at the fixture's declared stage/scale/mode and included in the trace.
- Worker line totals equal worker gross/deduction/net/employer totals; run totals equal worker totals.
- GL debit equals credit exactly within a currency.
- Corrections/retro runs post deltas and reversal links; they never mutate prior final values.
- Exact equality is required for synthetic cases. A future external parallel-pay suite must declare any approved tolerance per field with an owner and reason.

## Formula safety properties

Reject dependency cycles, unknown functions, unit mismatch, unbounded depth/nodes, timeout, ambient clock/randomness, class/method/reflection, network/file/database access and executable tenant input. Same engine/function/formula/input/rounding digests produce the same output digest.

## Required property suites

- same idempotency key/digest yields one run/result; different digest conflicts;
- only one concurrent expected-version transition wins;
- maker/checker and payment/GL/YEA SoD cannot be bypassed by group combination;
- finalized result/trace/balance/approval/access facts reject update/delete;
- payment/GL/provider result unknown resolves before any retry;
- projection/ledger/control-total unexplained difference remains blocking;
- sensitive filters/sorts/aggregates enforce field policy;
- disabled pack/provider/connector never silently falls back.

## Country/provider/customer extensions

The KR pack adds independently versioned fixtures citing official sources, effective dates, rounding, forms and a statutory owner. A bank, ERP or YEA provider adds schema and conformance fixtures plus result-unknown/correction scenarios. A customer cutover may add anonymized parallel-pay cases in a separately governed store.

Those packs extend this core suite; they never overwrite core expected values. Their absence blocks only the relevant pack/adapter/cutover activation, not global core implementation.

## Decimal contract

`PAY-GOLD-014` binds the global core to `coding-readiness/decimal-value-types.v1.json`: decimal-string transport, InputAmount/Rate/Quantity/Calculation/Posted precision, all six rounding modes with explicit positive and negative expected outputs, scale 0 and 4 cases, typed MONEY/RATE/HOURS/NUMBER worker entries, and a before/after/stage/scale/mode/policy-digest trace. It also executes JSON-number, exponent, plus-sign, whitespace, leading-zero, precision-overflow, cross-currency, cross-unit, AMOUNT-without-currency and quantity-with-currency rejection. Signed negative zero is normalized before comparison, digest and persistence. Database implicit rounding and binary floating point are forbidden.
