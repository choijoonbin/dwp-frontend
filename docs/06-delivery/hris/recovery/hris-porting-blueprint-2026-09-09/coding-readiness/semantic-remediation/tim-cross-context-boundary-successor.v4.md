# TIM cross-context v4 — bounded preparation candidate

Status: AUTHOR_BOUNDED_DESIGN_MODEL_NOT_CANONICAL. G3 remains CLOSED_FAIL_SAFE. SOURCE_CLOSED=false; native authorization, transport and DML execution=0. Independent review and canonical owner registration are pending internal technical work, not requests for customer data or new user approval.

## Changed design

The immutable base+RFC catalog supplies all 116 operation IDs in their original order. This chunk details four existing operations: `tim.rule.create`, `tim.leave.entitlement.run`, `tim.leave.enrollment.cancel`, `tim.leave.entitlement.input.get`. The other 112 IDs remain explicitly unclosed; four detailed operations are not a whole-domain source-closure certificate.

1. Termination uses the frozen source enum STOP_FUTURE_ONLY / PRORATE_FINAL_PERIOD / OWNER_APPROVED_SETTLEMENT, never STOP_ONLY / PRORATE / ownerSettlement aliases. Full policy content is refetched, not accepted as a request override. The retained termination owner schema has `assignmentPublicIds[]`; target assignment membership, worker binding and inclusive civil-DATE semantics are checked. A/B fixtures exercise all three instruction branches. They do not execute ledger proration, settlement or native approval.
2. External receipt and close-period parents are parsed from the pinned saved G2 SQL. Their current tenant/public-UUID unique keys already exist. No new tenant/internal receipt key is needed for the actual public-UUID edge. WFM candidate metadata comes from the pinned unpublished proposal plus the canonical common-column descriptor, not a native catalog. Known external edges still require child existence, nonempty matching arity, types, tenant prefix and exact unique parent key.
3. ABS owns the five imported evidence/projection tables. An ABS evaluator report is local policy/evaluator output, not an external DTO. ABS governance combines the loaded ABS policy parent with a typed SYS governance response. Calendar evidence is direct SYS/TIME; schedule evidence is TIME's published header and segments only. Owner response payloads and local tenant/actor/clock/allocator/RETURNING provenance are distinct. Historical cloned TIME/body business bindings are quarantined, not executable replacements. Nested non-neutral TIME source/read/write references are fatal in this scope.
4. Six run/input/selected/termination/intent tables retain 95 typed binding declarations; the five imported tables add 82, for 177 declarations on eleven scoped ABS tables. Pure assemblers execute full immutable A/B input construction/refetch, five imported SQL-bind rows, termination instructions and retained typed outcome branches. This is not evaluation of every 95-node source graph. Outcome uses actual `kind`, not phantom `status`; unit comes from the selected row; error/cancel numeric fields stay null rather than fabricated zero.
5. All 106 original CHECK materials receive explicit dispositions: 88 parsed SQL_CHECK_AST and 18 OWNER_SEMANTIC_REQUIRED_OPEN. SQL expressions are planned materials only. Natural-language/owner guards remain visible and fail-closed pending actual typed owner handlers; a small pure guard evaluator is not PostgreSQL or native CAS proof.

The structural successor still has 52 tables / 723 columns / 108 FKs; all 15 reviewed cross-context boundary records are preserved and changed to local ABS evidence/governance ownership. These counts are structural, not semantic approval. This chunk allocates no migration version and adds no further business table.

## Actual replay

The first build failed on WFM `commonColumns` being a descriptor object rather than a list; it was fixed by reading its real canonical descriptor. The initial 37-case run failed (1 failure, 7 errors), including an unavailable guessed Ajv path. Those raw records are retained. The same 37 cases then passed, followed by 40 cases; final 44 cases include all earlier 40 and four stronger negatives. The unavailable Python jsonschema preflight is not used as schema evidence.

Final unit argv:

```text
/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/test_tim_cross_context_successor_v4.py
```

