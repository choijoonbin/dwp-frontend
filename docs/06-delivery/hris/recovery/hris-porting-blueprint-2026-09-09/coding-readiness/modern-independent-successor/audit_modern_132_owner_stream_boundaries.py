#!/usr/bin/env python3
"""Independent, fail-closed owner-stream/schema audit for HRIS successors.

This reviewer-owned program deliberately does not import any canonical author or
generator module.  It treats the frozen 115-table acceptance policy, the physical
owner-prefix register, and the sealed Listening stream-authority successor as
independent inputs and audits a candidate directory without modifying it.
"""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


SCRIPT = Path(__file__).resolve()
INDEPENDENT_DIR = SCRIPT.parent
READINESS_DIR = INDEPENDENT_DIR.parent
DEFAULT_CANDIDATE = READINESS_DIR / "modern-canonical-candidate.q0mnJg"
DEFAULT_REPORT = INDEPENDENT_DIR / "reports" / "modern-132-owner-stream-boundary-q0mnjg-latest.v1.json"

EXACT_FILE = "modern-capability-exact-schema-contracts.v1.json"
CAUSAL_FILE = "modern-capability-operation-causal-contract-ssot.v2.json"
EVENT_FILE = "modern-capability-event-payload-contracts.v1.json"
IDENTITY_FILE = "modern-capability-public-identity-registry.v1.json"
SEMANTIC_FILE = "modern-capability-semantic-bindings.v1.json"
MANIFEST_FILE = "modern-capability-closed-set-manifest.v3.json"

AUTHORITY_PATH = READINESS_DIR / "sys-listening-stream-authority-successor.v1.json"
PREFIX_PATH = READINESS_DIR / "physical-owner-prefix-register.csv"
LEGACY_POLICY_PATH = INDEPENDENT_DIR / "global-hcm-table-expansion-acceptance-policy.v3.json"
V4_POLICY_PATH = INDEPENDENT_DIR / "global-hcm-table-expansion-acceptance-policy.v4.json"
V5_POLICY_PATH = INDEPENDENT_DIR / "global-hcm-table-expansion-acceptance-policy.v5.json"
V2_POLICY_PATH = INDEPENDENT_DIR / "global-hcm-table-expansion-acceptance-policy.v2.json"

EXPECTED_LEGACY_POLICY_SHA256 = "02fe8f0e5aebf06bc2c8b3cbe09f0947138310f6c921056c8be2f43d222cbd57"
EXPECTED_LEGACY_POLICY_SEAL = "8041c142ac96be31a4e4bd67a088bda1075147ec8111b388d572d3f35259d78a"
EXPECTED_V4_POLICY_SHA256 = "afb844e6ce31f588ec04b3fc46f759c616c13227742bc3d688d8f246d92c83de"
EXPECTED_V4_POLICY_SEAL = "a939167ed5167155cb8d08383415d8e518d25583bb2362fa7b2b5bfa95748b63"
EXPECTED_V5_POLICY_SHA256 = "ec29008105473639a2a6ffcf116295e410de4c017d5bf1c0fd5a02c228cb088b"
EXPECTED_V5_POLICY_SEAL = "4bdfd9282371ce9c6f32db6d2d50265b3480c8d4157d35132c1d7dccefcd69e2"
EXPECTED_V2_POLICY_SHA256 = "64bc16def08c4a87750a656a039588db67bba5ec5fad6fac0dbd1bed638e6444"
EXPECTED_V2_POLICY_SEAL = "36229b77ea56f94d61e9beee431b74d0413263853bb7e3b82951ae68534bfe86"
EXPECTED_V1_AUTHORITY_SHA256 = "62f110f36a4d26dab7dda3051e6baf1a5872a475b8f2a83cee19f2cd950496b1"
EXPECTED_V1_AUTHORITY_SEAL = "45973285a659239b080bb89cbb60d2ccd34899a44edea776461364643f525804"
EXPECTED_FROZEN_115_TABLE_SET_SHA256 = "7a8805795efade4334baa3a6f91d6180b1a0bb4ecec118688e25e86cebd2f2cd"
EXPECTED_DELTA_COUNT = 17
EXPECTED_V4_REMOVED_TABLES = {"sys_hris_listening_export_receipts"}

# Historical mode is content-addressed.  A directory called q0mnJg is not
# trusted merely because of its name, and a renamed byte-identical copy remains
# valid historical evidence.
HISTORICAL_Q0_MEMBER_SHA256 = {
    MANIFEST_FILE: "cd1305145a41217f73e5aebf66833a4077279a231712aaccdcab6e661fc94a94",
    EXACT_FILE: "9de24132f582ee2ac9d3564f1d2c87425b9a507a6a1f19bcdb57390c102c9e10",
    CAUSAL_FILE: "46ee398c3b0fca0e6cc39d966ea3c7ff7c427d954d0d4b5851695604f8ae31ce",
    EVENT_FILE: "2a69ac195f4e2e9795a8efb52a31d93dc85e8816a318b5263c9033f2a03023a8",
    SEMANTIC_FILE: "39d32729ff6ab3046407b38ee53a7c778bd72abe11ffb83709bd05677fa1fc01",
    IDENTITY_FILE: "6bf72a0cd7a7982d445baeb27afefedf23e3e6ea7126e8e6c03c2815116b9d8c",
}

LEGACY_V3_PROFILE = {
    "profileId": "HISTORICAL_Q0_V3_132",
    "policyPath": LEGACY_POLICY_PATH,
    "policySha256": EXPECTED_LEGACY_POLICY_SHA256,
    "policySeal": EXPECTED_LEGACY_POLICY_SEAL,
    "tableCount": 132,
    "removedTableIds": set(),
    "netDelta": 17,
    "authorityContractId": "dwp.hris.sys.listening.stream-authority-successor.v1",
    "authorityCounts": {
        "publicOperations": 8,
        "canonicalPublicEvents": 6,
        "ownerPortOperations": 15,
        "streams": 4,
        "plannedTables": 24,
        "internalPortMessages": 6,
    },
}

SUCCESSOR_V5_PROFILE = {
    "profileId": "SUCCESSOR_V5_131",
    "policyPath": V5_POLICY_PATH,
    "policySha256": EXPECTED_V5_POLICY_SHA256,
    "policySeal": EXPECTED_V5_POLICY_SEAL,
    "tableCount": 131,
    "removedTableIds": EXPECTED_V4_REMOVED_TABLES,
    "netDelta": 16,
    "authorityContractId": "dwp.hris.sys.listening.stream-authority-successor.v2",
    "authorityCounts": {
        "publicOperations": 10,
        "canonicalPublicEvents": 7,
        "ownerPortOperations": 18,
        "streams": 4,
        "plannedTables": 23,
        "internalPortMessages": 6,
    },
}

EXPECTED_V2_PUBLIC_OPERATIONS = {
    "modern.listening.active.query",
    "modern.listening.response.submit",
    "modern.listening.surveys.query",
    "modern.listening.survey.create",
    "modern.listening.survey.revise",
    "modern.listening.survey.publish",
    "modern.listening.survey.close",
    "modern.listening.cohorts.query",
    "modern.listening.action.create",
    "modern.listening.action.complete",
}
EXPECTED_V2_PUBLIC_EVENTS = {
    "EmployeeListeningSurveyCreated.v3",
    "EmployeeListeningSurveyRevised.v3",
    "EmployeeListeningSurveyPublished.v3",
    "EmployeeListeningSurveyClosed.v3",
    "EmployeeListeningActionCreated.v3",
    "EmployeeListeningActionCompleted.v3",
    "EmployeeListeningCohortProjectionPublished.v1",
}

KNOWN_NON_OWNER_CONTROL_TABLES = {
    "sys_hris_command_receipts",
    "sys_hris_outbox_events",
    "sys_domain_event_outbox",
    "sys_domain_event_inbox",
}

EXPECTED_STREAM_CONTROL_TABLES = {
    "platform-hris-configuration": {
        "receipt": "sys_hris_listening_operation_receipts",
        "outbox": "sys_hris_listening_domain_outbox",
    },
    "platform-hris-listening-protected": {
        "receipt": "sys_hris_listening_protected_receipts",
        "outbox": "sys_hris_listening_protected_outbox",
    },
    "platform-hris-insights": {
        "receipt": "sys_hris_listening_insights_inbox",
        "outbox": "sys_hris_listening_insights_outbox",
    },
    "auth-hris-participation-issuer": {
        "receipt": "sys_hris_listening_issuer_receipts",
        "outbox": "sys_hris_listening_issuer_outbox",
    },
}

