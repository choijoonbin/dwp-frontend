# Modern HRIS successor independent verification

This directory is reviewer-owned.  It treats the canonical-five artifacts and
the `modern-physical-successor` artifacts as untrusted candidates.  Nothing in
this directory imports their Python generators or their validators.

The acceptance boundary is intentionally stronger than JSON/DDL compilation:

- exact closed-set identity and owner closure for 199 operations (133 command,
  66 query), 25 internal handlers, 155 public events and 106 tables;
- causal, provenance, response/event source, idempotency, identity, temporal,
  lifecycle, recurrence, query re-entry and publication-proof invariants;
- byte-independent agreement between the canonical exact schema and the four
  physical SQL/handler/query candidates;
- strict PostgreSQL collision, ownership, NOINHERIT `SET ROLE`, ACL, RLS and
  trigger-function execution boundaries;
- executable PostgreSQL 16 and 18 transaction fixtures, including replay,
  conflict and fault rollback.

`initial-independent-findings.v1.json` is a byte-bound fail report captured
before remediation.  It is evidence, not a source of truth and must remain
FAIL even after the candidates are corrected.  The final frozen oracle and
normal/self-test/hostile/PostgreSQL reports are generated separately only
after a zero-finding re-review.

