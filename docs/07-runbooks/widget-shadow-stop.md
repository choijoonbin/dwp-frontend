# Widget Catalog Shadow Stop

- Owner: Platform Control Plane on-call
- Scope: staging `BOOTSTRAP` or `SHADOW` observer only
- Safety rule: legacy Home response and data path must remain unchanged

## Enter when

- queue depth is above 230 for 300 consecutive seconds;
- rolling error, timeout, rejection, duration, outbox, diff, or unsafe-allow Gate fails;
- Head, Approval, selector key, build, policy, safety, or binding revision differs from Evidence.

## Execute

1. Open an incident and capture correlation IDs, rollout revision, ring, build, and immutable metric snapshot ref.
2. Lock the staging rollout Head. In one transaction append a `REVOKED` Approval revision, set Head to
   `STATIC`, clear active Approval and Bootstrap provenance, set ring to `0`, and increment rollout revision.
3. Verify every evaluator observes the new Head, then set both shadow flags to `false`. Never invert this order.
4. Stop new enqueue, let in-flight observers expire, and discard their results. Do not write their result to Home.
5. Confirm legacy response bytes, Preference hash, render, data, action, App Dock, and Now remain unchanged.

## Exit evidence

- Head is `STATIC/ring=0`, both flags are off, queue depth is zero, no unsafe allow occurred, and Outbox has no gap.
- `WIDGET_ROLLOUT_STOPPED` and Audit/Outbox share the stop command and aggregate sequence.
- A new Bootstrap prerequisite, approval, and full observation window are required before re-entry.
