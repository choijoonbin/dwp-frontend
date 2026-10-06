# Modern causal/module successor projection rules

`generate_modern_causal_module_successor.py` treats the canonical operation
closed set as its only source. It validates the entire source graph before it
stages a causal candidate. It never infers a business transition from DML.

## Public operation variants

- `COMMAND`: requires one explicit transition identifier, a physical aggregate
  root, and closed pre/post state sets. A branch transition keeps its complete
  `branches` array; the summary state sets are only an exact union of those
  branches.
- `QUERY`: requires no transition, no public event, and an exact binding with no
  transition/event IDs. Its causal projection must remain read-only.

## Internal handler variants

- `EXPLICIT_ROOT_STATE_TRANSITION`: both `preStates` and `postStates` are
  present and non-empty, so one handler state edge is projected.
- `APPEND_ONLY_OBSERVATION_EXACT_HANDLER_CONTRACT`: an explicitly marked
  append-only observation may have an empty pre-state. Its exact handler
  contract is retained, but no fictitious state edge is created.
- `ROOTED_EXACT_HANDLER_CONTRACT_NO_SINGLE_CLOSED_EDGE`: append or multi-phase
  owner work has a root but no single closed pre/post edge. The complete handler
  contract is retained without flattening the workflow.
- `ROOTLESS_EXACT_HANDLER_CONTRACT`: multi-owner/saga handlers have no single
  aggregate root. Their complete handler contracts and producer identities are
  retained without inventing a root.

Every internal handler remains byte-equivalent to its SSOT source inside the
module projection. `internalConsumerHandlerProjection` records which of the
four projection rules applied.

## Event producer identity

Each module event preserves both canonical producer lists:
`emittedByOperationIds` and `emittedByInternalHandlerIds`. `emittedOn` contains
only state edges that are explicitly present in the source. It may therefore be
empty for a rootless, append-only, or multi-phase handler event; the canonical
handler producer identity remains mandatory and closed.

## Fail-closed checks

Before output, the generator requires exact operation, handler, public-event,
and table sets; unique IDs; manifest mode/session agreement; exact binding
agreement; command/query shape agreement; closed branch states; valid handler
root variants; and exact event producer identities. Candidate output is staged
only after source validation, projection, and derived-closure validation pass.

Run the candidate-specific hostile suite with:

```sh
python3 coding-readiness/generate_modern_causal_module_successor.py \
  --self-test-candidate-dir coding-readiness/modern-canonical-candidate.uaHfXj
```