Actual UTC 2026-09-14T09:16:25.027163+00:00 → 2026-09-14T09:16:46.832770+00:00: exit 0, 44 unique tests, failures/errors/skips=0, unittest elapsed 21.680 seconds. The 21 source/data SHA-256 and exact decimal-string mtimeNs pins match before/after. Negative cases include real STOP_ONLY schema rejection, FK+source type tampering together, nullable+binding tampering together, known-external missing child/arity/tenant, candidate+catalog synchronized drop, missing/stale/wrong-tenant/purpose/scope owner responses, unknown nested TIME sources, optional disabled calls=0, missing enabled adapter, immutable refetch/digest/parent/count/unit/date/correction errors and false native/closure flags.

Saved-package argv:

```text
/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/tim_cross_context_successor_v4.py --verify-package
```

Actual UTC 2026-09-14T09:16:46.856716+00:00 → 2026-09-14T09:16:54.698944+00:00: exit 0; seven saved documents match exact regeneration; installed Ajv 6.12.6 compiles 16 roots with full Draft-07 and validates 14 saved positive instances, errors=0. The schema envelope converts reference storage from `$defs` to Draft-07 `definitions`; it does not claim a different schema dialect. These 14 cases are separate schema checks, not additional native journeys.

The frozen final source sizes are 863 / 370 / 37 lines for main Python / dedicated tests / schema-engine CJS, respectively. No heavy/global static, database, runtime/server or production SQL execution was performed.

## Package and ownership

All files here use the new v4 prefix (plus the two new v4 Python names). Historical v3, base/RFC, G2 SQL, prefix CSV, canonical contracts/Gates, BE/main, PAY and HRM frozen inputs were not edited.

- `.json`: status, independent frozen catalog, exact boundary decisions and explicit remaining OPEN scope.
- `.schemas.json`: 70 reachable definitions and 16 closed-schema roots.
- `.fixtures.json`: concrete API-shape-valid synthetic A/B inputs, instructions, owner/local environments.
- `.record-outputs.json`: actual standalone-model records, including five imported rows with all 82 fields.
- `.source-graphs.json`: eleven-table typed declaration graph; full 95-node native consumer evaluation is explicitly OPEN.
- `.table-dependencies.json`: actual parent provenance, planned query/owner tuple, DTO/SPI/adapter/assembler/test file ownership.
- `.guards.json`: every CHECK source, parsed AST or explicit owner-semantic OPEN, and planned SQL materials.
- `.evidence.json`: actual argv/time/pins and compressed raw initial failure and later replays.
- `.stable-manifest.json`: final owned-file pins; the manifest excludes its own self-hash.

Planned Java DTO/SPI/producer/consumer files belong to the TIM module under `dwp-time-server/src/{main,test}/java/com/dwp/services/time`; no such Java implementation or consumer compile is certified here. The proposed TIME schedule refetch query is not a published producer contract. Its immutable stored row payload and current purpose/population/field-policy reauthorization still need exact source implementation. Snapshot business counters are not DWP authority revisions: actor Auth row/access counters and opaque auth-/policy-/psc-/psr-* strings stay separate from target People four native versions.

Neutral receipt/outbox/inbox use has a narrow owner tuple and named allowed infrastructure operations, pending internal code-owner review. It does not authorize TIME business repository access or cross-context FK exceptions.

## Remaining G3 preparation, then G4

G3 still requires independent review of these source adapters/guards, exact publication of owner DTO/SPI/query contracts, current PEP/purpose/population/field-policy/refetch wiring, producer/consumer compile, immutable source/receipt/CAS plans, migration manifest allocation, WFM native-parent publication and remaining 112 operation/source-family closure. Full 95-binding native graph execution and all four operation subtargets remain OPEN. `--sql` still refuses export because owner-semantic handlers, WFM publication and the approved dependency/manifest boundary are missing.

The next bounded chunk should close the cancellation/input retrieval/finalize/reconcile source branches and the 18 owner-semantic guards against independent owner contracts, then expand source closure by exact operation family. Whole-domain CRUD, ledger DML and full journey execution belong to G4; country/customer activation belongs to G6. None is silently required in advance to open coding, and missing G3 source contracts are not deferred as merely G4 work.

