# HRIS transport schema contract

Status: `SCHEMA_RESOLUTION_COMPLETE`  
Implementation: `NOT_STARTED_G3`  
Production: `NOT_AUTHORIZED_G6`

## Authority and coverage

`transport-schema-resolution-register.csv` is the row-level authority for the 175 public HTTP operations registered by `api-pep-binding-register.csv`: HRM 16, PER 21, TIM 28, PAY 33, SYS 77. Every row binds the source operation, method, gateway path, source authorization alias, API PEP binding, request/path/query/header/response/error schema references, validation evidence, negative tests, and a canonical dereferenced transport-shape SHA-256. Duplicate or orphan rows are forbidden.

HRM operation semantics remain pinned to `session-evidence/hrm/g2-readiness/api-event-contracts.v1.json`. Because that source does not declare complete JSON Schema types for all public shapes, `hrm-transport-schema-supplement.v1.json` supplies closed local schemas without weakening source required fields. Its GET query property sets equal the source endpoint query lists exactly. HRM `X-Purpose-Code` is optional on the wire as the source declares; when absent, the owner derives the registered purpose from the authenticated route/PEP binding and never accepts a caller-selected escalation.

PER uses the actual OpenAPI at `session-evidence/per/g2-readiness/api-event-contracts.yaml`; register pointers resolve its operations, parameters, request bodies, success responses, and `Problem` schema. TIM, PAY, and non-reused SYS operations use their module-local `g2-transport-schemas.v1.json` definitions. Local object schemas are Draft 2020-12 closed objects with explicit types, required fields, enums, ranges, patterns, identifier formats, time/effective-date rules, money scale/currency rules, CAS, idempotency, durable receipts, and operation-specific query shapes.

## Wire rules

- Path template placeholders must equal the resolved path schema's `properties` and `required` sets. Generic `id` substitution is invalid.
- Query/list projections explicitly bind `cursor`, `asOf`, filters, requested fields, and freshness where the operation declares them. Detail operations use a separate empty query schema when they accept no query parameters.
- Local commands require `Idempotency-Key`; aggregate mutations requiring CAS also require `If-Match`. All 121 asynchronous `202` operations converge to one of six authorized receipt queries (HRM 1, PER 1, TIM 1, PAY 1, SYS auth 1, SYS platform 1). Receipt reads bind the sealed originating action, subject, population-scope digest, field-policy revision, purpose and authorization revision; current and originating decisions are re-evaluated and the more restrictive decision wins, with opaque `404` on mismatch. A read-only validation operation may return its pinned validation report directly.
- Errors are closed problem documents with integer HTTP status, stable code, correlation ID, and retryability. Commands reject unknown fields. Public identifiers are UUIDs; timestamps are RFC3339; business dates are ISO-8601; effective periods are half-open; currency is ISO-4217.
- TIM clock events use `IN|OUT|BREAK_START|BREAK_END` and `WEB|MOBILE|KIOSK|DEVICE|IMPORT|API`, and require canonical instant plus source-local datetime, timezone, UTC offset, DST resolution, instant authority, tzdb/rule versions and provenance digest.
- PAY pins `decimal-value-types.v1.json` by SHA-256 and mirrors its decimal-string patterns: InputAmount 19,6; RateDecimal 19,8; QuantityDecimal 19,6; CalculationDecimal 24,8; PostedMoney 19,4. Exponents, binary floats and database implicit rounding are forbidden. Formula scale is 0..8 with all six named modes, and calculation trace records exact before/after values, stage, scale, mode and policy digest.
- `ClosedTimeResult.v1` (최대 1,000,000 lines)와 `ApprovedCompensationPlanSnapshot.v1` (1..100,000 ordered lines)는 v1 JSON array 의미를 유지하되 모든 proxy가 stream-through하고 bounded reactive backpressure를 end-to-end로 전파한다. 압축 바이트와 streaming 해제 바이트를 할당 전에 각각 계수하며, compressed/uncompressed/per-line/line-count/compression-ratio ceiling을 하나라도 넘으면 즉시 실패한다. Array index 연속성(`ClosedTimeResult`) 또는 `lineSequence = index + 1` 연속성(Compensation), header+ordered-line incremental digest와 lineCount를 모두 검증한 뒤에만 staged rows를 원자적으로 공개한다. gap/duplicate, digest/count 불일치, 압축 해제 오류, 취소 또는 저장 오류는 staged rows 전체 rollback과 sealed quarantine receipt를 만들며 부분 snapshot은 조회할 수 없다.
- Authorization aliases are provenance only and must equal the alias in the referenced `api-pep-binding-register.csv` row. Canonical authorization remains enforced by that PEP binding; transport schemas do not create duties.

## Pinned HomePreference reuse

SYS-API-031 and SYS-API-032 preserve OpenAPI provenance from the source-characterization predecessor `5670877de7a39e94e75021c7e23cbbb553296c90` at `contracts/openapi/gateway-public.json`; that predecessor is not the executable entry baseline. G3 code starts from the current backend code-entry baseline `6f1ed92d2610ace3df75f094297032e8b476ef5d` resolved from `g0/integration-baseline-manifest.csv`. The predecessor OpenAPI file and GET/PUT operation plus request/response schema digests remain pinned and verified.

`SYS-API-032` is the sole named exception: `BASELINE_BODY_VERSION_CAS`. It keeps exact baseline PUT replacement semantics, uses request body `version` for CAS, and returns the synchronous baseline `HomePreferenceResponse`; no `Idempotency-Key`, `If-Match`, or durable receipt is invented. Both HomePreference operations require fixed `surfaceKey=hcm-home`, reuse the existing preference store, and create no table or duty. The exception cannot spread to another operation and no pending exception state is accepted.

## Controlled transfer

SYS-API-034 accepts canonical `transferKind` (`INGEST|EXPORT|DELIVERY|EXCHANGE`) and derives direction only from that enum (`INGEST=INBOUND`; all other kinds `OUTBOUND`); callers cannot submit `direction`. `EXPORT`, `DELIVERY`, and `EXCHANGE` additionally require both `recipientPolicyRef` and `egressPolicyRevision`. The request binds object version, SHA-256 digest, byte size, allowlisted media type, scanner key/version, `CLEAN` verdict and scan time, and a storage ETag/version/digest/size TOCTOU snapshot. Any mismatch, missing outbound policy binding, or non-clean verdict fails closed before receipt creation.

## Validation

Run:

```bash
python3 coding-readiness/validate_transport_schema_resolution.py
python3 coding-readiness/validate_transport_schema_resolution.py --self-test
```

The validator first requires the standalone API PEP validator to pass, then checks 175/175 parity, exact module counts, 121/121 asynchronous receipt convergence, source and schema pointer resolution, operation/path/auth equality, source-required preservation, operation-specific query and path sets, dereferenced shape digests, baseline SHA/digests, decimal SSOT, clock provenance, closed Home five-branch widget projection, exact seven-workbench Explorer persistence, valid closed-object representative instances, the single named exception, and readiness states. `--self-test` fail-closes unknown refs, required/type drift, operation path/auth drift, path placeholders, baseline/exception tampering, pending state, exception spread, controlled-transfer direction/kind/outbound policy, receipt route/context, clock enums, decimal trace evidence, Home discriminator/audience/field-policy escalation, and Explorer enum/cap/TTL/raw-payload drift.
