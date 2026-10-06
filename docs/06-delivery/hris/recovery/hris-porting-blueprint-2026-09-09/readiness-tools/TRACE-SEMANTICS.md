# HRIS child-trace semantic gate

This gate validates every row in the five `g1-child-trace.csv` files, not a
sample. It preserves the source evidence identity while making the target
meaning executable and reviewable.

Enforced rules:

- source HTTP reads map to `QUERY` and a side-effect-free state contract;
- source POST/PUT/PATCH/DELETE operations map to idempotent `COMMAND`
  contracts, and legacy GET side effects are called out explicitly;
- lifecycle rows carry expected-version, durable receipt and correction
  semantics;
- jobs, interfaces, files/exports, formulas and persistence each have a
  dedicated target and state contract;
- deprecated cross-module aliases are rejected;
- the exact five-module population is 10,001 and child IDs, source
  fingerprints and parent/decision linkage remain unchanged;
- a deterministic, risk-weighted representative review register covers every
  module/child-type/semantic-class population in addition to the full scan.

Run:

```bash
python3 readiness-tools/validate_trace_semantics.py
```

After an authorized generator change, normalize target-design fields and
refresh the deterministic review register:

```bash
python3 readiness-tools/rebuild_trace_semantics.py
python3 readiness-tools/validate_trace_semantics.py --write-review-register
python3 readiness-tools/validate_trace_semantics.py
```