REQUIRED_CLOSURES = {
    "AGGREGATE_ROOT_OUTSIDE_OWNER_STREAM": "Move the aggregate root to the authoritative stream or replace the operation with a sealed owner-port orchestration contract.",
    "CONSTRAINT_COLUMN_NOT_DECLARED": "Declare the exact typed column or remove/rewrite the constraint; then execute PostgreSQL DDL validation.",
    "CROSS_OWNER_PUBLIC_REF_NO_AUTHORIZED_INGRESS": "Add an independently sealed, versioned owner-port/event ingress owned by both boundaries; direct repository/select access remains forbidden.",
    "CROSS_OWNER_VERSION_PROOF_MISSING": "Carry and persist exact owner version/revision plus as-of/lineage proof with the public UUID.",
    "DECLARED_CROSS_SCHEMA_FK_FORBIDDEN": "Remove every physical cross-schema FK and use a typed public UUID/version owner-port or event contract.",
    "DML_SOURCE_COLUMN_NOT_DECLARED": "Declare and populate each locked source fact in the owner schema, or replace the source expression with a valid sealed message/owner-port field.",
    "EMBEDDED_OPERATION_AUTHORITY_DRIFT": "Regenerate the operation from the sealed publicOperationBinding without self-authored overrides.",
    "FK_MODE_NOT_CLOSED": "Use only a valid owner-local composite FK or a typed opaque PUBLIC_UUID boundary reference.",
    "FORBIDDEN_PUBLIC_EVENT_FIELD": "Remove the forbidden identity/sensitive field and expose only the event payload class allowlist.",
    "FOREIGN_LOCAL_ID_REFERENCE": "Replace the foreign BIGINT/local ID with a public UUID plus exact revision/as-of owner proof; migrate no local IDs across streams.",
    "FOREIGN_LOCAL_SELECTOR": "Replace the local selector with a typed versioned owner port/event projection; the caller stream must not query the foreign repository.",
    "FROZEN_BASELINE_HASH_DRIFT": "Restore the immutable reviewed 115-table baseline policy bytes before any candidate review.",
    "IDENTITY_REGISTRY_REFERENCE_DRIFT": "Make exact schema and public identity registry agree on one typed entity/id-space contract.",
    "INTERNAL_HANDLER_FOREIGN_DML": "Restrict inbox/domain/outbox DML to the handler target stream and use a separate signed message for foreign effects.",
    "INTERNAL_PORT_HANDLER_CARDINALITY": "Provide exactly one owner-local consumer for the sealed internal message.",
    "INTERNAL_PORT_PAYLOAD_FIELDS_MISSING": "Declare every sealed message field with exact type/classification and persist the required identity/version/lineage facts.",
    "INTERNAL_PORT_SOURCE_STREAM_UNBOUND": "Pin the exact source stream and signature authority on the handler contract.",
    "INTERNAL_PORT_TARGET_STREAM_DRIFT": "Move the consumer to the sealed target stream and its owner-local inbox/domain/outbox transaction.",
    "LISTENING_STATIC_AUTHORITY_COUNT_DRIFT": "Reconcile the canonical static source and derived sealed authority, publish stable hashes, then regenerate a distinct candidate.",
    "LISTENING_TABLE_STREAM_DRIFT": "Bind the table to the exact stream in tableOwnership and physical owner-prefix authority.",
    "LOCAL_FK_COLUMN_MISSING": "Declare matching source/target columns or remove the invalid local FK.",
    "LOCAL_FK_CROSSES_OWNER_STREAM": "Remove the FK and local join; transport only a public UUID/version through a sealed owner port/event.",
    "LOCAL_FK_SHAPE_INVALID": "Use exact [tenant_id,target_internal_id] owner-local shape with identical SQL types.",
    "LOCAL_FK_SQL_TYPE_MISMATCH": "Align source and target owner-local FK SQL types exactly.",
    "LOCAL_FK_TARGET_MISSING": "Declare the owner-local target table in the closed set or remove the FK.",
    "LOCAL_FK_TARGET_NOT_CANDIDATE_KEY": "Add an exact target candidate key or retarget the FK to the owner-local internal identity tuple.",
    "MANIFEST_TABLE_SET_DRIFT": "Regenerate the manifest from the exact 132-table set and seal the resulting hash.",
    "OPERATION_DML_OUTSIDE_OWNER_STREAM": "Replace foreign/generic writes with the authoritative stream's exact owner-local receipt/domain/outbox tables.",
    "OPERATION_FOREIGN_TABLE_ACCESS": "Remove every foreign read/write/lineage table token and represent cross-owner facts only through a sealed owner port/event.",
    "OPAQUE_BOUNDARY_REFERENCE_NOT_PUBLIC_UUID": "Retype the opaque boundary reference as PUBLIC_UUID with matching registry contract.",
    "OWNER_BOUNDARY_INPUTS_NOT_PINNED": "Pin the exact sealed stream-authority and physical owner-prefix register SHA-256 values in the candidate manifest.",
    "OWNER_LOCAL_CONTROL_DML_MISSING": "Claim/complete the stream-local receipt and append the stream-local outbox in the same owner transaction.",
    "OWNER_PREFIX_AUTHORITY_DRIFT": "Reconcile owner service/schema in the prefix register and sealed stream authority before regeneration.",
    "OWNER_PREFIX_RESOLUTION_NOT_EXACT": "Give the table one and only one physical owner-prefix allocation.",
    "PUBLIC_EVENT_CLOSED_SET_DRIFT": "Make event schemas exactly equal to the sealed six-event set, with no unreviewed additions.",
    "PUBLIC_EVENT_FOREIGN_SOURCE": "Source event fields only from the event owner's committed state/local receipt, or from an admitted immutable owner-port proof.",
    "PUBLIC_EVENT_PRODUCER_SET_DRIFT": "Make producer ownership exactly equal to the sealed six-event authority set.",
    "PUBLIC_OPERATION_CLOSED_SET_DRIFT": "Make every canonical surface exactly equal to the sealed eight-operation set, or first publish a separately reviewed successor authority.",
    "PUBLIC_OPERATION_PATH_DRIFT": "Use the exact authoritative method/path on exact, causal, and semantic surfaces.",
    "QUERY_FILTER_NOT_CLOSED_ON_OWNER_PROJECTION": "Materialize a privacy-safe survey identity/version lineage in Insights via the sealed cohort package, then filter only that local projection.",
    "TABLE_OWNER_SCHEMA_BINDING_NOT_SELF_CONTAINED": "Self-contain owner/schema on all table rows or pin one immutable external mapping that resolves all 132 exactly once.",
    "TABLE_SCOPE_DELTA_DRIFT": "Restore exact frozen115 + exact17 - zero removals scope.",
    "TABLE_SET_NOT_EXACT_132": "Publish exactly 132 distinct table specifications.",
    "UNAUTHORIZED_OPERATION_FOREIGN_ACCESS": "Remove the unsealed operation or obtain a new independently reviewed authority and eliminate its direct foreign access.",
    "SUCCESSOR_AUTHORITY_V2_REQUIRED": "Supply a distinct sealed v2 Listening authority for non-q0 review; immutable v1 is predecessor evidence only.",
    "SUCCESSOR_AUTHORITY_SEAL_INVALID": "Recompute the v2 self-seal over canonical JSON excluding sealedPayloadSha256 and republish immutable bytes.",
    "SUCCESSOR_AUTHORITY_V1_PIN_MISSING": "Pin the immutable v1 predecessor path and exact SHA-256 in v2.",
    "SUCCESSOR_AUTHORITY_PRODUCT_CLOSURE_DRIFT": "Restore the exact profile-authorized public operations, events, owner ports, streams, planned tables, and internal messages.",
    "SCOPE_POLICY_MODE_UNRESOLVED": "Supply an exact v5 policy pin with an explicitly supplied sealed v2 authority, or use the byte-exact historical q0/v3 evidence set with v1.",
    "SCOPE_POLICY_PIN_DRIFT": "Pin the exact immutable policy file hash, payload seal, predecessor hash/seal, and reviewed scope-reduction decision for this candidate profile.",
    "SCOPE_POLICY_CHAIN_DRIFT": "Restore the immutable v5 -> v4 -> v3 -> v2 policy chain and exact payload seals before revalidation.",
    "REMOVED_TABLE_DANGLING_REFERENCE": "Remove every executable/schema/lineage/authority reference to the reviewed orphan table; retain it only in the manifest removal record.",
    "DANGLING_LOCAL_FK_TARGET": "Retarget or remove every local FK whose target is outside the exact active table set.",
}


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def file_sha256(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def sealed_payload_sha256(value: dict[str, Any]) -> str:
    return sha256_bytes(canonical_json({key: item for key, item in value.items() if key != "sealedPayloadSha256"}))


def expected_v5_manifest_policy_pin() -> dict[str, Any]:
    return {
        "path": "modern-independent-successor/global-hcm-table-expansion-acceptance-policy.v5.json",
        "fileSha256": EXPECTED_V5_POLICY_SHA256,
        "sealedPayloadSha256": EXPECTED_V5_POLICY_SEAL,
        "predecessorPolicySha256": EXPECTED_V4_POLICY_SHA256,
        "predecessorPolicySealedPayloadSha256": EXPECTED_V4_POLICY_SEAL,
        "independentReviewSha256": "da7b9a3b5adfe0246f9d53e4dd42d4275135b303033782a7c84450f822198075",
        "scopeReductionReviewSha256": "99e96abe87d7141f3d7ff6a0185db5f1820a8385e700d34d0df3b8e11a322604",
    }


def resolve_review_profile(
    manifest: dict[str, Any],
    authority: dict[str, Any],
    authority_hash: str,
    candidate_hashes: dict[str, str],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Resolve v3-history versus v5-successor without trusting a directory name.

    v5 is selected by the exact manifest policy pin together with the explicitly
    supplied authority contract.  Historical v3 mode is available only for the
    byte-exact q0 evidence set and the immutable v1 authority.  Suspicious mixed
    inputs are audited as v5 and carry a fail-closed mode-resolution finding.
    """
    errors: list[dict[str, Any]] = []
    scope = manifest.get("tableScopeChange") or {}
    pin = scope.get("acceptancePolicy") or {}
    contract_id = authority.get("contractId")
    owner_pin = (manifest.get("ownerBoundaryInputs") or {}).get("listeningStreamAuthority") or {}
    v5_signal = bool(pin) or contract_id == SUCCESSOR_V5_PROFILE["authorityContractId"] or scope.get(
        "activeTableSpecifications"
    ) == SUCCESSOR_V5_PROFILE["tableCount"]

    if v5_signal:
        expected_pin = expected_v5_manifest_policy_pin()
        if pin != expected_pin:
            errors.append({"reason": "V5_MANIFEST_POLICY_PIN_MISMATCH", "expected": expected_pin, "actual": pin})
        if contract_id != SUCCESSOR_V5_PROFILE["authorityContractId"]:
            errors.append({
                "reason": "V5_AUTHORITY_CONTRACT_MISMATCH",
                "expected": SUCCESSOR_V5_PROFILE["authorityContractId"],
                "actual": contract_id,
            })
        expected_owner_pin = {
            "contractId": SUCCESSOR_V5_PROFILE["authorityContractId"],
            "path": "coding-readiness/sys-listening-stream-authority-successor.v2.json",
            "fileSha256": authority_hash,
            "sealedPayloadSha256": authority.get("sealedPayloadSha256"),
        }
        if owner_pin != expected_owner_pin:
            errors.append({
                "reason": "V5_EXPLICIT_AUTHORITY_PIN_MISMATCH",
                "expected": expected_owner_pin,
                "actual": owner_pin,
            })
        return dict(SUCCESSOR_V5_PROFILE), errors

    historical_members_match = all(
        candidate_hashes.get(name) == expected for name, expected in HISTORICAL_Q0_MEMBER_SHA256.items()
    )
    if not historical_members_match:
        errors.append({
            "reason": "LEGACY_MODE_REQUIRES_BYTE_EXACT_HISTORICAL_Q0",
            "expected": HISTORICAL_Q0_MEMBER_SHA256,
            "actual": {name: candidate_hashes.get(name) for name in HISTORICAL_Q0_MEMBER_SHA256},
        })
    if authority_hash != EXPECTED_V1_AUTHORITY_SHA256 or contract_id != LEGACY_V3_PROFILE["authorityContractId"]:
        errors.append({
            "reason": "LEGACY_MODE_REQUIRES_IMMUTABLE_V1_AUTHORITY",
            "expected": {
                "contractId": LEGACY_V3_PROFILE["authorityContractId"],
                "sha256": EXPECTED_V1_AUTHORITY_SHA256,
            },
            "actual": {"contractId": contract_id, "sha256": authority_hash},
        })
    return dict(LEGACY_V3_PROFILE), errors


def snake_case(value: str) -> str:
    value = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", value)
    return value.replace("-", "_").lower()


def table_tokens(value: Any, table_names: set[str]) -> set[str]:
    """Return canonical/known-control table tokens mentioned in an arbitrary value."""
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, sort_keys=True)
    candidates = table_names | KNOWN_NON_OWNER_CONTROL_TABLES
    return {name for name in candidates if re.search(rf"(?<![A-Za-z0-9_]){re.escape(name)}(?![A-Za-z0-9_])", text)}


def iter_strings(value: Any, path: str = "$") -> Iterable[tuple[str, str]]:
    if isinstance(value, str):
        yield path, value
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from iter_strings(item, f"{path}[{index}]")
    elif isinstance(value, dict):
        for key, item in value.items():
            yield from iter_strings(item, f"{path}.{key}")


def add_finding(
    findings: list[dict[str, Any]],
    rule_id: str,
    subject: str,
    detail: str,
    evidence: Any,
    severity: str = "P0",
) -> None:
    findings.append(
        {
            "ruleId": rule_id,
            "severity": severity,
            "subject": subject,
            "detail": detail,
            "evidence": evidence,
            "requiredClosure": REQUIRED_CLOSURES.get(
                rule_id,
                "Correct the independently reproduced contract violation and rerun this validator to zero findings.",
            ),
        }
    )


def load_prefix_rows() -> list[dict[str, str]]:
    with PREFIX_PATH.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def prefix_row_matches(row: dict[str, str], table: dict[str, Any]) -> bool:
    if row["session"] != table.get("session"):
        return False
    table_name = table["tableName"]
    scope = row["table_source_scope"]
    capability = table.get("capabilityId")
    # The audited set contains modern capability tables only.  Broad BASE_SYS
    # rows also start with sys_ and must never shadow the narrower modern AI,
    # Analytics, or four Listening stream allocations.
    if scope.startswith("BASE_SYS_"):
        return False
    if scope == "MODERN_SYS_AI" and capability != "HRIS.MODERN.GOVERNED_AI":
        return False
    if scope == "MODERN_SYS_ANALYTICS" and capability != "HRIS.MODERN.PEOPLE_ANALYTICS":
        return False
    if scope.startswith("SUCCESSOR_SYS_LISTEN_") and capability != "HRIS.MODERN.EMPLOYEE_LISTENING":
        return False
    allowed = [part.strip() for part in row["allowed_prefixes"].split("|") if part.strip()]
    if scope.startswith("SUCCESSOR_SYS_LISTEN_"):
        return table_name in allowed
    return any(table_name.startswith(prefix) for prefix in allowed)


def build_owner_inventory(
    exact: dict[str, Any], authority: dict[str, Any], prefix_rows: list[dict[str, str]], findings: list[dict[str, Any]]
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    authority_tables = {row["tableName"]: row for row in authority["tableOwnership"]}
    authority_streams = {row["streamKey"]: row for row in authority["authorityStreams"]}
    owners: dict[str, dict[str, Any]] = {}
    inventory: list[dict[str, Any]] = []

    for table in exact["tableSpecifications"]:
        name = table["tableName"]
        matches = [row for row in prefix_rows if prefix_row_matches(row, table)]
        if len(matches) != 1:
            add_finding(
                findings,
                "OWNER_PREFIX_RESOLUTION_NOT_EXACT",
                name,
                "Every table must resolve to exactly one physical owner-prefix binding.",
                {"matchingBindingIds": [row["binding_id"] for row in matches], "session": table.get("session")},
            )
            continue
        row = matches[0]
        logical_owner = row["binding_id"]
        stream_key = None
        if name in authority_tables:
            stream_key = authority_tables[name]["streamKey"]
            logical_owner = stream_key
            expected_stream = table.get("streamKey")
            if expected_stream != stream_key:
                add_finding(
                    findings,
                    "LISTENING_TABLE_STREAM_DRIFT",
                    name,
                    "Listening table streamKey differs from the sealed stream authority.",
                    {"candidate": expected_stream, "authority": stream_key},
                )
            stream = authority_streams.get(stream_key, {})
            if stream.get("databaseSchema") != row["database_schema"] or stream.get("ownerService") != row["owner_service"]:
                add_finding(
                    findings,
                    "OWNER_PREFIX_AUTHORITY_DRIFT",
                    name,
                    "Physical prefix and Listening authority disagree on schema/service ownership.",
                    {
                        "prefix": {"schema": row["database_schema"], "service": row["owner_service"]},
                        "authority": {"schema": stream.get("databaseSchema"), "service": stream.get("ownerService")},
                    },
                )
        owner = {
            "tableName": name,
            "session": table.get("session"),
            "capabilityId": table.get("capabilityId"),
            "bindingId": row["binding_id"],
            "logicalOwner": logical_owner,
            "streamKey": stream_key,
            "ownerService": row["owner_service"],
            "boundedContext": row["bounded_context"],
            "databaseSchema": row["database_schema"],
            "crossBoundaryRule": row["cross_boundary_rule"],
        }
        owners[name] = owner
        inventory.append(owner)
    return owners, sorted(inventory, key=lambda row: row["tableName"])


def full_column_map(table: dict[str, Any], common_contract: dict[str, Any]) -> dict[str, str]:
    result: dict[str, str] = {}
    for column in common_contract.get("columns", []):
        if column["name"] != "__internal_id__":
            result[column["name"]] = column["sqlType"]
    result[table["idColumn"]["name"]] = table["idColumn"]["sqlType"]
    for column in table.get("columns", []):
        result[column["name"]] = column["sqlType"]
    return result


def candidate_keys(table: dict[str, Any]) -> set[tuple[str, ...]]:
    keys = {tuple(key["columns"]) for key in table.get("uniqueKeys", [])}
    # The tenant-scoped exact contract makes the physical row identity an implicit
    # candidate key even when it is represented by idColumn rather than uniqueKeys.
    keys.add(("tenant_id", table["idColumn"]["name"]))
    return keys


def validate_table_constraints(
    exact: dict[str, Any], owners: dict[str, dict[str, Any]], findings: list[dict[str, Any]]
) -> None:
    tables = {table["tableName"]: table for table in exact["tableSpecifications"]}
    columns = {name: full_column_map(table, exact["commonTableContract"]) for name, table in tables.items()}

    for name, table in sorted(tables.items()):
        known_columns = columns[name]
        declared_cross = table.get("crossSchemaForeignKeys", [])
        if declared_cross:
            add_finding(
                findings,
                "DECLARED_CROSS_SCHEMA_FK_FORBIDDEN",
                name,
                "crossSchemaForeignKeys must be an exact empty set for every owner stream.",
                declared_cross,
            )

        for family, objects in (
            ("uniqueKey", table.get("uniqueKeys", [])),
            ("index", table.get("indexes", [])),
            ("check", table.get("checks", [])),
        ):
            for obj in objects:
                missing = sorted(set(obj.get("columns", [])) - set(known_columns))
                if missing:
                    add_finding(
                        findings,
                        "CONSTRAINT_COLUMN_NOT_DECLARED",
                        f"{name}:{obj.get('constraintId') or obj.get('indexId')}",
                        f"{family} names columns absent from the exact table contract.",
                        {"missingColumns": missing},
                    )

        for fk in table.get("foreignKeys", []):
            subject = f"{name}:{fk.get('constraintId', 'UNNAMED')}"
            if fk.get("mode") == "OPAQUE_CROSS_BOUNDARY_REFERENCE":
                bad_columns = []
                declared_columns = {column["name"]: column for column in table.get("columns", [])}
                for column_name in fk.get("columns", []):
                    column = declared_columns.get(column_name)
                    reference = (column or {}).get("referenceContract") or {}
                    if (
                        not column
                        or column.get("sqlType") != "UUID"
                        or reference.get("idSpace") != "PUBLIC_UUID"
                    ):
                        bad_columns.append(
                            {
                                "column": column_name,
                                "sqlType": (column or {}).get("sqlType"),
                                "idSpace": reference.get("idSpace"),
                            }
                        )
                if bad_columns:
                    add_finding(
                        findings,
                        "OPAQUE_BOUNDARY_REFERENCE_NOT_PUBLIC_UUID",
                        subject,
                        "Opaque cross-boundary references must be typed PUBLIC_UUID columns.",
                        bad_columns,
                    )
                continue
            if fk.get("mode") != "LOCAL_COMPOSITE_FK":
                add_finding(
                    findings,
                    "FK_MODE_NOT_CLOSED",
                    subject,
                    "Foreign-key mode is neither LOCAL_COMPOSITE_FK nor OPAQUE_CROSS_BOUNDARY_REFERENCE.",
                    {"mode": fk.get("mode")},
                )
                continue
            target_name = fk.get("target")
            target = tables.get(target_name)
            if target is None:
                add_finding(
                    findings,
                    "LOCAL_FK_TARGET_MISSING",
                    subject,
                    "LOCAL_COMPOSITE_FK target is absent from the exact 132-table set.",
                    {"target": target_name},
                )
                continue
            source_columns = tuple(fk.get("columns", []))
            target_columns = tuple(fk.get("targetColumns", []))
            if (
                len(source_columns) < 2
                or len(source_columns) != len(target_columns)
                or source_columns[0] != "tenant_id"
                or target_columns[0] != "tenant_id"
            ):
                add_finding(
                    findings,
                    "LOCAL_FK_SHAPE_INVALID",
                    subject,
                    "LOCAL_COMPOSITE_FK must be an equal-width tuple beginning with tenant_id on both sides.",
                    {"columns": source_columns, "targetColumns": target_columns},
                )
            missing_source = [column for column in source_columns if column not in known_columns]
            missing_target = [column for column in target_columns if column not in columns[target_name]]
            if missing_source or missing_target:
                add_finding(
                    findings,
                    "LOCAL_FK_COLUMN_MISSING",
                    subject,
                    "LOCAL_COMPOSITE_FK references an undeclared source or target column.",
                    {"missingSource": missing_source, "missingTarget": missing_target},
                )
            else:
                type_pairs = [
                    {"source": s, "sourceType": known_columns[s], "target": t, "targetType": columns[target_name][t]}
                    for s, t in zip(source_columns, target_columns)
                    if known_columns[s] != columns[target_name][t]
                ]
                if type_pairs:
                    add_finding(
                        findings,
                        "LOCAL_FK_SQL_TYPE_MISMATCH",
                        subject,
                        "LOCAL_COMPOSITE_FK source and target SQL types must be identical.",
                        type_pairs,
                    )
            if target_columns not in candidate_keys(target):
                add_finding(
                    findings,
                    "LOCAL_FK_TARGET_NOT_CANDIDATE_KEY",
                    subject,
                    "LOCAL_COMPOSITE_FK target tuple is not an exact declared/implicit candidate key.",
                    {"target": target_name, "targetColumns": target_columns, "candidateKeys": sorted(candidate_keys(target))},
                )
            source_owner = owners.get(name)
            target_owner = owners.get(target_name)
            if source_owner and target_owner and source_owner["logicalOwner"] != target_owner["logicalOwner"]:
                add_finding(
                    findings,
                    "LOCAL_FK_CROSSES_OWNER_STREAM",
                    subject,
                    "LOCAL_COMPOSITE_FK crosses an owner stream and is therefore a physical cross-schema/owner dependency.",
                    {
                        "sourceTable": name,
                        "sourceOwner": source_owner["logicalOwner"],
                        "sourceSchema": source_owner["databaseSchema"],
                        "targetTable": target_name,
                        "targetOwner": target_owner["logicalOwner"],
                        "targetSchema": target_owner["databaseSchema"],
                    },
                )


def validate_reference_boundaries(
    exact: dict[str, Any], identity: dict[str, Any], owners: dict[str, dict[str, Any]], findings: list[dict[str, Any]]
) -> None:
    tables = {table["tableName"]: table for table in exact["tableSpecifications"]}
    identity_columns = identity.get("physicalColumns", {})
    cross_public_refs: list[dict[str, Any]] = []
    for source_name, table in sorted(tables.items()):
        for column in table.get("columns", []):
            ref = column.get("referenceContract") or {}
            entity = ref.get("entityType")
            if not isinstance(entity, str) or not entity.startswith("table:"):
                continue
            target_name = entity.removeprefix("table:")
            if target_name not in tables or source_name not in owners or target_name not in owners:
                continue
            registry_ref = identity_columns.get(f"{source_name}.{column['name']}")
            if registry_ref != ref:
                add_finding(
                    findings,
                    "IDENTITY_REGISTRY_REFERENCE_DRIFT",
                    f"{source_name}.{column['name']}",
                    "Exact-schema and public-identity registry reference contracts differ.",
                    {"exactSchema": ref, "identityRegistry": registry_ref},
                )
            if owners[source_name]["logicalOwner"] == owners[target_name]["logicalOwner"]:
                continue
            evidence = {
                "sourceTable": source_name,
                "sourceColumn": column["name"],
                "sourceOwner": owners[source_name]["logicalOwner"],
                "targetTable": target_name,
                "targetOwner": owners[target_name]["logicalOwner"],
                "idSpace": ref.get("idSpace"),
                "sqlType": column.get("sqlType"),
            }
            if ref.get("idSpace") != "PUBLIC_UUID" or column.get("sqlType") != "UUID":
                add_finding(
                    findings,
                    "FOREIGN_LOCAL_ID_REFERENCE",
                    f"{source_name}.{column['name']}",
                    "A cross-owner reference leaks an owner-local/internal identity.",
                    evidence,
                )
            else:
                cross_public_refs.append(evidence)

    # The only two cross-owner public references in q0 need explicit ingress/version
    # proof.  One is supposed to arrive through the signed admission-install port;
    # the other has no authorized configuration ingress and is locally selected.
    for ref in cross_public_refs:
        if ref["sourceTable"] == "sys_hris_listening_actions" and ref["targetTable"] == "sys_hris_listening_cohort_projections":
            action = next(
                (op for op in exact["operationBindings"] if op.get("operationId") == "modern.listening.action.create"), None
            )
            body_names = {field["name"] for field in (action or {}).get("requestSchema", {}).get("body", [])}
            if not ({"cohortProjectionVersion", "cohortProjectionRevision"} & body_names):
                add_finding(
                    findings,
                    "CROSS_OWNER_VERSION_PROOF_MISSING",
                    "modern.listening.action.create:cohortProjectionId",
                    "Configuration persists an Insights projection ID without an exact projection version/revision proof.",
                    {**ref, "requestBodyFields": sorted(body_names)},
                )
            add_finding(
                findings,
                "CROSS_OWNER_PUBLIC_REF_NO_AUTHORIZED_INGRESS",
                "sys_hris_listening_actions.cohort_projection_public_id",
                "No sealed Insights-to-Configuration owner port/event contract authorizes this materialized reference.",
                ref,
            )


def expected_authority_maps(authority: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    operations = {row["operationId"]: row for row in authority["publicOperationBindings"]}
    messages = {row["messageName"]: row for row in authority["eventOwnership"]["internalPortMessages"]}
    events = {row["eventName"]: row for row in authority["eventOwnership"]["canonicalPublicEvents"]}
    return operations, messages, events


def op_table_locations(op: dict[str, Any], table_names: set[str]) -> dict[str, list[str]]:
    locations: dict[str, list[str]] = defaultdict(list)
    for path, value in iter_strings(op):
        for table in table_tokens(value, table_names):
            locations[table].append(path)
    return {table: sorted(set(paths)) for table, paths in sorted(locations.items())}


def validate_operations(
    exact: dict[str, Any],
    causal: dict[str, Any],
    semantic: dict[str, Any],
    authority: dict[str, Any],
    owners: dict[str, dict[str, Any]],
    findings: list[dict[str, Any]],
) -> None:
    auth_ops, _, _ = expected_authority_maps(authority)
    port_contracts = {
        row.get("ownerPortOperation"): row
        for row in authority.get("ownerPortOperationContracts", [])
        if isinstance(row, dict) and row.get("ownerPortOperation")
    }
    exact_ops = {op["operationId"]: op for op in exact["operationBindings"]}
    causal_ops = {op["operationId"]: op for op in causal["operations"]}
    semantic_ops = {op["operationId"]: op for op in semantic["operations"]}
    candidate_listening_sets = {
        "exact": {op_id for op_id in exact_ops if op_id.startswith("modern.listening.")},
        "causal": {op_id for op_id in causal_ops if op_id.startswith("modern.listening.")},
        "semantic": {op_id for op_id in semantic_ops if op_id.startswith("modern.listening.")},
    }
    expected_set = set(auth_ops)
    for surface, actual_set in candidate_listening_sets.items():
        if actual_set != expected_set:
            add_finding(
                findings,
                "PUBLIC_OPERATION_CLOSED_SET_DRIFT",
                surface,
                "Listening public operations must equal the sealed exact-eight authority set.",
                {"missing": sorted(expected_set - actual_set), "extra": sorted(actual_set - expected_set)},
            )

    table_names = set(owners)
    for op_id, binding in sorted(auth_ops.items()):
        owner = binding["authoritativeStreamKey"]
        owner_tables = {name for name, row in owners.items() if row["logicalOwner"] == owner}
        exact_op = exact_ops.get(op_id)
        causal_op = causal_ops.get(op_id)
        semantic_op = semantic_ops.get(op_id)
        missing_surfaces = [name for name, value in (("exact", exact_op), ("causal", causal_op), ("semantic", semantic_op)) if value is None]
        if missing_surfaces:
            add_finding(
                findings,
                "AUTHORITY_OPERATION_SURFACE_MISSING",
                op_id,
                "An authoritative operation is missing from one or more canonical candidate surfaces.",
                {"missingSurfaces": missing_surfaces},
            )
            continue

        expected_method, expected_path = binding["publicPath"].split(" ", 1)
        surface_values = {
            "exact": f"{exact_op.get('method')} {exact_op.get('path')}",
            "causal": f"{causal_op.get('method')} {causal_op.get('path')}",
            "semantic": f"{semantic_op.get('method')} {semantic_op.get('path')}",
        }
        expected_surface = f"{expected_method} {expected_path}"
        drift = {surface: value for surface, value in surface_values.items() if value != expected_surface}
        if drift:
            add_finding(
                findings,
                "PUBLIC_OPERATION_PATH_DRIFT",
                op_id,
                "Canonical operation path/method differs from its authoritative binding.",
                {"expected": expected_surface, "actual": drift},
            )

        embedded = causal_op.get("listeningAuthority")
        if embedded != binding:
            add_finding(
                findings,
                "EMBEDDED_OPERATION_AUTHORITY_DRIFT",
                op_id,
                "Candidate embedded Listening authority is not byte-semantically equal to the sealed binding.",
                {"expected": binding, "actual": embedded},
            )

        for selector in causal_op.get("selectors", []):
            target = selector.get("targetTable")
            if isinstance(target, str) and target.startswith("OWNER_PORT::"):
                continue
            if target not in owner_tables:
                add_finding(
                    findings,
                    "FOREIGN_LOCAL_SELECTOR",
                    f"{op_id}:{selector.get('source')}",
                    "A public operation locally selects a table outside its authoritative stream.",
                    {
                        "authoritativeStreamKey": owner,
                        "selectorType": selector.get("selectorType"),
                        "targetTable": target,
                        "targetOwner": owners.get(target, {}).get("logicalOwner", "UNRESOLVED"),
                    },
                )

        references: dict[str, set[str]] = defaultdict(set)
        for surface_name, op in (("exact", exact_op), ("causal", causal_op), ("semantic", semantic_op)):
            for table, locations in op_table_locations(op, table_names).items():
                for location in locations:
                    references[table].add(f"{surface_name}:{location}")
        foreign = {
            table: sorted(locations)
            for table, locations in sorted(references.items())
            if table not in owner_tables
        }
        if foreign:
            add_finding(
                findings,
                "OPERATION_FOREIGN_TABLE_ACCESS",
                op_id,
                "DML/read/field-lineage references cross the authoritative owner boundary without an owner port.",
                {"authoritativeStreamKey": owner, "foreignTableLocations": foreign},
            )

        dml_tables = {step.get("table") for step in causal_op.get("orderedDml", []) if step.get("table")}
        unresolved_dml = sorted(table for table in dml_tables if table not in owner_tables)
        if unresolved_dml:
            add_finding(
                findings,
                "OPERATION_DML_OUTSIDE_OWNER_STREAM",
                op_id,
                "Ordered DML writes tables not owned by authoritativeStreamKey.",
                {"authoritativeStreamKey": owner, "tables": unresolved_dml},
            )

        if binding["kind"] == "COMMAND":
            port_operation = binding.get("ownerPortOperation")
            port_contract = port_contracts.get(port_operation) or {}
            receipt_outbox = port_contract.get("receiptAndOutbox") or {}
            receipt_table = receipt_outbox.get("receiptTable")
            outbox_table = receipt_outbox.get("outboxTable")
            if port_operation == "protected.submitResponse":
                authority_dml = [
                    row for row in port_contract.get("orderedDml", []) if isinstance(row, dict)
                ]
                expected_sequence = [
                    (row.get("step"), row.get("table")) for row in authority_dml
                ]
                actual_sequence = [
                    (row.get("step"), row.get("table"))
                    for row in causal_op.get("orderedDml", []) if isinstance(row, dict)
                ]
                outbox_writes = [
                    row for row in causal_op.get("orderedDml", [])
                    if "outbox" in str(row.get("table", "")).lower()
                    or "outbox" in str(row.get("role", "")).lower()
                ]
                submit_closed = (
                    receipt_table == "sys_hris_listening_protected_receipts"
                    and outbox_table is None
                    and receipt_outbox.get("deliveryClass")
                    == "OWNER_LOCAL_PRIVATE_BROKER_FORBIDDEN"
                    and receipt_outbox.get("atomicity")
                    == "OWNER_LOCAL_DOMAIN_AND_PRIVATE_RECEIPT_ONE_TRANSACTION;BROKER_OUTBOX_FORBIDDEN"
                    and expected_sequence == [
                        (1, "sys_hris_listening_protected_receipts"),
                        (2, "sys_hris_listening_admission_versions"),
                        (3, "sys_hris_listening_token_consumptions"),
                        (4, "sys_hris_listening_responses"),
                        (5, "sys_hris_listening_answer_values"),
                        (6, "sys_hris_listening_token_consumptions"),
                        (7, "sys_hris_listening_protected_receipts"),
                    ]
                    and actual_sequence == expected_sequence
                    and not outbox_writes
                    and causal_op.get("events") == []
                    and binding.get("publicEventIds") == []
                )
                if not submit_closed:
                    add_finding(
                        findings,
                        "OWNER_LOCAL_CONTROL_DML_MISSING",
                        op_id,
                        "protected submit must reproduce the exact authority-owned seven-step private receipt transaction and forbid broker/public outbox delivery",
                        {
                            "ownerPortOperation": port_operation,
                            "receiptAndOutbox": receipt_outbox,
                            "expectedSequence": expected_sequence,
                            "actualSequence": actual_sequence,
                            "outboxWrites": outbox_writes,
                            "events": causal_op.get("events"),
                            "publicEventIds": binding.get("publicEventIds"),
                        },
                    )
            else:
                required_controls = [
                    table for table in (receipt_table, outbox_table) if isinstance(table, str)
                ]
                missing_controls = [table for table in required_controls if table not in dml_tables]
                authority_closed = bool(port_contract) and isinstance(receipt_table, str)
                if not authority_closed or missing_controls:
                    add_finding(
                        findings,
                        "OWNER_LOCAL_CONTROL_DML_MISSING",
                        op_id,
                        "command does not reproduce the exact owner-port receipt/outbox disposition",
                        {
                            "ownerPortOperation": port_operation,
                            "receiptAndOutbox": receipt_outbox,
                            "actualDmlTables": sorted(dml_tables),
                            "missing": missing_controls,
                            "authorityContractResolved": bool(port_contract),
                        },
                    )

        aggregate = causal_op.get("aggregateRoot") or {}
        aggregate_table = aggregate.get("table")
        if aggregate_table and aggregate_table not in owner_tables:
            add_finding(
                findings,
                "AGGREGATE_ROOT_OUTSIDE_OWNER_STREAM",
                op_id,
                "Aggregate root is not owned by authoritativeStreamKey.",
                {"aggregateRoot": aggregate_table, "authoritativeStreamKey": owner},
            )

    # Candidate-only operations do not gain authority from an embedded self-assertion.
    for op_id in sorted(candidate_listening_sets["causal"] - expected_set):
        op = causal_ops[op_id]
        embedded_owner = (op.get("listeningAuthority") or {}).get("authoritativeStreamKey")
        owner_tables = {name for name, row in owners.items() if row["logicalOwner"] == embedded_owner}
        foreign = {
            table: locations
            for table, locations in op_table_locations(op, table_names).items()
            if table not in owner_tables
        }
        if foreign:
            add_finding(
                findings,
                "UNAUTHORIZED_OPERATION_FOREIGN_ACCESS",
                op_id,
                "A candidate-only public operation crosses owner boundaries and is absent from the sealed authority.",
                {"selfAssertedOwner": embedded_owner, "foreignTableLocations": foreign},
            )


def validate_query_projection_closure(
    exact: dict[str, Any], causal: dict[str, Any], owners: dict[str, dict[str, Any]], findings: list[dict[str, Any]]
) -> None:
    causal_ops = {op["operationId"]: op for op in causal["operations"]}
    cohorts = causal_ops.get("modern.listening.cohorts.query")
    if cohorts:
        read_tables = (cohorts.get("readPlan") or {}).get("tables", [])
        projection_columns = {
            column
            for table_name in read_tables
            if table_name in owners
            for column in full_column_map(
                next(table for table in exact["tableSpecifications"] if table["tableName"] == table_name),
                exact["commonTableContract"],
            )
        }
        survey_filter = next(
            (selector for selector in cohorts.get("selectors", []) if selector.get("source") == "pathParameters.surveyId"), None
        )
        if survey_filter and not ({"survey_public_id", "survey_id", "parent_public_id"} & projection_columns):
            add_finding(
                findings,
                "QUERY_FILTER_NOT_CLOSED_ON_OWNER_PROJECTION",
                "modern.listening.cohorts.query:pathParameters.surveyId",
                "Insights readPlan cannot apply its required survey filter from any owner-local projection column.",
                {"readTables": read_tables, "availableColumns": sorted(projection_columns)},
            )


def validate_dml_sources(exact: dict[str, Any], causal: dict[str, Any], findings: list[dict[str, Any]]) -> None:
    tables = {table["tableName"]: table for table in exact["tableSpecifications"]}
    columns = {name: full_column_map(table, exact["commonTableContract"]) for name, table in tables.items()}
    aliases = {"LOCKED_ADMISSION": "sys_hris_listening_admission_versions"}
    for op in causal["operations"]:
        if not op["operationId"].startswith("modern.listening."):
            continue
        missing: list[dict[str, str]] = []
        for step in op.get("orderedDml", []):
            for target_column, source in (step.get("assignments") or {}).items():
                if not isinstance(source, str):
                    continue
                for alias, path in re.findall(r"\b([A-Z][A-Z0-9_]*)\.([A-Za-z][A-Za-z0-9_]*)", source):
                    table_name = aliases.get(alias)
                    if not table_name:
                        continue
                    column = snake_case(path)
                    if column not in columns[table_name]:
                        missing.append(
                            {
                                "dmlTable": step.get("table", ""),
                                "targetColumn": target_column,
                                "sourceExpression": source,
                                "resolvedSourceTable": table_name,
                                "missingSourceColumn": column,
                            }
                        )
        if missing:
            add_finding(
                findings,
                "DML_SOURCE_COLUMN_NOT_DECLARED",
                op["operationId"],
                "Ordered DML reads fields from a locked owner row that the exact schema does not declare.",
                missing,
            )


def validate_internal_messages(
    exact: dict[str, Any], authority: dict[str, Any], owners: dict[str, dict[str, Any]], findings: list[dict[str, Any]]
) -> None:
    _, messages, _ = expected_authority_maps(authority)
    handlers_by_message: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for handler in exact.get("internalConsumerHandlers", []):
        if handler.get("messageName"):
            handlers_by_message[handler["messageName"]].append(handler)

    for message_name, message in sorted(messages.items()):
        handlers = handlers_by_message.get(message_name, [])
        if len(handlers) != 1:
            add_finding(
                findings,
                "INTERNAL_PORT_HANDLER_CARDINALITY",
                message_name,
                "Every sealed internal port message must have exactly one owner-local consumer handler.",
                {"handlerIds": [handler.get("handlerId") for handler in handlers]},
            )
            continue
        handler = handlers[0]
        if handler.get("streamKey") != message["to"]:
            add_finding(
                findings,
                "INTERNAL_PORT_TARGET_STREAM_DRIFT",
                handler["handlerId"],
                "Handler streamKey differs from the sealed message target stream.",
                {"expected": message["to"], "actual": handler.get("streamKey")},
            )
        if handler.get("sourceStreamKey") != message["from"]:
            add_finding(
                findings,
                "INTERNAL_PORT_SOURCE_STREAM_UNBOUND",
                handler["handlerId"],
                "Handler does not pin the exact sealed source stream, so signature authority is ambiguous.",
                {"expected": message["from"], "actual": handler.get("sourceStreamKey")},
            )
        actual_fields = set((handler.get("requestContract") or {}).keys()) - {"additionalProperties"}
        expected_fields = set(message["fieldAllowlist"])
        missing = sorted(expected_fields - actual_fields)
        if missing:
            add_finding(
                findings,
                "INTERNAL_PORT_PAYLOAD_FIELDS_MISSING",
                handler["handlerId"],
                "Handler requestContract omits required public identity/versioned port fields.",
                {"messageName": message_name, "missing": missing, "actual": sorted(actual_fields)},
            )
        local_tables = set(handler.get("domainWriteTables", []))
        local_tables.add(handler.get("inboxLedgerTable"))
        local_tables.add(handler.get("outboxTable"))
        local_tables.update(write.get("table") for write in handler.get("writes", []))
        foreign = sorted(
            table
            for table in local_tables
            if table and (table not in owners or owners[table]["logicalOwner"] != message["to"])
        )
        if foreign:
            add_finding(
                findings,
                "INTERNAL_HANDLER_FOREIGN_DML",
                handler["handlerId"],
                "Internal port handler uses a table outside its sealed target stream.",
                {"targetStream": message["to"], "foreignTables": foreign},
            )


def validate_events(
    causal: dict[str, Any], event: dict[str, Any], authority: dict[str, Any], owners: dict[str, dict[str, Any]], findings: list[dict[str, Any]]
) -> None:
    _, _, expected_events = expected_authority_maps(authority)
    schemas = {
        row["eventName"]: row
        for row in event.get("eventPayloadSchemas", [])
        if row.get("eventName", "").startswith("EmployeeListening")
    }
    if set(schemas) != set(expected_events):
        add_finding(
            findings,
            "PUBLIC_EVENT_CLOSED_SET_DRIFT",
            "EmployeeListening*",
            "Listening public events must equal the sealed exact-six authority set.",
            {"missing": sorted(set(expected_events) - set(schemas)), "extra": sorted(set(schemas) - set(expected_events))},
        )

    forbidden = [value.lower() for value in authority["eventOwnership"]["forbiddenPublicFieldPatterns"]]
    for event_name, schema in sorted(schemas.items()):
        if event_name not in expected_events:
            continue
        fields = [field.get("name", "") for field in schema.get("fields", [])]
        forbidden_fields = sorted(
            name for name in fields if any(pattern in name.lower() for pattern in forbidden)
        )
        if forbidden_fields:
            add_finding(
                findings,
                "FORBIDDEN_PUBLIC_EVENT_FIELD",
                event_name,
                "Public event contains a field forbidden by the sealed privacy boundary.",
                {"fields": forbidden_fields},
            )
        owner = expected_events[event_name]["streamKey"]
        foreign_sources: dict[str, list[str]] = defaultdict(list)
        for field in schema.get("fields", []):
            for table in table_tokens(field.get("source", ""), set(owners)):
                if table not in owners or owners[table]["logicalOwner"] != owner:
                    foreign_sources[table].append(field.get("name", ""))
        if foreign_sources:
            add_finding(
                findings,
                "PUBLIC_EVENT_FOREIGN_SOURCE",
                event_name,
                "Event fields are sourced from a table outside the event's authoritative stream.",
                {"authoritativeStreamKey": owner, "foreignSources": {k: sorted(v) for k, v in sorted(foreign_sources.items())}},
            )

    ownership_rows = {
        row["eventName"]: row for row in (causal.get("publicEventOwnership") or {}).get("events", [])
        if row.get("eventName", "").startswith("EmployeeListening")
    }
    if set(ownership_rows) != set(expected_events):
        add_finding(
            findings,
            "PUBLIC_EVENT_PRODUCER_SET_DRIFT",
            "publicEventOwnership",
            "Candidate event-producer ownership includes events outside the sealed exact-six set.",
            {"missing": sorted(set(expected_events) - set(ownership_rows)), "extra": sorted(set(ownership_rows) - set(expected_events))},
        )


def validate_authority_pins(
    exact: dict[str, Any],
    manifest: dict[str, Any],
    authority: dict[str, Any],
    authority_path: Path,
    findings: list[dict[str, Any]],
) -> None:
    serialized = json.dumps({"exact": exact, "manifest": manifest}, ensure_ascii=False, sort_keys=True)
    authority_hash = file_sha256(authority_path)
    prefix_hash = file_sha256(PREFIX_PATH)
    if authority_hash not in serialized or prefix_hash not in serialized:
        add_finding(
            findings,
            "OWNER_BOUNDARY_INPUTS_NOT_PINNED",
            "candidate canonical set",
            "Candidate does not pin both the sealed stream authority and physical owner-prefix register bytes.",
            {
                "requiredAuthoritySha256": authority_hash,
                "authorityPinned": authority_hash in serialized,
                "requiredPrefixRegisterSha256": prefix_hash,
                "prefixRegisterPinned": prefix_hash in serialized,
            },
        )
    table_specs = exact["tableSpecifications"]
    missing_stream = sorted(table["tableName"] for table in table_specs if not table.get("streamKey"))
    missing_schema = sorted(table["tableName"] for table in table_specs if not table.get("physicalSchema"))
    has_external_pins = authority_hash in serialized and prefix_hash in serialized
    if (missing_stream or missing_schema) and not has_external_pins:
        add_finding(
            findings,
            "TABLE_OWNER_SCHEMA_BINDING_NOT_SELF_CONTAINED",
            "132-table exact schema",
            "Exact table rows neither self-contain nor immutably pin complete logical-owner/physical-schema bindings.",
            {
                "missingStreamKeyCount": len(missing_stream),
                "missingPhysicalSchemaCount": len(missing_schema),
                "missingStreamKeyTables": missing_stream,
            },
        )

    candidate_counts = (manifest.get("listeningStaticDesign") or {}).get("exactCounts", {})
    authority_counts = authority.get("exactCounts", {})
    shared_count_keys = set(candidate_counts) & set(authority_counts)
    drift = {
        key: {"candidateStatic": candidate_counts.get(key), "sealedAuthority": authority_counts.get(key)}
        for key in sorted(shared_count_keys)
        if candidate_counts.get(key) != authority_counts.get(key)
    }
    if drift:
        add_finding(
            findings,
            "LISTENING_STATIC_AUTHORITY_COUNT_DRIFT",
            "modern-capability-closed-set-manifest.v3.json:listeningStaticDesign",
            "Candidate's self-pinned static design disagrees with the independently sealed derived authority.",
            drift,
        )


def validate_revalidation_authority(
    authority: dict[str, Any],
    authority_path: Path,
    profile: dict[str, Any],
    findings: list[dict[str, Any]],
) -> None:
    """Validate the explicitly supplied authority against the resolved policy profile."""
    contract_id = authority.get("contractId", "")
    expected_contract = profile["authorityContractId"]
    if contract_id != expected_contract:
        add_finding(
            findings,
            "SUCCESSOR_AUTHORITY_V2_REQUIRED",
            str(authority_path),
            "The explicitly supplied authority contract does not match the resolved policy profile.",
            {"expectedContractId": expected_contract, "actualContractId": contract_id},
        )
    payload = {key: value for key, value in authority.items() if key != "sealedPayloadSha256"}
    computed_seal = sha256_bytes(canonical_json(payload))
    if authority.get("sealedPayloadSha256") != computed_seal:
        add_finding(
            findings,
            "SUCCESSOR_AUTHORITY_SEAL_INVALID",
            str(authority_path),
            "v2 authority self-seal is absent or invalid.",
            {"declared": authority.get("sealedPayloadSha256"), "computed": computed_seal},
        )
    if profile["profileId"] == SUCCESSOR_V5_PROFILE["profileId"]:
        predecessor_sha = file_sha256(AUTHORITY_PATH)
        predecessor = load_json(AUTHORITY_PATH)
        lineage = authority.get("successorLineage") or {}
        exact_edge = {
            "predecessorContractId": "dwp.hris.sys.listening.stream-authority-successor.v1",
            "predecessorPath": "coding-readiness/sys-listening-stream-authority-successor.v1.json",
            "predecessorFileSha256": EXPECTED_V1_AUTHORITY_SHA256,
            "predecessorDisposition": "IMMUTABLE_FAILED_EVIDENCE_NOT_ACTIVE_AUTHORITY",
        }
        edge_closed = all(lineage.get(key) == value for key, value in exact_edge.items())
        predecessor_closed = (
            predecessor_sha == EXPECTED_V1_AUTHORITY_SHA256
            and predecessor.get("contractId") == exact_edge["predecessorContractId"]
            and predecessor.get("sealedPayloadSha256") == EXPECTED_V1_AUTHORITY_SEAL
            and sealed_payload_sha256(predecessor) == EXPECTED_V1_AUTHORITY_SEAL
            and authority_path.resolve() != AUTHORITY_PATH.resolve()
            and file_sha256(authority_path) != predecessor_sha
        )
        if not edge_closed or not predecessor_closed:
            add_finding(
                findings,
                "SUCCESSOR_AUTHORITY_V1_PIN_MISSING",
                str(authority_path),
                "sealed v2 must contain the exact forward successorLineage edge to the separately read and sealed immutable v1 authority",
                {
                    "expectedEdge": exact_edge, "actualEdge": lineage,
                    "predecessorFileSha256": predecessor_sha,
                    "predecessorSealedPayloadSha256": predecessor.get("sealedPayloadSha256"),
                    "edgeClosed": edge_closed, "predecessorClosed": predecessor_closed,
                },
            )
    actual_ops = {row.get("operationId") for row in authority.get("publicOperationBindings", [])}
    actual_events = {
        row.get("eventName") for row in (authority.get("eventOwnership") or {}).get("canonicalPublicEvents", [])
    }
    actual = {
        "publicOperations": len(actual_ops),
        "canonicalPublicEvents": len(actual_events),
        "ownerPortOperations": len(authority.get("ownerPortOperations", [])),
        "streams": len(authority.get("authorityStreams", [])),
        "plannedTables": len(authority.get("tableOwnership", [])),
        "internalPortMessages": len((authority.get("eventOwnership") or {}).get("internalPortMessages", [])),
    }
    expected = profile["authorityCounts"]
    set_drift = profile["profileId"] == SUCCESSOR_V5_PROFILE["profileId"] and (
        actual_ops != EXPECTED_V2_PUBLIC_OPERATIONS or actual_events != EXPECTED_V2_PUBLIC_EVENTS
    )
    if actual != expected or set_drift:
        add_finding(
            findings,
            "SUCCESSOR_AUTHORITY_PRODUCT_CLOSURE_DRIFT",
            str(authority_path),
            "Authority does not close the exact operation/event/port/stream/table/message profile.",
            {
                "expectedCounts": expected,
                "actualCounts": actual,
                "missingOperations": sorted(EXPECTED_V2_PUBLIC_OPERATIONS - actual_ops) if set_drift else [],
                "extraOperations": sorted(actual_ops - EXPECTED_V2_PUBLIC_OPERATIONS) if set_drift else [],
                "missingEvents": sorted(EXPECTED_V2_PUBLIC_EVENTS - actual_events) if set_drift else [],
                "extraEvents": sorted(actual_events - EXPECTED_V2_PUBLIC_EVENTS) if set_drift else [],
            },
        )
def validate_scope(
    exact: dict[str, Any],
    manifest: dict[str, Any],
    frozen_policy: dict[str, Any],
    profile: dict[str, Any],
    findings: list[dict[str, Any]],
) -> dict[str, Any]:
    exact_ids = sorted(table["tableName"] for table in exact["tableSpecifications"])
    manifest_ids = sorted(manifest.get("tableIds", []))
    table_set_sha = sha256_bytes(canonical_json(exact_ids))
    expected_table_count = profile["tableCount"]
    if len(exact_ids) != expected_table_count or len(set(exact_ids)) != expected_table_count:
        add_finding(
            findings,
            "TABLE_SET_NOT_EXACT_132",
            "modern-capability-exact-schema-contracts.v1.json",
            f"Candidate must contain exactly {expected_table_count} distinct table specifications.",
            {"expected": expected_table_count, "rows": len(exact_ids), "distinct": len(set(exact_ids))},
        )
    if exact_ids != manifest_ids:
        add_finding(
            findings,
            "MANIFEST_TABLE_SET_DRIFT",
            "modern-capability-closed-set-manifest.v3.json",
            "Manifest tableIds differ from exact schema tableSpecifications.",
            {"missingInManifest": sorted(set(exact_ids) - set(manifest_ids)), "extraInManifest": sorted(set(manifest_ids) - set(exact_ids))},
        )
    scope = manifest.get("tableScopeChange", {})
    baseline = frozen_policy.get("frozenBaseline", {})
    expected_added = sorted(row["tableId"] for row in frozen_policy.get("successorScope", {}).get("addedRows", []))
    observed = {
        "previousTableSpecifications": scope.get("previousTableSpecifications"),
        "activeTableSpecifications": scope.get("activeTableSpecifications"),
        "deltaCount": scope.get("deltaCount"),
        "removedTableIds": scope.get("removedTableIds"),
        "addedTableIds": sorted(scope.get("addedTableIds", [])),
        "previousTableSetSha256": scope.get("previousTableSetSha256"),
    }
    if profile["profileId"] == SUCCESSOR_V5_PROFILE["profileId"]:
        observed["netDelta"] = scope.get("netDelta")
        observed["removalDisposition"] = scope.get("removalDisposition")
    expected = {
        "previousTableSpecifications": 115,
        "activeTableSpecifications": expected_table_count,
        "deltaCount": EXPECTED_DELTA_COUNT,
        "removedTableIds": sorted(profile["removedTableIds"]),
        "addedTableIds": expected_added,
        "previousTableSetSha256": EXPECTED_FROZEN_115_TABLE_SET_SHA256,
    }
    if profile["profileId"] == SUCCESSOR_V5_PROFILE["profileId"]:
        expected["netDelta"] = profile["netDelta"]
        expected["removalDisposition"] = frozen_policy.get("successorScope", {}).get("removalDisposition")
    if observed != expected:
        add_finding(
            findings,
            "TABLE_SCOPE_DELTA_DRIFT",
            "manifest.tableScopeChange",
            "Candidate does not reproduce the resolved policy's exact frozen115 + additions - reviewed removals scope.",
            {"expected": expected, "actual": observed},
        )
    policy_pin = scope.get("acceptancePolicy")
    if profile["profileId"] == SUCCESSOR_V5_PROFILE["profileId"]:
        expected_pin = expected_v5_manifest_policy_pin()
        if policy_pin != expected_pin:
            add_finding(
                findings,
                "SCOPE_POLICY_PIN_DRIFT",
                "manifest.tableScopeChange.acceptancePolicy",
                "Successor manifest does not pin the exact sealed v5 policy and its immutable v4 predecessor/reduction evidence.",
                {"expected": expected_pin, "actual": policy_pin},
            )
    elif policy_pin:
        add_finding(
            findings,
            "SCOPE_POLICY_PIN_DRIFT",
            "manifest.tableScopeChange.acceptancePolicy",
            "Byte-exact historical q0 evidence must retain its original v3-era manifest without a retroactive policy pin.",
            {"expected": None, "actual": policy_pin},
        )
    if baseline.get("tableSetSha256") != EXPECTED_FROZEN_115_TABLE_SET_SHA256:
        add_finding(
            findings,
            "FROZEN_BASELINE_HASH_DRIFT",
            str(profile["policyPath"]),
            "Frozen policy baseline table-set hash differs from the independently fixed value.",
            {"expected": EXPECTED_FROZEN_115_TABLE_SET_SHA256, "actual": baseline.get("tableSetSha256")},
        )
    return {
        "tableCount": len(exact_ids),
        "distinctTableCount": len(set(exact_ids)),
        "activeTableSetSha256": table_set_sha,
        "manifestExactMatch": exact_ids == manifest_ids,
        "previousTableSetSha256": scope.get("previousTableSetSha256"),
        "expectedPreviousTableSetSha256": EXPECTED_FROZEN_115_TABLE_SET_SHA256,
        "addedCount": len(scope.get("addedTableIds", [])),
        "removedCount": len(scope.get("removedTableIds", [])),
        "resolvedProfile": profile["profileId"],
        "expectedTableCount": expected_table_count,
        "expectedNetDelta": profile["netDelta"],
    }


def validate_policy_chain(
    policy: dict[str, Any], profile: dict[str, Any], findings: list[dict[str, Any]]
) -> None:
    actual_sha = file_sha256(profile["policyPath"])
    declared_seal = policy.get("sealedPayloadSha256")
    computed_seal = sealed_payload_sha256(policy)
    if (
        actual_sha != profile["policySha256"]
        or declared_seal != profile["policySeal"]
        or computed_seal != profile["policySeal"]
    ):
        add_finding(
            findings,
            "SCOPE_POLICY_CHAIN_DRIFT",
            str(profile["policyPath"]),
            "Resolved policy bytes or payload seal differ from the immutable reviewed authority.",
            {
                "expectedSha256": profile["policySha256"],
                "actualSha256": actual_sha,
                "expectedSeal": profile["policySeal"],
                "declaredSeal": declared_seal,
                "computedSeal": computed_seal,
            },
        )

    v3 = load_json(LEGACY_POLICY_PATH)
    v2 = load_json(V2_POLICY_PATH)
    v3_descriptor = {
        "path": "coding-readiness/modern-independent-successor/global-hcm-table-expansion-acceptance-policy.v3.json",
        "sha256": EXPECTED_LEGACY_POLICY_SHA256,
        "sealedPayloadSha256": EXPECTED_LEGACY_POLICY_SEAL,
        "disposition": "IMMUTABLE_132_TABLE_ACCEPTANCE_PREDECESSOR_SUPERSEDED_NOT_REWRITTEN",
    }
    v2_descriptor = {
        "path": "coding-readiness/modern-independent-successor/global-hcm-table-expansion-acceptance-policy.v2.json",
        "sha256": EXPECTED_V2_POLICY_SHA256,
        "sealedPayloadSha256": EXPECTED_V2_POLICY_SEAL,
        "disposition": "IMMUTABLE_FAILED_REVIEW_INPUT_SUPERSEDED_NOT_REWRITTEN",
    }
    chain_errors: list[dict[str, Any]] = []
    if file_sha256(LEGACY_POLICY_PATH) != EXPECTED_LEGACY_POLICY_SHA256:
        chain_errors.append({"node": "v3", "reason": "FILE_SHA256"})
    if v3.get("sealedPayloadSha256") != EXPECTED_LEGACY_POLICY_SEAL or sealed_payload_sha256(v3) != EXPECTED_LEGACY_POLICY_SEAL:
        chain_errors.append({"node": "v3", "reason": "PAYLOAD_SEAL"})
    if v3.get("predecessorPolicy") != v2_descriptor:
        chain_errors.append({"node": "v3", "reason": "V2_PREDECESSOR_DESCRIPTOR", "actual": v3.get("predecessorPolicy")})
    if file_sha256(V2_POLICY_PATH) != EXPECTED_V2_POLICY_SHA256:
        chain_errors.append({"node": "v2", "reason": "FILE_SHA256"})
    if v2.get("sealedPayloadSha256") != EXPECTED_V2_POLICY_SEAL or sealed_payload_sha256(v2) != EXPECTED_V2_POLICY_SEAL:
        chain_errors.append({"node": "v2", "reason": "PAYLOAD_SEAL"})
    if profile["profileId"] == SUCCESSOR_V5_PROFILE["profileId"]:
        v4_descriptor = {
            "path": "coding-readiness/modern-independent-successor/global-hcm-table-expansion-acceptance-policy.v4.json",
            "sha256": EXPECTED_V4_POLICY_SHA256,
            "sealedPayloadSha256": EXPECTED_V4_POLICY_SEAL,
            "disposition": "IMMUTABLE_131_TABLE_ACCEPTANCE_PREDECESSOR_SUPERSEDED_NOT_REWRITTEN",
        }
        v4 = load_json(V4_POLICY_PATH)
        if file_sha256(V4_POLICY_PATH) != EXPECTED_V4_POLICY_SHA256:
            chain_errors.append({"node": "v4", "reason": "FILE_SHA256"})
        if v4.get("sealedPayloadSha256") != EXPECTED_V4_POLICY_SEAL or sealed_payload_sha256(v4) != EXPECTED_V4_POLICY_SEAL:
            chain_errors.append({"node": "v4", "reason": "PAYLOAD_SEAL"})
        if v4.get("predecessorPolicy") != v3_descriptor:
            chain_errors.append({"node": "v4", "reason": "V3_PREDECESSOR_DESCRIPTOR", "actual": v4.get("predecessorPolicy")})
        if policy.get("predecessorPolicy") != v4_descriptor:
            chain_errors.append({"node": "v5", "reason": "V4_PREDECESSOR_DESCRIPTOR", "actual": policy.get("predecessorPolicy")})
    if chain_errors:
        add_finding(
            findings,
            "SCOPE_POLICY_CHAIN_DRIFT",
            "v5->v4->v3->v2" if profile["profileId"] == SUCCESSOR_V5_PROFILE["profileId"] else "v3->v2",
            "Immutable table-scope policy predecessor chain does not reproduce exactly.",
            chain_errors,
        )

    successor_scope = policy.get("successorScope") or {}
    policy_added = [row.get("tableId") for row in successor_scope.get("addedRows", []) if isinstance(row, dict)]
    expected_scope = {
        "tableCount": profile["tableCount"],
        "deltaCount": EXPECTED_DELTA_COUNT,
        "removedTableIds": sorted(profile["removedTableIds"]),
    }
    actual_scope = {
        "tableCount": successor_scope.get("tableCount"),
        "deltaCount": successor_scope.get("deltaCount"),
        "removedTableIds": sorted(successor_scope.get("removedTableIds", [])),
    }
    if profile["profileId"] == SUCCESSOR_V5_PROFILE["profileId"]:
        expected_scope["netDelta"] = profile["netDelta"]
        actual_scope["netDelta"] = successor_scope.get("netDelta")
    if actual_scope != expected_scope or len(policy_added) != EXPECTED_DELTA_COUNT or len(set(policy_added)) != EXPECTED_DELTA_COUNT:
        add_finding(
            findings,
            "SCOPE_POLICY_CHAIN_DRIFT",
            f"{profile['profileId']}.successorScope",
            "Policy scope cardinality/addition/removal set is not exact.",
            {
                "expected": expected_scope,
                "actual": actual_scope,
                "addedRows": len(policy_added),
                "distinctAddedRows": len(set(policy_added)),
            },
        )


def validate_removed_table_references(
    documents: dict[str, Any], profile: dict[str, Any], findings: list[dict[str, Any]]
) -> None:
    removed = set(profile["removedTableIds"])
    if not removed:
        return
    residuals: dict[str, list[str]] = defaultdict(list)
    candidate_roles = (EXACT_FILE, CAUSAL_FILE, EVENT_FILE, IDENTITY_FILE, SEMANTIC_FILE, MANIFEST_FILE, "authority")
    for role in candidate_roles:
        inspected = copy.deepcopy(documents[role])
        if role == MANIFEST_FILE:
            scope = inspected.get("tableScopeChange") or {}
            scope.pop("removedTableIds", None)
            scope.pop("removalDisposition", None)
        for path, value in iter_strings(inspected):
            for table_name in removed:
                if re.search(rf"(?<![A-Za-z0-9_]){re.escape(table_name)}(?![A-Za-z0-9_])", value):
                    residuals[table_name].append(f"{role}:{path}")
    if residuals:
        add_finding(
            findings,
            "REMOVED_TABLE_DANGLING_REFERENCE",
            "candidate active contracts",
            "Reviewed orphan table remains referenced outside the manifest's explicit removal record.",
            {key: sorted(set(value)) for key, value in sorted(residuals.items())},
        )

    active_tables = {row.get("tableName") for row in documents[EXACT_FILE].get("tableSpecifications", [])}
    dangling: list[dict[str, Any]] = []
    for table in documents[EXACT_FILE].get("tableSpecifications", []):
        for fk in table.get("foreignKeys", []):
            target = fk.get("target")
            if target and target not in active_tables and fk.get("mode") == "LOCAL_COMPOSITE_FK":
                dangling.append({
                    "sourceTable": table.get("tableName"),
                    "constraintId": fk.get("constraintId"),
                    "target": target,
                })
    if dangling:
        add_finding(
            findings,
            "DANGLING_LOCAL_FK_TARGET",
            "exactSchema.foreignKeys",
            "Owner-local foreign-key targets must resolve in the exact active table set.",
            dangling,
        )


def audit_documents(documents: dict[str, Any], input_hashes: dict[str, str], include_self_tests: bool = False) -> dict[str, Any]:
    exact = documents[EXACT_FILE]
    causal = documents[CAUSAL_FILE]
    event = documents[EVENT_FILE]
    identity = documents[IDENTITY_FILE]
    semantic = documents[SEMANTIC_FILE]
    manifest = documents[MANIFEST_FILE]
    authority = documents["authority"]
    frozen_policy = documents["frozenPolicy"]
    profile = documents["reviewProfile"]
    prefix_rows = documents["prefixRows"]
    findings: list[dict[str, Any]] = []

    if documents.get("profileResolutionErrors"):
        add_finding(
            findings,
            "SCOPE_POLICY_MODE_UNRESOLVED",
            "candidate policy/authority profile",
            "Candidate inputs do not resolve to one unambiguous reviewed policy and authority profile.",
            documents["profileResolutionErrors"],
        )
    scope_evidence = validate_scope(exact, manifest, frozen_policy, profile, findings)
    validate_policy_chain(frozen_policy, profile, findings)
    validate_removed_table_references(documents, profile, findings)
    owners, owner_inventory = build_owner_inventory(exact, authority, prefix_rows, findings)
    validate_revalidation_authority(authority, documents["authorityPath"], profile, findings)
    validate_authority_pins(exact, manifest, authority, documents["authorityPath"], findings)
    validate_table_constraints(exact, owners, findings)
    validate_reference_boundaries(exact, identity, owners, findings)
    validate_operations(exact, causal, semantic, authority, owners, findings)
    validate_query_projection_closure(exact, causal, owners, findings)
    validate_dml_sources(exact, causal, findings)
    validate_internal_messages(exact, authority, owners, findings)
    validate_events(causal, event, authority, owners, findings)

    findings.sort(key=lambda row: (row["severity"], row["ruleId"], row["subject"], canonical_json(row["evidence"])))
    severity_counts = Counter(row["severity"] for row in findings)
    rule_counts = Counter(row["ruleId"] for row in findings)
    owner_counts: dict[tuple[str, str, str], int] = Counter(
        (row["logicalOwner"], row["databaseSchema"], row["ownerService"]) for row in owner_inventory
    )
    report: dict[str, Any] = {
        "reportId": (
            "dwp.hris.modern-132.owner-stream-boundary-independent-review.v1"
            if profile["profileId"] == LEGACY_V3_PROFILE["profileId"]
            else "dwp.hris.modern-131.owner-stream-boundary-v5-independent-review.v1"
        ),
        "reviewerBoundary": "INDEPENDENT_STATIC_FAIL_CLOSED_NO_AUTHOR_IMPORT_NO_CANONICAL_MUTATION",
        "candidate": str(documents["candidatePath"]),
        "auditMode": profile["profileId"],
        "profileResolution": {
            "profileId": profile["profileId"],
            "policyPath": str(profile["policyPath"]),
            "policySha256": profile["policySha256"],
            "policySeal": profile["policySeal"],
            "authorityContractId": profile["authorityContractId"],
            "errors": documents.get("profileResolutionErrors", []),
        },
        "validatorSha256": file_sha256(SCRIPT),
        "status": "PASS" if not findings else "FAIL",
        "decision": "ELIGIBLE_FOR_NEXT_REVIEW" if not findings else "REJECTED_FAIL_CLOSED",
        "scopeEvidence": scope_evidence,
        "inputSha256": input_hashes,
        "authorityClosureSnapshot": {
            "publicOperationIds": sorted(row["operationId"] for row in authority["publicOperationBindings"]),
            "publicEventIds": sorted(row["eventName"] for row in authority["eventOwnership"]["canonicalPublicEvents"]),
            "internalPortMessageIds": sorted(row["messageName"] for row in authority["eventOwnership"]["internalPortMessages"]),
            "tableOwnershipCount": len(authority["tableOwnership"]),
        },
        "ownerInventorySummary": [
            {
                "logicalOwner": key[0],
                "databaseSchema": key[1],
                "ownerService": key[2],
                "tableCount": count,
            }
            for key, count in sorted(owner_counts.items())
        ],
        "ownerInventory": owner_inventory,
        "residualSummary": {
            "findingCount": len(findings),
            "bySeverity": dict(sorted(severity_counts.items())),
            "byRule": dict(sorted(rule_counts.items())),
        },
        "findings": findings,
        "requiredRevalidation": [
            "Author must publish a distinct immutable candidate; this reviewer does not patch q0 or live canonical artifacts.",
            f"Candidate must pin sealed stream-authority and physical-owner-prefix bytes and self-contain all {profile['tableCount']} owner/schema bindings.",
            "All authoritative public operations must use owner-local DML/read/selector/field-lineage only; foreign access must be a sealed versioned owner port/event.",
            "All six internal messages must bind exact source/target streams and their complete field allowlists.",
            "Rerun this validator and hostile self-tests against the new candidate; require zero P0/P1 and stable input hashes.",
        ],
    }
    if include_self_tests:
        report["selfTests"] = run_self_tests(documents, input_hashes)
    report["sealedPayloadSha256"] = sha256_bytes(canonical_json(report))
    return report


def load_documents(candidate: Path, authority_path: Path = AUTHORITY_PATH) -> tuple[dict[str, Any], dict[str, str]]:
    candidate_paths = {
        name: candidate / name
        for name in (EXACT_FILE, CAUSAL_FILE, EVENT_FILE, IDENTITY_FILE, SEMANTIC_FILE, MANIFEST_FILE)
    }
    initial_paths = {**candidate_paths, "authority": authority_path}
    initial_hashes = {key: file_sha256(path) for key, path in initial_paths.items()}
    manifest = load_json(candidate_paths[MANIFEST_FILE])
    authority = load_json(authority_path)
    profile, profile_errors = resolve_review_profile(
        manifest,
        authority,
        initial_hashes["authority"],
        {name: initial_hashes[name] for name in candidate_paths},
    )
    paths = {
        **initial_paths,
        "frozenPolicy": profile["policyPath"],
        "predecessorPolicyV3": LEGACY_POLICY_PATH,
        "grandPredecessorPolicyV2": V2_POLICY_PATH,
        "prefixRegister": PREFIX_PATH,
    }
    if profile["profileId"] == SUCCESSOR_V5_PROFILE["profileId"]:
        paths["predecessorPolicyV4"] = V4_POLICY_PATH
    start_hashes = {key: file_sha256(path) for key, path in paths.items()}
    documents = {name: load_json(path) for name, path in candidate_paths.items()}
    documents["authority"] = authority
    documents["frozenPolicy"] = load_json(profile["policyPath"])
    documents["prefixRows"] = load_prefix_rows()
    documents["candidatePath"] = candidate.resolve()
    documents["authorityPath"] = authority_path.resolve()
    documents["reviewProfile"] = profile
    documents["profileResolutionErrors"] = profile_errors
    end_hashes = {key: file_sha256(path) for key, path in paths.items()}
    if start_hashes != end_hashes:
        raise RuntimeError(f"Input bytes changed while loading: before={start_hashes}, after={end_hashes}")
    return documents, start_hashes


def finding_exists(report: dict[str, Any], rule_id: str, subject_contains: str, evidence_contains: str = "") -> bool:
    for finding in report["findings"]:
        if finding["ruleId"] != rule_id or subject_contains not in finding["subject"]:
            continue
        if evidence_contains and evidence_contains not in json.dumps(finding["evidence"], ensure_ascii=False, sort_keys=True):
            continue
        return True
    return False


def run_self_tests(documents: dict[str, Any], input_hashes: dict[str, str]) -> dict[str, Any]:
    tests: list[dict[str, Any]] = []

    def execute(test_id: str, mutate: Any, rule_id: str, subject: str, evidence: str = "") -> None:
        mutated = copy.deepcopy(documents)
        mutate(mutated)
        result = audit_documents(mutated, input_hashes, include_self_tests=False)
        passed = finding_exists(result, rule_id, subject, evidence)
        tests.append(
            {
                "testId": test_id,
                "expectedRuleId": rule_id,
                "expectedSubjectContains": subject,
                "status": "PASS" if passed else "FAIL",
            }
        )

    def execute_strict(
        test_id: str,
        mutate: Any,
        rule_id: str,
        subject: str,
        evidence: str = "",
        prepare: Any = None,
    ) -> None:
        control_docs = copy.deepcopy(documents)
        if prepare:
            prepare(control_docs)
        control = audit_documents(control_docs, input_hashes, include_self_tests=False)
        mutated = copy.deepcopy(control_docs)
        mutate(mutated)
        result = audit_documents(mutated, input_hashes, include_self_tests=False)
        control_clear = not finding_exists(control, rule_id, subject, evidence)
        detected = finding_exists(result, rule_id, subject, evidence)
        tests.append(
            {
                "testId": test_id,
                "expectedRuleId": rule_id,
                "expectedSubjectContains": subject,
                "positiveControl": "PASS" if control_clear else "FAIL",
                "hostileMutation": "FAIL_DETECTED" if detected else "MISSED",
                "status": "PASS" if control_clear and detected else "FAIL",
            }
        )

    def table(doc: dict[str, Any], name: str) -> dict[str, Any]:
        return next(row for row in doc[EXACT_FILE]["tableSpecifications"] if row["tableName"] == name)

    execute(
        "HOSTILE-CROSS-OWNER-LOCAL-FK",
        lambda doc: table(doc, "ppl_hrs_cases").setdefault("foreignKeys", []).append(
            {
                "mode": "LOCAL_COMPOSITE_FK",
                "columns": ["tenant_id", "owner_principal_id"],
                "target": "prf_grw_profiles",
                "targetColumns": ["tenant_id", "public_id"],
                "constraintId": "hostile_cross_owner_fk",
            }
        ),
        "LOCAL_FK_CROSSES_OWNER_STREAM",
        "hostile_cross_owner_fk",
    )
    execute(
        "HOSTILE-DECLARED-CROSS-SCHEMA-FK",
        lambda doc: table(doc, "ppl_hrs_cases").setdefault("crossSchemaForeignKeys", []).append("hostile.cross.schema"),
        "DECLARED_CROSS_SCHEMA_FK_FORBIDDEN",
        "ppl_hrs_cases",
        "hostile.cross.schema",
    )
    execute(
        "HOSTILE-FOREIGN-LOCAL-ID",
        lambda doc: table(doc, "ppl_hrs_cases").setdefault("columns", []).append(
            {
                "name": "hostile_foreign_local_id",
                "sqlType": "BIGINT",
                "nullable": True,
                "source": "HOSTILE",
                "referenceContract": {"entityType": "table:prf_grw_profiles", "idSpace": "INTERNAL_BIGINT"},
            }
        ),
        "FOREIGN_LOCAL_ID_REFERENCE",
        "ppl_hrs_cases.hostile_foreign_local_id",
    )
    execute(
        "HOSTILE-FOREIGN-SELECTOR",
        lambda doc: next(op for op in doc[CAUSAL_FILE]["operations"] if op["operationId"] == "modern.listening.active.query")
        .setdefault("selectors", [])
        .append({"source": "hostile", "selectorType": "LOCAL_TABLE", "targetTable": "sys_hris_listening_surveys"}),
        "FOREIGN_LOCAL_SELECTOR",
        "modern.listening.active.query:hostile",
    )
    execute(
        "HOSTILE-FOREIGN-DML",
        lambda doc: next(op for op in doc[CAUSAL_FILE]["operations"] if op["operationId"] == "modern.listening.response.submit")
        .setdefault("orderedDml", [])
        .append({"step": 999, "action": "INSERT", "table": "sys_hris_listening_surveys", "assignments": {}}),
        "OPERATION_DML_OUTSIDE_OWNER_STREAM",
        "modern.listening.response.submit",
        "sys_hris_listening_surveys",
    )
    execute(
        "HOSTILE-INTERNAL-PORT-FIELD",
        lambda doc: doc["authority"]["eventOwnership"]["internalPortMessages"][0]["fieldAllowlist"].append("hostileOnlyField"),
        "INTERNAL_PORT_PAYLOAD_FIELDS_MISSING",
        "internal.listening.protected.admission-install.consume",
        "hostileOnlyField",
    )
    execute(
        "HOSTILE-FORBIDDEN-EVENT-FIELD",
        lambda doc: next(
            row for row in doc[EVENT_FILE]["eventPayloadSchemas"] if row.get("eventName") == "EmployeeListeningActionCompleted.v3"
        )["fields"].append({"name": "hostileResponseToken", "type": "STRING", "source": "CONSTANT:X"}),
        "FORBIDDEN_PUBLIC_EVENT_FIELD",
        "EmployeeListeningActionCompleted.v3",
        "hostileResponseToken",
    )
    execute(
        "HOSTILE-STREAM-OWNERSHIP-DRIFT",
        lambda doc: table(doc, "sys_hris_listening_surveys").update({"streamKey": "platform-hris-insights"}),
        "LISTENING_TABLE_STREAM_DRIFT",
        "sys_hris_listening_surveys",
    )
    execute(
        "HOSTILE-CONSTRAINT-MISSING-COLUMN",
        lambda doc: table(doc, "ppl_hrs_cases").setdefault("uniqueKeys", []).append(
            {"constraintId": "hostile_missing_column_key", "columns": ["tenant_id", "hostile_missing_column"]}
        ),
        "CONSTRAINT_COLUMN_NOT_DECLARED",
        "hostile_missing_column_key",
    )
    candidate_hashes = {name: input_hashes.get(name, "") for name in HISTORICAL_Q0_MEMBER_SHA256}
    positive_manifest = copy.deepcopy(documents[MANIFEST_FILE])
    if documents["reviewProfile"]["profileId"] == SUCCESSOR_V5_PROFILE["profileId"]:
        positive_manifest.setdefault("tableScopeChange", {})["acceptancePolicy"] = expected_v5_manifest_policy_pin()
        positive_manifest.setdefault("ownerBoundaryInputs", {})["listeningStreamAuthority"] = {
            "contractId": SUCCESSOR_V5_PROFILE["authorityContractId"],
            "path": "coding-readiness/sys-listening-stream-authority-successor.v2.json",
            "fileSha256": input_hashes["authority"],
            "sealedPayloadSha256": documents["authority"].get("sealedPayloadSha256"),
        }
    renamed_profile, renamed_errors = resolve_review_profile(
        positive_manifest, documents["authority"], input_hashes["authority"], candidate_hashes
    )
    confused_manifest = copy.deepcopy(positive_manifest)
    confused_manifest.setdefault("tableScopeChange", {})["acceptancePolicy"] = expected_v5_manifest_policy_pin()
    immutable_v1 = load_json(AUTHORITY_PATH)
    confused_profile, confused_errors = resolve_review_profile(
        confused_manifest, immutable_v1, EXPECTED_V1_AUTHORITY_SHA256, candidate_hashes
    )
    mode_pass = (
        renamed_profile["profileId"] == documents["reviewProfile"]["profileId"]
        and not renamed_errors
        and confused_profile["profileId"] == SUCCESSOR_V5_PROFILE["profileId"]
        and any(row.get("reason") == "V5_AUTHORITY_CONTRACT_MISMATCH" for row in confused_errors)
    )
    tests.append({
        "testId": "HOSTILE-POLICY-AUTHORITY-MODE-CONFUSION",
        "status": "PASS" if mode_pass else "FAIL",
        "renamedContentProfile": renamed_profile["profileId"],
        "confusedProfile": confused_profile["profileId"],
        "confusedErrors": confused_errors,
    })

    def prepare_policy_pin(doc: dict[str, Any]) -> None:
        if doc["reviewProfile"]["profileId"] == SUCCESSOR_V5_PROFILE["profileId"]:
            doc[MANIFEST_FILE].setdefault("tableScopeChange", {})["acceptancePolicy"] = expected_v5_manifest_policy_pin()

    if documents["reviewProfile"]["profileId"] == SUCCESSOR_V5_PROFILE["profileId"]:
        execute_strict(
            "HOSTILE-PROTECTED-SUBMIT-OUTBOX",
            lambda doc: next(
                op for op in doc[CAUSAL_FILE]["operations"]
                if op["operationId"] == "modern.listening.response.submit"
            ).setdefault("orderedDml", []).append({
                "step": 8,
                "action": "APPEND",
                "table": "sys_hris_listening_protected_outbox",
                "role": "HOSTILE_BROKER_OUTBOX",
                "assignments": {},
            }),
            "OWNER_LOCAL_CONTROL_DML_MISSING",
            "modern.listening.response.submit",
            "HOSTILE_BROKER_OUTBOX",
        )
        execute_strict(
            "HOSTILE-PROTECTED-SUBMIT-MISSING-ANSWER-STEP",
            lambda doc: next(
                op for op in doc[CAUSAL_FILE]["operations"]
                if op["operationId"] == "modern.listening.response.submit"
            ).__setitem__(
                "orderedDml",
                [
                    row for row in next(
                        op for op in doc[CAUSAL_FILE]["operations"]
                        if op["operationId"] == "modern.listening.response.submit"
                    )["orderedDml"]
                    if row.get("table") != "sys_hris_listening_answer_values"
                ],
            ),
            "OWNER_LOCAL_CONTROL_DML_MISSING",
            "modern.listening.response.submit",
            "sys_hris_listening_answer_values",
        )
        execute_strict(
            "HOSTILE-V2-AUTHORITY-PREDECESSOR-EDGE",
            lambda doc: doc["authority"].setdefault("successorLineage", {}).__setitem__(
                "predecessorFileSha256", "0" * 64
            ),
            "SUCCESSOR_AUTHORITY_V1_PIN_MISSING",
            str(documents["authorityPath"]),
        )

        manifest_edge_tests = []
        for test_id, mutation in (
            (
                "HOSTILE-MANIFEST-V2-FILE-HASH",
                lambda pin: pin.__setitem__("fileSha256", "0" * 64),
            ),
            (
                "HOSTILE-MANIFEST-V2-PAYLOAD-SEAL",
                lambda pin: pin.__setitem__("sealedPayloadSha256", "0" * 64),
            ),
            (
                "HOSTILE-MANIFEST-TRANSITIVE-PREDECESSOR-FIELD",
                lambda pin: pin.__setitem__("predecessorFileSha256", EXPECTED_V1_AUTHORITY_SHA256),
            ),
        ):
            hostile_manifest = copy.deepcopy(positive_manifest)
            hostile_pin = hostile_manifest["ownerBoundaryInputs"]["listeningStreamAuthority"]
            mutation(hostile_pin)
            _, edge_errors = resolve_review_profile(
                hostile_manifest, documents["authority"], input_hashes["authority"], candidate_hashes
            )
            detected = any(
                row.get("reason") == "V5_EXPLICIT_AUTHORITY_PIN_MISMATCH"
                for row in edge_errors
            )
            manifest_edge_tests.append({
                "testId": test_id,
                "status": "PASS" if detected else "FAIL",
                "hostileMutation": "FAIL_DETECTED" if detected else "MISSED",
                "errors": edge_errors,
            })
        tests.extend(manifest_edge_tests)

    execute_strict(
        "HOSTILE-ACTIVE-TABLE-COUNT-SPOOF",
        lambda doc: doc[MANIFEST_FILE]["tableScopeChange"].__setitem__(
            "activeTableSpecifications", doc["reviewProfile"]["tableCount"] + 1
        ),
        "TABLE_SCOPE_DELTA_DRIFT",
        "manifest.tableScopeChange",
    )

    def drift_policy_pin(doc: dict[str, Any]) -> None:
        scope = doc[MANIFEST_FILE].setdefault("tableScopeChange", {})
        if doc["reviewProfile"]["profileId"] == SUCCESSOR_V5_PROFILE["profileId"]:
            pin = copy.deepcopy(scope.get("acceptancePolicy") or expected_v5_manifest_policy_pin())
            pin["fileSha256"] = "0" * 64
            scope["acceptancePolicy"] = pin
        else:
            scope["acceptancePolicy"] = {"fileSha256": "0" * 64}

    execute_strict(
        "HOSTILE-POLICY-PIN-DRIFT",
        drift_policy_pin,
        "SCOPE_POLICY_PIN_DRIFT",
        "manifest.tableScopeChange.acceptancePolicy",
        prepare=prepare_policy_pin,
    )

    execute_strict(
        "HOSTILE-AUTHORITY-PLANNED-TABLE-COUNT-SPOOF",
        lambda doc: doc["authority"]["tableOwnership"].pop(),
        "SUCCESSOR_AUTHORITY_PRODUCT_CLOSURE_DRIFT",
        str(documents["authorityPath"]),
    )

    removal_fixture = {
        role: {} for role in (EXACT_FILE, CAUSAL_FILE, EVENT_FILE, IDENTITY_FILE, SEMANTIC_FILE, MANIFEST_FILE)
    }
    removal_fixture[EXACT_FILE] = {"tableSpecifications": []}
    removal_fixture[MANIFEST_FILE] = {
        "tableScopeChange": {
            "removedTableIds": sorted(EXPECTED_V4_REMOVED_TABLES),
            "removalDisposition": {name: {"reason": "reviewed"} for name in EXPECTED_V4_REMOVED_TABLES},
        }
    }
    removal_fixture["authority"] = {}
    control_findings: list[dict[str, Any]] = []
    validate_removed_table_references(removal_fixture, SUCCESSOR_V5_PROFILE, control_findings)
    hostile_fixture = copy.deepcopy(removal_fixture)
    hostile_fixture[SEMANTIC_FILE] = {"danglingTable": next(iter(EXPECTED_V4_REMOVED_TABLES))}
    hostile_findings: list[dict[str, Any]] = []
    validate_removed_table_references(hostile_fixture, SUCCESSOR_V5_PROFILE, hostile_findings)
    removal_pass = (
        not any(row["ruleId"] == "REMOVED_TABLE_DANGLING_REFERENCE" for row in control_findings)
        and any(row["ruleId"] == "REMOVED_TABLE_DANGLING_REFERENCE" for row in hostile_findings)
    )
    tests.append({
        "testId": "HOSTILE-REMOVED-TABLE-DANGLING-REFERENCE",
        "status": "PASS" if removal_pass else "FAIL",
        "positiveControl": "PASS" if not control_findings else "FAIL",
        "hostileMutation": "FAIL_DETECTED" if hostile_findings else "MISSED",
    })
    return {
        "status": "PASS" if all(test["status"] == "PASS" for test in tests) else "FAIL",
        "testCount": len(tests),
        "passed": sum(test["status"] == "PASS" for test in tests),
        "tests": tests,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("candidate", nargs="?", type=Path, default=DEFAULT_CANDIDATE)
    parser.add_argument(
        "--authority",
        type=Path,
        default=AUTHORITY_PATH,
        help="Listening authority: immutable v1 for q0 evidence; a sealed, v1-pinned v2 is mandatory for distinct candidates",
    )
    parser.add_argument("--output", type=Path, default=None, help="Write deterministic JSON report to this reviewer-owned path")
    parser.add_argument("--self-test", action="store_true", help="Run in-memory hostile mutation tests")
    args = parser.parse_args()

    documents, hashes = load_documents(args.candidate.resolve(), args.authority.resolve())
    report = audit_documents(documents, hashes, include_self_tests=args.self_test)
    audited_paths = {
        name: args.candidate.resolve() / name
        for name in (EXACT_FILE, CAUSAL_FILE, EVENT_FILE, IDENTITY_FILE, SEMANTIC_FILE, MANIFEST_FILE)
    }
    audited_paths.update(
        {
            "authority": args.authority.resolve(),
            "frozenPolicy": documents["reviewProfile"]["policyPath"],
            "predecessorPolicyV3": LEGACY_POLICY_PATH,
            "grandPredecessorPolicyV2": V2_POLICY_PATH,
            "prefixRegister": PREFIX_PATH,
        }
    )
    if documents["reviewProfile"]["profileId"] == SUCCESSOR_V5_PROFILE["profileId"]:
        audited_paths["predecessorPolicyV4"] = V4_POLICY_PATH
    final_hashes = {key: file_sha256(path) for key, path in audited_paths.items()}
    if hashes != final_hashes:
        raise RuntimeError(f"Input bytes changed during full audit: before={hashes}, after={final_hashes}")
    report["inputStability"] = "UNCHANGED_DURING_FULL_AUDIT"
    report.pop("sealedPayloadSha256", None)
    report["sealedPayloadSha256"] = sha256_bytes(canonical_json(report))
    rendered = json.dumps(report, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    sys.stdout.write(rendered)
    return 0 if report["status"] == "PASS" and report.get("selfTests", {}).get("status", "PASS") == "PASS" else 1


if __name__ == "__main__":
    import pathlib as _guard_pathlib
    import sys as _guard_sys

    _guard_dir = _guard_pathlib.Path(__file__).resolve().parent
    while not (_guard_dir / "modern_successor_reader_guard.py").is_file():
        if _guard_dir.parent == _guard_dir:
            raise SystemExit("modern successor reader guard is unavailable")
        _guard_dir = _guard_dir.parent
    _guard_sys.path.insert(0, str(_guard_dir))
    from modern_successor_reader_guard import guarded_main as _guarded_main

    raise SystemExit(_guarded_main(__file__, main))
