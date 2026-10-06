# HRIS 10,001 child-trace semantic closure

Status: **PASS — G1 semantic trace P1 closed**

This report is limited to source-child trace quality. It does not claim that
G3 implementation is complete or that G6 production activation is authorized.

## Scope and result

All 10,001 child rows were evaluated with deterministic rules. The rewrite
preserved every child ID, parent link, source module/file/line, source
fingerprint, disposition and decision/owner reference. Only target-design
semantics (trigger clarification, input/output contract, validation rule,
state contract and target API/event intent) were normalized.

| Module | Rows | Command | Query | Legacy GET side effect | Menu query | Data | Job | Interface | File/export | Formula | Retired/no target |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| HRM | 1,654 | 632 | 524 | 23 | 177 | 141 | 5 | 44 | 58 | 20 | 30 |
| PER | 1,041 | 309 | 377 | 17 | 121 | 102 | 4 | 6 | 37 | 68 | 0 |
| TIM | 3,566 | 1,215 | 1,762 | 38 | 196 | 140 | 16 | 54 | 63 | 82 | 0 |
| PAY | 3,515 | 1,313 | 1,405 | 32 | 223 | 158 | 13 | 54 | 104 | 213 | 0 |
| SYS | 225 | 33 | 19 | 0 | 153 | 14 | 0 | 0 | 0 | 0 | 6 |
| **Total** | **10,001** | **3,502** | **4,087** | **110** | **870** | **555** | **38** | **158** | **262** | **383** | **36** |

`Command` includes ordinary service/application commands and explicit state
transitions; the other command-like types are shown separately. The totals in
each row are mutually exclusive and sum to the module row count.

## P1 findings closed

1. HTTP POST/PUT/PATCH/DELETE behavior now terminates at an explicit
   `COMMAND` target, with `Idempotency-Key`, `expectedVersion`, durable receipt,
   correlation ID and a guarded state lifecycle. A deliberately retired
   behavior instead terminates at `RETIRED_NO_TARGET`.
2. HTTP GET behavior now terminates at `QUERY` and `QUERY_ONLY`. The 110 legacy
   GET side effects are called out as `LEGACY_GET_SIDE_EFFECT` and moved to a
   guarded command contract; no target command begins with GET.
3. HRM specifically contains 139 POST, 98 PUT and 110 DELETE operations. Of
   these, 138/97/109 respectively map to `COMMAND`; one job-sequence operation
   of each verb maps to `RETIRED_NO_TARGET`. Zero maps to a GET-only target.
4. Job rows require a signed manifest/version, schema parameters, lease,
   idempotent attempt, row-count/error evidence and reconciliation receipt.
5. Interface rows require a provider-neutral adapter and mapping version,
   cursor/schema, quarantine, replay and reconciliation semantics.
6. File/document/export rows require governed object references, content
   digest, purpose/filter snapshot, malware scanning, expiry and download audit.
7. Formula rows require versioned typed rules, decimal scale/rounding,
   explicit null policy, input digest and reproducible intermediate/final
   lineage. No executable legacy or tenant expression is accepted.
8. Persistence rows require tenant identity, aggregate/schema version,
   half-open effective time and immutable history or versioned correction.
9. Deprecated target aliases are rejected across every row.

## Deterministic evidence

- Full-population validator:
  `python3 readiness-tools/validate_trace_semantics.py`
- Latest result:
  `TRACE_SEMANTICS=PASS checks=439858 rows=10001 modules=5 review_samples=58`
- Risk register: 58 deterministic representatives selected by minimum
  `sha256(module|child_type|semantic_class|child_id)`. It covers every
  module/child-type/semantic-class population: 31 HIGH, 19 MEDIUM and 8 LOW.
- Rebuild idempotence:
  `TRACE_SEMANTICS_REBUILD=PASS rows=10001 changed=0 identity_preserved=true`
- Generator replay is deterministic for HRM, PER and SYS; TIM/PAY use the same
  deterministic post-generation normalization until their future generators
  are introduced.

The validator also compares the risk register byte-for-logical-row against the
current population and fails if the register is stale, a source mutation maps
to a query, a query inherits a mutation lifecycle, a special behavior omits its
required contract terms, or a deprecated alias returns.

## Module regression results

| Validator | Result |
|---|---|
| HRM | `PASS checks=74222 parents=583 children=1654 decisions=15` |
| PER | `PASS checks=40476 parents=349 children=1041 decisions=16` |
| TIM | `PASS checks=140880 parents=568 children=3566 decisions=16` |
| PAY | `PASS checks=139260 parents=580 children=3515 decisions=18` |
| SYS | `PASS checks=3719 parents=189 children=225 decisions=13` |

The central code-readiness/checkpoint gate must invoke the full-population
validator above and reseal module package digests after these evidence changes.
