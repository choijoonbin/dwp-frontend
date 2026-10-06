# HRIS-TIM synthetic golden specification

`synthetic-golden-fixtures.json` is the independent, customer-free oracle for global core implementation. It is not a copy of SKKF data and does not assert a current labor-law value.

## Harness contract

1. Load each case into a fresh synthetic tenant with deterministic UUIDs and a fixed test clock.
2. Publish only the policy versions declared by the case.
3. Execute commands through the same application/PEP/idempotency path as production.
4. Compare typed values, state, revisions, digests, receipts and exceptions. Do not compare screenshots or database row counts alone.
5. Replay the event/ledger stream into an empty projection and require the same expected result.
6. Repeat asynchronous cases after injected timeout/crash and prove one logical result.
7. Run each authorization case against two tenants and separate persona accounts.

## Numeric rules

- Elapsed minutes use canonical instants; source local datetime, timezone and offset remain evidence.
- Breaks and configured classifications are applied by versioned rule, never by locale string or server timezone.
- Ledger balance is the exact sum of signed entries in one declared unit.
- A reversal references the original entry and changes the projection; it does not mutate the original.
- No tolerance is allowed for integer minutes. Future fractional-hour results declare scale and rounding in the fixture.

## Required property suites

- event ordering and duplicate insertion do not alter output digest;
- replay from the same input/rule digest is deterministic;
- ledger plus exact reversals sums to zero;
- no command crosses tenant, population, period or field policy;
- only one concurrent expected-version command wins;
- closed-period facts never update/delete;
- result-unknown resolves to one receipt/result;
- disabled optional pack/adapter cannot silently fall back.

## Activation packs

A country pack adds its own versioned fixture set with official reference, jurisdiction, effective dates, expected calculations, rounding and statutory owner approval. A clock adapter adds signed provider schema and conformance cases. These suites extend this core oracle and never replace or edit it.

Production/customer parity may add anonymized customer cases only in a separately governed repository. Their absence does not block core code; it blocks only the corresponding pack, adapter or cutover claim.
