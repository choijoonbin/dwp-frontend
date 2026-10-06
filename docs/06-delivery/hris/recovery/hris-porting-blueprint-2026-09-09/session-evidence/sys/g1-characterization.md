# HRIS-SYS G1 Characterization

## Provenance and scope

- Baseline backend: `5670877de7a39e94e75021c7e23cbbb553296c90`
- Baseline frontend: `7635ce4223000ed83cb4965f8374d8a8433f1a62`
- Source mode: `BEHAVIORAL_REIMPLEMENTATION_NO_CODE_REUSE`
- Source evidence: pinned SYS and frontend sanitized views only; BENSK/ADDSK excluded.

## Coverage summary

- Parent artifacts: 189 / decided 189 / unknown 0
- Routes: 153; controllers: 22; entities: 14
- Child behaviors: 225
- Disposition: CONFIGURE=37, REBUILD=47, RETIRE=4, REUSE=101
- Target capabilities: 13; every parent and child has an owner, decision and acceptance evidence.

## Actors and authorization

SYS adopts the DWP app entitlement plus versioned access packages and atomic duties. Runtime authorization is the intersection of app entitlement, duty, tenant, population/scope, field/purpose policy, SoD, step-up, installed module/country pack and effective tenant configuration. UI hiding never substitutes for API enforcement. Development preview uses a synthetic local tenant and separate persona accounts; guards remain enabled.

## Journeys and commands

The target journeys are HRIS configuration publishing, product-access assignment, central automation operation, connector operation and reconciliation, communication template publishing, controlled evidence access, and role/scope home composition. Legacy list/detail/popup routes are consolidated into list-detail, studio or command-center workflows and are not copied one-for-one.

## Validation, state, and exceptions

Commands require schema validation, expected version and an idempotency key where repeatable. Configuration uses `DRAFT → VALIDATED → SIMULATED → APPROVAL_PENDING → PUBLISHED → SUPERSEDED/ROLLED_BACK`. Jobs and connectors use immutable attempts and receipts with `REQUESTED → LEASED → RUNNING → SUCCEEDED|FAILED|RESULT_UNKNOWN|QUARANTINED`. 403, 409, 422, retryable failures and result-unknown recovery are explicit states.

## Data ownership and retention

Auth owns entitlement/package/duty assignments; Platform owns configuration, automation and connector metadata; Approval, Notification and Audit retain their existing responsibilities; HRM/TIM/PAY/PER own domain facts and execution. Cross-service database foreign keys and direct repository calls are prohibited. Secrets are references only. Audit, access, export and run receipts are immutable and retention/legal-hold aware.

## Batch, interface, and document behavior

Batch and connector UI is centralized in DWP administrator surfaces, while domain execution stays in the domain service. Manifests are code-owned, signed and versioned; tenant administrators select enabled jobs, schedules, scopes and alerts. Imports are staged, validated, quarantined and reconcilable. Documents/files use object references, digest, malware scan, expiry and controlled access rather than arbitrary paths or FTP credentials.

## Redundancy and process improvements

Repeated module code, menu, role, approval, mail, notification, file and employee/organization stores are replaced with shared DWP contracts. Direct send endpoints, vendor-specific mobile login paths and unsafe generic execution are retired. Menu metadata is presentation; authorization remains capability-driven.

## Generic core, country pack, and tenant extension

Shared identity, automation, integration, audit and communication are DWP platform core. HR policy/reference data and home composition are product core with effective tenant configuration. Country-specific semantics are signed country packs; proprietary protocols and company-only behavior are signed extension packs. Customer forks and hardcoded tenant identifiers are forbidden.

## Target contract proposals

The definitive SYS implementation contract is `g2-implementation-contract.md`; physical design is `g2-schema-blueprint.sql`; API/event inventory is `g2-contract-catalog.csv`; synthetic verification is `g2-golden-scenarios.csv`. HRIS home is a role/scope widget dashboard; the 76-node catalog is retained as traceability and becomes a separate governed work explorer.

## Unknowns and decisions

There are no unresolved source dispositions for Core coding. Missing legacy operating exports are scoped to SKKF parity/cutover evidence. Real connector contracts, statutory data and production owner signatures are adapter/country-pack/production activation gates. They do not block generic Core implementation.

## Synthetic characterization tests

Tests cover tenant isolation, deny-by-default, SoD conflicts, draft/publish immutability, stale versions, idempotent job/connector retries, result-unknown recovery, secret redaction, mapping rollback, receipt replay, home widget partial failure and catalog-to-explorer completeness. Production fixtures must remain synthetic until an approved irreversible anonymization process exists.
