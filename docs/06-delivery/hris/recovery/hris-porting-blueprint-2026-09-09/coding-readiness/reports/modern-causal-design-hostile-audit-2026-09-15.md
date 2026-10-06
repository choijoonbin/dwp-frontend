# Modern causal successor hostile audit — sealed FAIL

Decision: **P0 FAIL. Do not open the modern G3 or any module code gate.** This decision is bound to the candidate/artifact hashes in the companion JSON. The candidate source was changing during review, while the materialized exact/event/semantic/identity/causal artifacts remained older. `generate_modern_causal_successor.py --check` crashed on `GovernedAiAssistanceProduced.v2`; the existing validator independently returned 12 errors.

This is not a claim that the migration direction is wrong. It is a refusal to certify a contract whose labels can pass without proving the business effects that implementation sessions will rely on.

## P0 blockers

1. **Selectors are not executable.** All 91 materialized selector occurrences omit `targetTable`, `targetColumn`, `selectorType` and `cardinality`. The 69 command path selectors include nine related-parent selectors, six version selectors, one external onboarding-task owner reference and the AI `useCaseKey` natural key, but all are collapsed into a generic lookup. Each occurrence needs an exact type/id-space/tenant/purpose/version/as-of/cardinality/join contract.

2. **Every query carries command semantics.** All 19 queries send correlation to `outbox.correlation_id`; the three path queries (`hrservice.caseId`, `skills.workerId`, `listening.surveyId`) use an untyped lookup. There are 22 invalid required-input uses. A query must have a read plan and observability context only, with zero receipt/outbox/write effects.

3. **Required inputs are renamed guards.** All 356 required command body fields across all 81 commands materialize as `decision_input.*`; the exact lineage still has 200 body fields whose sole direct sink is `TRANSITION_GUARD`. A label, request digest or generic policy decision is not an observable domain effect. Every required and optional field needs an exact persisted sink, typed owner refetch, deterministic derived sink, selector/CAS, response or reviewed event assertion.

4. **First-write root selection loses lifecycle causality.** The critical failures are `offer.issue`, `hire.record`, onboarding template version publication, onboarding task completion, benefit-plan version publication, compensation snapshot publication, WFM publication and AI kill switch. Six create commands also classify their newly inserted secondary row as UPDATE. Mutation sets are unordered unions, so neither assignments nor row counts nor CAS increments can be implemented faithfully.

5. **Event contracts have lost business meaning.** All 81 materialized events contain the same six generic fields and blank foreign-reference declarations. All 32 stable `.v1` event contracts in the primary-ownership register are absent. The source draft's proposed blanket request-field copy is also unacceptable: a caller assertion is not a committed fact and it would overexpose sensitive fields. Required rich payloads include `CandidateHired.v1`, onboarding/benefits facts, `CompensationPlanApproved.v1` and `WorkforceSchedulePublished.v1`, with every value sourced from same-transaction state or an explicit owner refetch.

6. **Event clocks are not transition clocks.** Fifty-eight commands derive `occurredAt` from stale aggregate `created_at` or unrelated learning/listening `completed_at`. `occurredAt` must be the owner transaction clock; domain completion time is a separate fact.

7. **Optionality is unmodeled.** All 86 optional request fields across 48 operations are absent from the causal contract; 29 belong to commands. Six known optional-to-required sink/event edges still require a total deterministic default or a conditional schema.

8. **Identity constraints are incomplete.** Three path/body pairs require explicit equality checks: skill evidence, opportunity application and compensation cycle. Compensation `snapshotId`, `planId` and `cycleId` must remain distinct and bind to three distinct physical/owner sources.

9. **Compensation snapshot is not a canonical plan snapshot.** A caller provides `lineCount` but only one scalar line is accepted, even though the response allows 1..100000 lines. The accepted cycle must undergo APPROVED→PUBLISHED CAS, approval must be owner-refetched, the immutable header and exactly N lines must be written together, and count/digest/totals must be recomputed.

10. **WFM trusts caller-owned outcomes.** Blocking/fairness counts, approval receipt and canonical schedule period are accepted from the caller. They must be engine-derived or owner-refetched. Submit must create a real approval request/outbox, and publish must invoke the canonical schedule owner port after validating the receipt.

## P1 blockers that prevent another false pass

The existing validator imports `COMMAND_WRITES`, `STATE` and `state_column_for` from the candidate. It therefore asks the candidate whether its own choices are right. Its PostgreSQL probe seeds 56 arbitrary rows, performs 81 broad root updates and inserts fake temp events; it executes **zero** real operation transactions, **zero** of the fixed 58 INSERT/APPEND edges, and no receipt/outbox, replay, digest conflict, stale, tenant or step-failure rollback case.

The successor must instead be evaluated against the separately sealed `modern-causal-independent-oracle.v1.json`. The independent validator may read the candidate only as data and must never import its code or constants. PostgreSQL fixtures must run on versions 16 and 18, one isolated transaction per scenario, covering the fixed 45-operation/58-edge corpus plus all 81 CAS/state paths and all 19 read-only queries.

## Gate reopening acceptance

- 100 operations, 81 commands and 19 queries match the independent oracle.
- Every required and optional input has a concrete effect or absence rule; guard renaming cannot pass.
- Every selector is typed and executable, including related parents, versions, natural keys and owner ports.
- Ordered DML proves exact assignments, row counts, root CAS/version increment, receipt and outbox atomicity.
- Stable event payloads and consumer compatibility are preserved or explicitly version-migrated.
- PostgreSQL 16/18 evidence proves all 45 transactions and 58 INSERT/APPEND edges, identical replay, digest conflict, stale/foreign-tenant/purpose rejection and rollback after every step.
- A second independent reviewer signs the oracle hash and evidence. Until then this candidate remains **FAIL**, regardless of a green candidate-owned validator.

Exact counts, affected fields/operations, stable event names, hashes and acceptance statements are in [`modern-causal-design-hostile-audit-2026-09-15.json`](./modern-causal-design-hostile-audit-2026-09-15.json).
