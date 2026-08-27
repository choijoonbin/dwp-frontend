# Widget Registry Outbox Replay

- Owner: Platform Data on-call
- Scope: Widget Registry, Tenant Policy, Rollout, and Shadow event families

## Enter when

- oldest unpublished age exceeds 30 seconds, delivery error rate exceeds 1%, DLQ increases, or a consumer finds a gap.

## Execute

1. Record service, event family, aggregate, sequence gap, deployment build, and immutable query snapshot.
2. Stop only the affected aggregate projection. Do not globally stop unrelated aggregates.
3. Inspect the transactional Outbox row and Registry Event; never synthesize an event from logs.
4. Replay by immutable `schemaVersion+eventId`. Consumer handlers must be idempotent.
5. If an event is missing from the source transaction, page integrity response; do not advance the consumer offset.

## Exit evidence

- Aggregate sequence is contiguous, duplicate side effects are zero, DLQ delta is zero, and oldest age is within SLO.
- Unknown schema/version remains fail closed and is not translated into an Allow decision.
