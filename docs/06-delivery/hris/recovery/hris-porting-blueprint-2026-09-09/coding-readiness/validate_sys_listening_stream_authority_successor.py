#!/usr/bin/env python3
"""Independent fail-closed validator for the SYS listening authority successor.

The validator intentionally does not import the writer.  Normal mode validates
the current contract plus every canonical consumer.  Self-test mutates an
in-memory copy and proves the named hostile cases are rejected.
"""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import math
import re
from pathlib import Path
from typing import Any, Callable


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CONTRACT = HERE / "sys-listening-stream-authority-successor.v1.json"
CONTRACT_ID = "dwp.hris.sys.listening.stream-authority-successor.v1"
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")

STREAMS = {
    "platform-hris-configuration": (
        "dwp-platform-server", "DWP_PLATFORM_HRIS_CONFIGURATION", "hris_configuration",
        "flyway_hris_configuration_history",
        "dwp-platform-server/src/main/resources/db/hris-configuration/migration",
        "MIG-SYS-PLATFORM-HRIS-CONFIGURATION-1-40",
        "OWN-SYS-BE-MIG-PLATFORM-HRIS-CONFIGURATION",
    ),
    "platform-hris-listening-protected": (
        "dwp-platform-server", "DWP_PLATFORM_HRIS_LISTENING_PROTECTED", "hris_listening_protected",
        "flyway_hris_listening_protected_history",
        "dwp-platform-server/src/main/resources/db/hris-listening-protected/migration",
        "MIG-SYS-PLATFORM-HRIS-LISTENING-PROTECTED-1-40",
        "OWN-SYS-BE-MIG-PLATFORM-HRIS-LISTENING-PROTECTED",
    ),
    "platform-hris-insights": (
        "dwp-platform-server", "DWP_PLATFORM_HRIS_INSIGHTS", "hris_insights",
        "flyway_hris_insights_history",
        "dwp-platform-server/src/main/resources/db/hris-insights/migration",
        "MIG-SYS-PLATFORM-HRIS-INSIGHTS-1-40",
        "OWN-SYS-BE-MIG-PLATFORM-HRIS-INSIGHTS",
    ),
    "auth-hris-participation-issuer": (
        "dwp-auth-server", "DWP_AUTH_HRIS_PARTICIPATION_ISSUER", "hris_participation_issuer",
        "flyway_hris_participation_issuer_history",
        "dwp-auth-server/src/main/resources/db/hris-participation-issuer/migration",
        "MIG-SYS-AUTH-HRIS-PARTICIPATION-ISSUER-1-40",
        "OWN-SYS-BE-MIG-AUTH-HRIS-PARTICIPATION-ISSUER",
    ),
}

PUBLIC_OPERATIONS = {
    "modern.listening.active.query": "platform-hris-listening-protected",
    "modern.listening.response.submit": "platform-hris-listening-protected",
    "modern.listening.surveys.query": "platform-hris-configuration",
    "modern.listening.survey.create": "platform-hris-configuration",
    "modern.listening.survey.revise": "platform-hris-configuration",
    "modern.listening.survey.publish": "platform-hris-configuration",
    "modern.listening.survey.close": "platform-hris-configuration",
    "modern.listening.cohorts.query": "platform-hris-insights",
    "modern.listening.action.create": "platform-hris-configuration",
    "modern.listening.action.complete": "platform-hris-configuration",
}

OWNER_PORTS = {
    "configuration.querySurveys": "platform-hris-configuration",
    "configuration.createSurvey": "platform-hris-configuration",
    "configuration.reviseSurvey": "platform-hris-configuration",
    "configuration.publishSurveyOrchestrate": "platform-hris-configuration",
    "configuration.closeSurveyOrchestrate": "platform-hris-configuration",
    "configuration.createAction": "platform-hris-configuration",
    "configuration.completeAction": "platform-hris-configuration",
    "protected.listActiveAdmissions": "platform-hris-listening-protected",
    "protected.installAdmission": "platform-hris-listening-protected",
    "protected.closeAdmission": "platform-hris-listening-protected",
    "protected.submitResponse": "platform-hris-listening-protected",
    "protected.requestErasure": "platform-hris-listening-protected",
    "protected.buildCohortPackage": "platform-hris-listening-protected",
    "insights.ingestCohortPackage": "platform-hris-insights",
    "insights.queryCohortResults": "platform-hris-insights",
    "issuer.issueParticipationEnvelope": "auth-hris-participation-issuer",
    "issuer.resolveParticipationStatus": "auth-hris-participation-issuer",
    "issuer.revokeParticipationEnvelope": "auth-hris-participation-issuer",
}

TABLES_BY_STREAM = {
    "platform-hris-configuration": {
        "sys_hris_listening_surveys", "sys_hris_listening_survey_versions",
        "sys_hris_listening_actions", "sys_hris_listening_operation_receipts",
        "sys_hris_listening_domain_outbox",
    },
    "platform-hris-listening-protected": {
        "sys_hris_listening_admission_versions", "sys_hris_listening_responses",
        "sys_hris_listening_answer_values", "sys_hris_listening_token_consumptions",
        "sys_hris_listening_protected_receipts", "sys_hris_listening_erasure_tickets",
        "sys_hris_listening_cohort_budgets", "sys_hris_listening_cohort_packages",
        "sys_hris_listening_protected_outbox",
    },
    "platform-hris-insights": {
        "sys_hris_listening_cohort_projections", "sys_hris_listening_lineage_receipts",
        "sys_hris_listening_export_receipts", "sys_hris_listening_insights_inbox",
        "sys_hris_listening_insights_outbox",
    },
    "auth-hris-participation-issuer": {
        "sys_hris_listening_eligibility_versions", "sys_hris_listening_token_issuances",
        "sys_hris_listening_token_revocations", "sys_hris_listening_issuer_receipts",
        "sys_hris_listening_issuer_outbox",
    },
}

PUBLIC_EVENTS = {
    "EmployeeListeningSurveyCreated.v3",
    "EmployeeListeningSurveyRevised.v3",
    "EmployeeListeningSurveyPublished.v3",
    "EmployeeListeningSurveyClosed.v3",
    "EmployeeListeningActionCreated.v3",
    "EmployeeListeningActionCompleted.v3",
    "EmployeeListeningCohortProjectionPublished.v1",
}

INTERNAL_MESSAGES = {
    "ListeningAdmissionInstallRequested.v1",
    "ListeningAdmissionInstallReceipt.v1",
    "ListeningAdmissionCloseRequested.v1",
    "ListeningAdmissionCloseReceipt.v1",
    "ListeningCohortPackageReady.v1",
    "ListeningCohortProjectionReceipt.v1",
}

OWNER_LOCAL_ERASURE_REQUEST_HANDLER = (
    "internal.listening.protected.erasure.request"
)
OWNER_LOCAL_ERASURE_PROCESS_HANDLER = (
    "internal.listening.protected.erasure.process"
)
INTERNAL_HANDLER_BY_MESSAGE = {
    "ListeningAdmissionInstallRequested.v1": (
        "internal.listening.protected.admission-install.consume",
        "platform-hris-listening-protected",
        "sys_hris_listening_protected_receipts",
        "sys_hris_listening_protected_outbox",
    ),
    "ListeningAdmissionInstallReceipt.v1": (
        "internal.listening.configuration.admission-install-receipt.consume",
        "platform-hris-configuration",
        "sys_hris_listening_operation_receipts",
        "sys_hris_listening_domain_outbox",
    ),
    "ListeningAdmissionCloseRequested.v1": (
        "internal.listening.protected.admission-close.consume",
        "platform-hris-listening-protected",
        "sys_hris_listening_protected_receipts",
        "sys_hris_listening_protected_outbox",
    ),
    "ListeningAdmissionCloseReceipt.v1": (
        "internal.listening.configuration.admission-close-receipt.consume",
        "platform-hris-configuration",
        "sys_hris_listening_operation_receipts",
        "sys_hris_listening_domain_outbox",
    ),
    "ListeningCohortPackageReady.v1": (
        "internal.listening.insights.cohort-package.consume",
        "platform-hris-insights",
        "sys_hris_listening_insights_inbox",
        "sys_hris_listening_insights_outbox",
    ),
    "ListeningCohortProjectionReceipt.v1": (
        "internal.listening.protected.cohort-projection-receipt.consume",
        "platform-hris-listening-protected",
        "sys_hris_listening_protected_receipts",
        "sys_hris_listening_protected_outbox",
    ),
}
OWNER_LOCAL_HANDLER_IDS = {
    OWNER_LOCAL_ERASURE_REQUEST_HANDLER,
    OWNER_LOCAL_ERASURE_PROCESS_HANDLER,
    *(item[0] for item in INTERNAL_HANDLER_BY_MESSAGE.values()),
}

PROFILE_IDS = {
    "G3-SYS-LISTEN-CONFIGURATION-BE",
    "G3-SYS-LISTEN-PROTECTED-BE",
    "G3-SYS-LISTEN-INSIGHTS-BE",
    "G3-SYS-LISTEN-ISSUER-BE",
    "G3-SYS-LISTEN-FE",
}

DESIGN_ID = "dwp.hris.sys.listening.canonical-static-design.v1"
EXPECTED_STATIC_DESIGN_DIGEST = (
    "3b50d4cba484dcdb1458ce37e60728574a1f0eb8280058669498c35bb160fe02"
)
CANONICAL_INPUTS = (
    (
        "operationCausal",
        "coding-readiness/modern-capability-operation-causal-contract-ssot.v2.json",
        "contractId",
        "dwp.hris.modern.operation-causal-state.reviewed-candidate.v2",
    ),
    (
        "semanticBindings",
        "coding-readiness/modern-capability-semantic-bindings.v1.json",
        "registryId",
        "dwp.hris.modern.operation-semantic-bindings.v1",
    ),
    (
        "publicIdentities",
        "coding-readiness/modern-capability-public-identity-registry.v1.json",
        "registryId",
        "dwp.hris.modern.public-identities.v1",
    ),
    (
        "exactSchemas",
        "coding-readiness/modern-capability-exact-schema-contracts.v1.json",
        "contractId",
        "dwp.hris.modern.exact-schema.v1",
    ),
    (
        "eventPayloads",
        "coding-readiness/modern-capability-event-payload-contracts.v1.json",
        "contractId",
        "dwp.hris.modern.event-payloads.v1",
    ),
)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_payload(value: dict[str, Any]) -> bytes:
    payload = {key: item for key, item in value.items() if key != "sealedPayloadSha256"}
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def reject_constant(value: str) -> None:
    raise ValueError(f"non-finite JSON constant forbidden: {value}")


def reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def load_strict(path: Path) -> dict[str, Any]:
    raw = path.read_bytes()
    if raw.startswith(b"\xef\xbb\xbf"):
        raise ValueError("UTF-8 BOM forbidden")
    if not raw.endswith(b"\n") or raw.endswith(b"\n\n"):
        raise ValueError("contract must end with exactly one LF")
    value = json.loads(
        raw.decode("utf-8"),
        object_pairs_hook=reject_duplicates,
        parse_constant=reject_constant,
        parse_float=lambda value: (_ for _ in ()).throw(ValueError(f"float forbidden: {value}")),
    )
    if not isinstance(value, dict):
        raise ValueError("top level must be an object")
    canonical_file = (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")
    if raw != canonical_file:
        raise ValueError("non-canonical JSON file bytes")
    return value


def load_canonical_input_strict(path: Path) -> dict[str, Any]:
    """Load a canonical authority without imposing this summary's key order."""

    raw = path.read_bytes()
    if raw.startswith(b"\xef\xbb\xbf"):
        raise ValueError("UTF-8 BOM forbidden")
    if not raw.endswith(b"\n") or raw.endswith(b"\n\n"):
        raise ValueError("canonical input must end with exactly one LF")
    value = json.loads(
        raw.decode("utf-8"),
        object_pairs_hook=reject_duplicates,
        parse_constant=reject_constant,
        parse_float=lambda value: (_ for _ in ()).throw(
            ValueError(f"float forbidden: {value}")
        ),
    )
    if not isinstance(value, dict):
        raise ValueError("canonical input top level must be an object")
    return value


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def pipe(value: str | None) -> set[str]:
    return {item for item in (value or "").split("|") if item}


def canonical_composition_marker(role: str) -> dict[str, Any]:
    return {
        "designId": DESIGN_ID,
        "designSha256": EXPECTED_STATIC_DESIGN_DIGEST,
        "role": role,
        "authorityMode": "PRIMARY_CANONICAL_FIVE_ROWS",
        "dependencyDirection": "STATIC_DESIGN_TO_CANONICAL_FIVE_TO_DERIVED_SUMMARY",
        "derivedSummaryDependency": "FORBIDDEN",
    }


def listening_operation_rows(rows: Any) -> list[dict[str, Any]]:
    return [
        copy.deepcopy(row)
        for row in rows if isinstance(row, dict)
        and str(row.get("operationId", "")).startswith("modern.listening.")
    ]


def listening_event_rows(rows: Any) -> list[dict[str, Any]]:
    return [
        copy.deepcopy(row)
        for row in rows if isinstance(row, dict)
        and row.get("eventName") in PUBLIC_EVENTS
    ]


def canonical_subset_independent(
    role: str, document: dict[str, Any]
) -> dict[str, Any]:
    all_tables = set().union(*TABLES_BY_STREAM.values())
    marker = copy.deepcopy(document.get("listeningCanonicalComposition"))
    if role == "operationCausal":
        return {
            "composition": marker,
            "operations": listening_operation_rows(document.get("operations", [])),
            "eventSuccessorLineage": [
                copy.deepcopy(row)
                for row in document.get("eventSuccessorLineage", [])
                if "Listening" in json.dumps(row, ensure_ascii=False, sort_keys=True)
            ],
            "publicEvents": listening_event_rows(
                document.get("publicEventOwnership", {}).get("events", [])
            ),
            "expectedTables": sorted(
                all_tables
                & set(document.get("schemaOracle", {}).get("expectedTables", []))
            ),
        }
    if role == "semanticBindings":
        return {
            "composition": marker,
            "operations": listening_operation_rows(document.get("operations", [])),
        }
    if role == "publicIdentities":
        result: dict[str, Any] = {"composition": marker}
        result["physicalColumns"] = {
            key: copy.deepcopy(value)
            for key, value in sorted(document.get("physicalColumns", {}).items())
            if key.split(".", 1)[0] in all_tables
        }
        for key in (
            "requestFieldsByOperation",
            "responseFieldsByOperation",
            "eventFieldsByOperation",
        ):
            result[key] = {
                op_id: copy.deepcopy(value)
                for op_id, value in sorted(document.get(key, {}).items())
                if op_id in PUBLIC_OPERATIONS
            }
        return result
    if role == "exactSchemas":
        operations = listening_operation_rows(document.get("operationBindings", []))
        schema_ids = {
            str(value)
            for row in operations
            for value in (row.get("requestSchemaRef"), row.get("responseSchemaRef"))
            if value
        }
        schemas = document.get("recordSchemas", []) + document.get("responseSchemas", [])
        selected: dict[str, dict[str, Any]] = {}
        while True:
            before = len(schema_ids)
            for row in schemas:
                if row.get("schemaId") not in schema_ids:
                    continue
                selected[str(row["schemaId"])] = copy.deepcopy(row)
                for field in row.get("fields", []):
                    nested = field.get("schemaRef") or field.get("itemSchemaRef")
                    if nested:
                        schema_ids.add(str(nested))
            if len(schema_ids) == before:
                break
        return {
            "composition": marker,
            "operations": operations,
            "tables": [
                copy.deepcopy(row)
                for row in document.get("tableSpecifications", [])
                if row.get("tableName") in all_tables
            ],
            "schemas": [selected[key] for key in sorted(selected)],
            "fieldLineage": listening_operation_rows(
                document.get("operationFieldLineage", [])
            ),
            "internalHandlers": [
                copy.deepcopy(row)
                for row in document.get("internalConsumerHandlers", [])
                if row.get("capabilityId") == "HRIS.MODERN.EMPLOYEE_LISTENING"
            ],
        }
    if role == "eventPayloads":
        return {
            "composition": marker,
            "events": listening_event_rows(document.get("eventPayloadSchemas", [])),
            "internalHandlers": [
                copy.deepcopy(row)
                for row in document.get("internalEventHandlers", [])
                if "Listening" in json.dumps(row, ensure_ascii=False, sort_keys=True)
            ],
        }
    raise ValueError(f"unknown canonical role: {role}")


def independent_subset_counts(subset: dict[str, Any]) -> dict[str, int]:
    return {
        key: len(value)
        for key, value in sorted(subset.items())
        if key != "composition" and isinstance(value, (list, dict))
    }


def validate_canonical_input_documents(
    documents: dict[str, dict[str, Any]], errors: list[str]
) -> None:
    expected_roles = {item[0] for item in CANONICAL_INPUTS}
    if set(documents) != expected_roles:
        errors.append("CANONICAL_INPUT_ROLE_SET")
        return
    for role, document in documents.items():
        if document.get("listeningCanonicalComposition") != canonical_composition_marker(role):
            errors.append(f"CANONICAL_COMPOSITION_MARKER:{role}")
        blob = json.dumps(document, ensure_ascii=False, sort_keys=True)
        for forbidden in (
            CONTRACT_ID,
            "coding-readiness/sys-listening-stream-authority-successor.v1.json",
            "sys-listening-stream-authority-successor.v1.json",
            "canonicalSuccessorOverlay",
            "canonicalSuccessorOverlays",
            '"predecessorPins"',
            '"historicalPredecessor"',
        ):
            if forbidden in blob:
                errors.append(f"CANONICAL_REVERSE_REFERENCE:{role}:{forbidden}")
        if "EmployeeListeningResponseSubmitted.v2" in blob:
            errors.append(f"CANONICAL_LEGACY_RESPONSE_EVENT:{role}")

    causal = documents["operationCausal"]
    causal_ops = {
        row.get("operationId")
        for row in causal.get("operations", [])
        if str(row.get("operationId", "")).startswith("modern.listening.")
    }
    if causal_ops != set(PUBLIC_OPERATIONS):
        errors.append("CANONICAL_CAUSAL_OPERATION_SET")
    causal_blob = json.dumps(causal, ensure_ascii=False, sort_keys=True)
    for name in INTERNAL_MESSAGES:
        if name not in causal_blob:
            errors.append(f"CANONICAL_CAUSAL_INTERNAL_MESSAGE:{name}")
    causal_handler_ids = {
        row.get("handlerId")
        for row in causal.get("systemHandlers", [])
        if isinstance(row, dict)
        and row.get("handlerId") in OWNER_LOCAL_HANDLER_IDS
    }
    if causal_handler_ids != OWNER_LOCAL_HANDLER_IDS:
        errors.append("CANONICAL_CAUSAL_HANDLER_SET")

    semantic_ops = {
        row.get("operationId")
        for row in documents["semanticBindings"].get("operations", [])
        if str(row.get("operationId", "")).startswith("modern.listening.")
    }
    if semantic_ops != set(PUBLIC_OPERATIONS):
        errors.append("CANONICAL_SEMANTIC_OPERATION_SET")

    response_ops = {
        key
        for key in documents["publicIdentities"].get(
            "responseFieldsByOperation", {}
        )
        if key.startswith("modern.listening.")
    }
    if response_ops != set(PUBLIC_OPERATIONS):
        errors.append("CANONICAL_IDENTITY_RESPONSE_OPERATION_SET")

    exact = documents["exactSchemas"]
    exact_ops = {
        row.get("operationId")
        for row in exact.get("operationBindings", [])
        if str(row.get("operationId", "")).startswith("modern.listening.")
    }
    all_tables = set().union(*TABLES_BY_STREAM.values())
    exact_tables = {
        row.get("tableName")
        for row in exact.get("tableSpecifications", [])
        if row.get("tableName") in all_tables
    }
    if exact_ops != set(PUBLIC_OPERATIONS):
        errors.append("CANONICAL_EXACT_OPERATION_SET")
    if exact_tables != all_tables:
        errors.append("CANONICAL_EXACT_TABLE_SET")
    exact_handler_ids = {
        row.get("handlerId")
        for row in exact.get("internalConsumerHandlers", [])
        if isinstance(row, dict)
        and row.get("capabilityId") == "HRIS.MODERN.EMPLOYEE_LISTENING"
    }
    if exact_handler_ids != OWNER_LOCAL_HANDLER_IDS:
        errors.append("CANONICAL_EXACT_HANDLER_SET")
    for row in exact.get("operationBindings", []):
        operation_id = row.get("operationId")
        if operation_id in PUBLIC_OPERATIONS and set(row.get("eventNames", [])) - PUBLIC_EVENTS:
            errors.append(f"CANONICAL_EXACT_EVENT_SET:{operation_id}")

    events = documents["eventPayloads"]
    event_names = {
        row.get("eventName")
        for row in events.get("eventPayloadSchemas", [])
        if row.get("eventName") in PUBLIC_EVENTS
    }
    if event_names != PUBLIC_EVENTS:
        errors.append("CANONICAL_EVENT_SET")
    event_blob = json.dumps(events, ensure_ascii=False, sort_keys=True)
    for name in INTERNAL_MESSAGES:
        if name not in event_blob:
            errors.append(f"CANONICAL_EVENT_INTERNAL_MESSAGE:{name}")
    event_handler_ids = {
        row.get("handlerId")
        for row in events.get("internalEventHandlers", [])
        if isinstance(row, dict)
        and row.get("handlerId") in OWNER_LOCAL_HANDLER_IDS
    }
    expected_event_handlers = {
        item[0] for item in INTERNAL_HANDLER_BY_MESSAGE.values()
    }
    if event_handler_ids != expected_event_handlers:
        errors.append("CANONICAL_EVENT_INTERNAL_HANDLER_SET")


def expected_authoritative_inputs(
    root: Path, errors: list[str]
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    documents: dict[str, dict[str, Any]] = {}
    raw_by_role: dict[str, bytes] = {}
    for role, relative, id_key, expected_id in CANONICAL_INPUTS:
        path = root / relative
        if not path.is_file() or path.is_symlink():
            errors.append(f"CANONICAL_INPUT_FILE:{role}")
            continue
        try:
            document = load_canonical_input_strict(path)
        except Exception as exc:
            errors.append(f"CANONICAL_INPUT_LOAD:{role}:{type(exc).__name__}")
            continue
        if document.get(id_key) != expected_id:
            errors.append(f"CANONICAL_INPUT_ID:{role}")
        documents[role] = document
        raw_by_role[role] = path.read_bytes()
    validate_canonical_input_documents(documents, errors)
    if set(documents) != {item[0] for item in CANONICAL_INPUTS}:
        return rows
    for role, relative, id_key, _expected_id in CANONICAL_INPUTS:
        document = documents[role]
        raw = raw_by_role[role]
        subset = canonical_subset_independent(role, document)
        subset_bytes = json.dumps(
            subset, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
        rows.append({
            "role": role,
            "path": relative,
            "documentId": document[id_key],
            "fileSha256": sha256_bytes(raw),
            "byteCount": len(raw),
            "listeningSubsetCounts": independent_subset_counts(subset),
            "listeningSubsetSha256": sha256_bytes(subset_bytes),
            "precedence": "PRIMARY_CANONICAL_INPUT",
        })
    return rows


def validate_contract(
    doc: dict[str, Any],
    root: Path,
    *,
    check_files: bool,
    check_consumers: bool | None = None,
) -> list[str]:
    errors: list[str] = []

    def need(condition: bool, code: str) -> None:
        if not condition:
            errors.append(code)

    need(doc.get("contractId") == CONTRACT_ID, "CONTRACT_ID")
    need(doc.get("schemaVersion") == 1 and type(doc.get("schemaVersion")) is int, "SCHEMA_VERSION")
    need(doc.get("status") == "CANONICAL_G3_START_AUTHORITY_NOT_IMPLEMENTED", "STATUS")
    need(doc.get("ownerSession") == "HRIS-SYS", "OWNER_SESSION")
    need(doc.get("sessionTopology") == "FIVE_SESSIONS_UNCHANGED_HRM_PER_PAY_TIM_SYS", "FIVE_SESSION_TOPOLOGY")
    seal = doc.get("sealedPayloadSha256")
    need(isinstance(seal, str) and bool(SHA256_RE.fullmatch(seal)), "SEAL_SHAPE")
    need(seal == sha256_bytes(canonical_payload(doc)), "SEAL_DIGEST")

    precedence = doc.get("canonicalPrecedence", {})
    need(
        precedence.get("mode")
        == "CANONICAL_FIVE_PRIMARY_DERIVED_SUMMARY_ONLY",
        "PRECEDENCE_MODE",
    )
    need(precedence.get("supersedesCapability") == "HRIS.MODERN.EMPLOYEE_LISTENING", "PRECEDENCE_CAPABILITY")
    need(precedence.get("legacyDirectImplementation") == "FORBIDDEN", "LEGACY_DIRECT_IMPLEMENTATION")
    need(
        precedence.get("legacyArtifactRole")
        == "HISTORICAL_TRACE_ONLY_WHEN_SEPARATELY_FROZEN",
        "LEGACY_ARTIFACT_ROLE",
    )
    need(precedence.get("forbiddenLegacyPublicEvent") == "EmployeeListeningResponseSubmitted.v2", "LEGACY_RESPONSE_EVENT")
    need(precedence.get("forbiddenLegacyMigration") == "dwp-platform-server/src/main/resources/db/migration/V287__hris_platform_modern_employee_listening.sql", "LEGACY_V287_MARKER")
    need("predecessorPins" not in precedence, "MUTABLE_PREDECESSOR_PINS_FORBIDDEN")
    need("historicalPredecessor" not in precedence, "VIRTUAL_HISTORICAL_PREDECESSOR")
    need(
        precedence.get("reverseReferenceFromCanonicalFiveAllowed") is False,
        "REVERSE_REFERENCE_POLICY",
    )
    inputs = precedence.get("authoritativeInputs", [])
    expected_roles = [item[0] for item in CANONICAL_INPUTS]
    expected_paths = [item[1] for item in CANONICAL_INPUTS]
    need(
        isinstance(inputs, list)
        and len(inputs) == 5
        and [row.get("role") for row in inputs if isinstance(row, dict)]
        == expected_roles,
        "AUTHORITATIVE_INPUT_ROLE_ORDER",
    )
    need(
        isinstance(inputs, list)
        and [row.get("path") for row in inputs if isinstance(row, dict)]
        == expected_paths,
        "AUTHORITATIVE_INPUT_PATH_ORDER",
    )
    for row in inputs if isinstance(inputs, list) else []:
        need(row.get("precedence") == "PRIMARY_CANONICAL_INPUT", "AUTHORITATIVE_INPUT_PRECEDENCE")
        need(bool(SHA256_RE.fullmatch(str(row.get("fileSha256", "")))), "AUTHORITATIVE_INPUT_FILE_HASH")
        need(type(row.get("byteCount")) is int and row.get("byteCount", 0) > 0, "AUTHORITATIVE_INPUT_BYTE_COUNT")
        need(bool(SHA256_RE.fullmatch(str(row.get("listeningSubsetSha256", "")))), "AUTHORITATIVE_INPUT_SUBSET_HASH")
        need(isinstance(row.get("listeningSubsetCounts"), dict), "AUTHORITATIVE_INPUT_SUBSET_COUNTS")
    if check_files:
        expected_inputs = expected_authoritative_inputs(root, errors)
        need(inputs == expected_inputs, "AUTHORITATIVE_INPUT_CURRENT_BYTES_OR_SUBSET")

    generated = precedence.get("generatedSummary", {})
    need(generated.get("sourceDesignId") == DESIGN_ID, "STATIC_DESIGN_ID")
    need(
        generated.get("sourceDesignSha256") == EXPECTED_STATIC_DESIGN_DIGEST,
        "STATIC_DESIGN_DIGEST",
    )
    need(generated.get("canonicalInputCount") == 5, "CANONICAL_INPUT_COUNT")
    expected_input_set_sha = sha256_bytes(json.dumps(
        inputs if isinstance(inputs, list) else [],
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8"))
    need(
        generated.get("canonicalInputSetSha256") == expected_input_set_sha,
        "CANONICAL_INPUT_SET_DIGEST",
    )
    need(
        generated.get("activePrecedence")
        == "CANONICAL_FIVE_ROWS_THEN_DERIVED_SUMMARY",
        "ACTIVE_PRECEDENCE",
    )

    stream_rows = doc.get("authorityStreams", [])
    by_stream = {item.get("streamKey"): item for item in stream_rows if isinstance(item, dict)}
    need(len(by_stream) == len(stream_rows) == 4 and set(by_stream) == set(STREAMS), "STREAM_SET")
    schemas: list[str] = []
    histories: list[str] = []
    locations: list[str] = []
    migration_principals: list[str] = []
    runtime_principals: list[str] = []
    runtime_purposes: list[str] = []
    for key, expected in STREAMS.items():
        row = by_stream.get(key, {})
        service, context, schema, history, location, allocation, ownership = expected
        need(row.get("ownerService") == service, f"STREAM_SERVICE:{key}")
        need(row.get("boundedContext") == context, f"STREAM_CONTEXT:{key}")
        need(row.get("databaseSchema") == schema, f"STREAM_SCHEMA:{key}")
        need(row.get("historyTable") == history, f"STREAM_HISTORY:{key}")
        need(row.get("migrationLocation") == location, f"STREAM_LOCATION:{key}")
        need(row.get("migrationAllocationId") == allocation, f"STREAM_MIGRATION_ALLOCATION:{key}")
        need(row.get("migrationOwnershipId") == ownership, f"STREAM_MIGRATION_OWNERSHIP:{key}")
        need(row.get("migrationRange") == {"baselineHighWater": 0, "start": 1, "end": 40}, f"STREAM_RANGE:{key}")
        need(row.get("crossSchemaForeignKeysAllowed") is False, f"STREAM_CROSS_SCHEMA_FK:{key}")
        need(row.get("foreignLocalIdsAllowed") is False, f"STREAM_FOREIGN_LOCAL_ID:{key}")
        need(row.get("foreignRepositoryImportsAllowed") is False, f"STREAM_FOREIGN_REPOSITORY:{key}")
        need(row.get("applicationDdlAllowed") is False, f"STREAM_APP_DDL:{key}")
        need(row.get("implementationState") == "NOT_STARTED_G3", f"STREAM_IMPLEMENTATION:{key}")
        need(row.get("controlBootstrapAllocationId") == {
            "platform-hris-configuration": "G3-CTL-SYS-LISTEN-CONFIGURATION-STREAM",
            "platform-hris-listening-protected": "G3-CTL-SYS-LISTEN-PROTECTED-STREAM",
            "platform-hris-insights": "G3-CTL-SYS-LISTEN-INSIGHTS-STREAM",
            "auth-hris-participation-issuer": "G3-CTL-SYS-LISTEN-ISSUER-STREAM",
        }[key], f"STREAM_CONTROL_BOOTSTRAP:{key}")
        schemas.append(str(row.get("databaseSchema")))
        histories.append(str(row.get("historyTable")))
        locations.append(str(row.get("migrationLocation")))
        migration_principals.append(str(row.get("migrationPrincipal")))
        principals = row.get("runtimePrincipals", [])
        need(isinstance(principals, list) and len(principals) == (2 if key == "platform-hris-insights" else 1), f"RUNTIME_PRINCIPAL_COUNT:{key}")
        for principal in principals if isinstance(principals, list) else []:
            runtime_principals.append(str(principal.get("principal")))
            runtime_purposes.append(str(principal.get("purpose")))
            need(principal.get("objectPolicy"), f"RUNTIME_OBJECT_POLICY:{key}")
    need(len(set(schemas)) == 4, "SHARED_SCHEMA")
    need(len(set(histories)) == 4, "SHARED_HISTORY")
    need(len(set(locations)) == 4, "SHARED_MIGRATION_LOCATION")
    need(len(set(migration_principals)) == 4, "SHARED_MIGRATION_PRINCIPAL")
    need(len(set(runtime_principals)) == 5, "SHARED_RUNTIME_PRINCIPAL")
    need(len(set(runtime_purposes)) == 5, "SHARED_RUNTIME_PURPOSE")
    need(set(row.get("ownerService") for row in stream_rows if isinstance(row, dict)) == {"dwp-platform-server", "dwp-auth-server"}, "BOTH_SERVICE_BINDING")

    ops = doc.get("publicOperationBindings", [])
    by_op = {item.get("operationId"): item for item in ops if isinstance(item, dict)}
    need(len(by_op) == len(ops) == len(PUBLIC_OPERATIONS) and set(by_op) == set(PUBLIC_OPERATIONS), "PUBLIC_OPERATION_SET")
    for op_id, stream_key in PUBLIC_OPERATIONS.items():
        row = by_op.get(op_id, {})
        need(row.get("authoritativeStreamKey") == stream_key, f"OPERATION_STREAM:{op_id}")
        need(row.get("ownerPortOperation") in OWNER_PORTS, f"OPERATION_PORT:{op_id}")
        need(row.get("crossDatabaseTransactionClaimAllowed") is False, f"OPERATION_CROSS_DB_ATOMIC:{op_id}")
        need(row.get("foreignRepositoryReadAllowed") is False, f"OPERATION_FOREIGN_REPOSITORY:{op_id}")
        need(row.get("foreignLocalIdAllowed") is False, f"OPERATION_FOREIGN_LOCAL_ID:{op_id}")
    for op_id in ("modern.listening.survey.publish", "modern.listening.survey.close"):
        need(by_op.get(op_id, {}).get("resultUnknownRefetchRequired") is True, f"RESULT_UNKNOWN_REFETCH:{op_id}")
    admin_query = by_op.get("modern.listening.surveys.query", {})
    need(
        admin_query.get("requestContract")
        == {
            "surveyId": "OPTIONAL_EXACT_PUBLIC_UUID",
            "status": "OPTIONAL_DRAFT_PUBLISHED_CLOSED",
            "period": "OPTIONAL_FROM_TO_TIMESTAMPTZ_HALF_OPEN",
            "cursor": "OPTIONAL_SCOPE_BOUND_OPAQUE_CURSOR",
            "limit": "OPTIONAL_INTEGER_1_200_DEFAULT_50",
        }
        and admin_query.get("responseSchemaId")
        == "EmployeeListeningSurveyAdministrationPage.v1"
        and admin_query.get("recordSchemaId")
        == "EmployeeListeningSurveyAdministrationRecord.v1",
        "ADMIN_SURVEY_REENTRY_QUERY",
    )

    ports = doc.get("ownerPortOperations", [])
    by_port = {item.get("ownerPortOperation"): item for item in ports if isinstance(item, dict)}
    need(len(by_port) == len(ports) == len(OWNER_PORTS) and set(by_port) == set(OWNER_PORTS), "OWNER_PORT_SET")
    for name, stream_key in OWNER_PORTS.items():
        need(by_port.get(name, {}).get("streamKey") == stream_key, f"OWNER_PORT_STREAM:{name}")
        need(by_port.get(name, {}).get("contractState") == "G3_INTERFACE_REQUIRED_NOT_IMPLEMENTED", f"OWNER_PORT_STATE:{name}")
    handlers = doc.get("ownerLocalHandlers", [])
    need(
        len(handlers) == 1
        and handlers[0].get("handlerId") == OWNER_LOCAL_ERASURE_HANDLER
        and handlers[0].get("streamKey")
        == "platform-hris-listening-protected"
        and handlers[0].get("stableReplayReceiptRequired") is True
        and handlers[0].get("publicEventEmission")
        == "FORBIDDEN_RAW_OR_IDENTITY_LINKABLE"
        and set(handlers[0].get("responseMutableStatusForbidden", []))
        == {"WITHDRAWN", "ANONYMIZED"},
        "OWNER_LOCAL_ERASURE_HANDLER",
    )
    revise = by_op.get("modern.listening.survey.revise", {})
    need(
        revise.get("publicPath")
        == "PATCH /api/platform/v1/admin/hris/listening/surveys/{surveyId}"
        and revise.get("ownerPortOperation") == "configuration.reviseSurvey"
        and revise.get("transactionBoundary")
        == "CONFIGURATION_DRAFT_CAS_REVISION_TRANSACTION"
        and revise.get("requestSchemaId")
        == "EmployeeListeningSurveyRevisionCommand.v1"
        and revise.get("responseSchemaId")
        == "EmployeeListeningSurveyRevisionResult.v1"
        and revise.get("stateContract")
        == "DRAFT_TO_DRAFT_EXPECTED_AGGREGATE_VERSION_CAS"
        and revise.get("serverVersionRule")
        == "INCREMENT_EXACTLY_ONE_AFTER_STRUCTURED_REVISION",
        "SURVEY_REVISE_CAS_CONTRACT",
    )

    tables = doc.get("tableOwnership", [])
    by_table = {item.get("tableName"): item for item in tables if isinstance(item, dict)}
    expected_tables = set().union(*TABLES_BY_STREAM.values())
    need(
        len(by_table) == len(tables) == len(expected_tables)
        and set(by_table) == expected_tables,
        "TABLE_SET",
    )
    owner_by_table = {name: stream_key for stream_key, names in TABLES_BY_STREAM.items() for name in names}
    for name, stream_key in owner_by_table.items():
        row = by_table.get(name, {})
        need(row.get("streamKey") == stream_key, f"TABLE_STREAM:{name}")
        need(row.get("crossSchemaForeignKeys") == [], f"TABLE_CROSS_SCHEMA_FK:{name}")
        need(row.get("foreignLocalIdColumns") == [], f"TABLE_FOREIGN_LOCAL_ID:{name}")
        need(row.get("implementationState") == "NOT_STARTED_G4", f"TABLE_IMPLEMENTATION:{name}")
        for foreign_key in row.get("localForeignKeys", []):
            target = foreign_key.get("targetTable")
            need(owner_by_table.get(target) == stream_key, f"FK_STREAM:{name}->{target}")
            need(foreign_key.get("mode") == "TENANT_LOCAL_COMPOSITE_FK", f"FK_MODE:{name}->{target}")
    response = by_table.get("sys_hris_listening_responses", {})
    response_targets = {item.get("targetTable") for item in response.get("localForeignKeys", [])}
    need(response_targets == {"sys_hris_listening_admission_versions"}, "RESPONSE_PARENT_MUST_BE_PROTECTED_ADMISSION")
    need("listening_survey_id" not in json.dumps(response, sort_keys=True), "RESPONSE_CONFIGURATION_LOCAL_ID")

    events = doc.get("eventOwnership", {})
    public = events.get("canonicalPublicEvents", [])
    public_names = {item.get("eventName") for item in public if isinstance(item, dict)}
    need(
        len(public_names) == len(public) == len(PUBLIC_EVENTS)
        and public_names == PUBLIC_EVENTS,
        "PUBLIC_EVENT_SET",
    )
    need("EmployeeListeningResponseSubmitted.v2" not in public_names, "RAW_RESPONSE_PUBLIC_EVENT")
    internal = events.get("internalPortMessages", [])
    internal_names = {item.get("messageName") for item in internal if isinstance(item, dict)}
    need(
        len(internal_names) == len(internal) == len(INTERNAL_MESSAGES)
        and internal_names == INTERNAL_MESSAGES,
        "INTERNAL_MESSAGE_SET",
    )
    forbidden_fields = {str(item).lower() for item in events.get("forbiddenPublicFieldPatterns", [])}
    need({"responseid", "responsetoken", "token", "tokencommitment", "answer", "answers"} <= forbidden_fields, "FORBIDDEN_PUBLIC_FIELDS")
    public_blob = json.dumps(public, sort_keys=True).lower()
    for token in ("responseid", "responsetoken", "tokencommitment", "answers", "workerid", "employeeid"):
        need(token not in public_blob, f"PUBLIC_EVENT_LEAK:{token}")
    forbidden_publications = set(events.get("publicBrokerForbidden", []))
    need("EmployeeListeningResponseSubmitted.v2" in forbidden_publications, "RESPONSE_EVENT_NOT_FORBIDDEN")
    need("PARTICIPATION_TOKEN_EVENT" in forbidden_publications, "TOKEN_EVENT_NOT_FORBIDDEN")

    identity = doc.get("publicIdentityAndSemanticOverlay", {})
    need(identity.get("externalIdentity") == "UUID_PUBLIC_ID_ONLY", "PUBLIC_IDENTITY")
    need(identity.get("localIdentity") == "BIGINT_STREAM_LOCAL_NEVER_TRANSPORTED_ACROSS_STREAM", "LOCAL_IDENTITY")
    need("admission_versions" in str(identity.get("protectedResponseParent")), "SEMANTIC_RESPONSE_PARENT")
    need(
        identity.get("semanticRegistryMode")
        == "CANONICAL_FIVE_ROWS_ARE_PRIMARY_THIS_SUMMARY_IS_DERIVED",
        "SEMANTIC_PRECEDENCE",
    )

    migrations = doc.get("migrationReservations", [])
    by_migration = {item.get("streamKey"): item for item in migrations if isinstance(item, dict)}
    need(len(by_migration) == len(migrations) == 4 and set(by_migration) == set(STREAMS), "MIGRATION_SET")
    migration_blob = json.dumps(migrations, sort_keys=True)
    need("V287__hris_platform_modern_employee_listening.sql" not in migration_blob, "SINGLE_V287_REMAINS")
    for key, expected in STREAMS.items():
        row = by_migration.get(key, {})
        need(row.get("allocationId") == expected[5], f"MIGRATION_ALLOCATION:{key}")
        need(row.get("ownershipId") == expected[6], f"MIGRATION_OWNER:{key}")
        need(row.get("migrationLocation") == expected[4], f"MIGRATION_LOCATION:{key}")
        need(row.get("databaseSchema") == expected[2], f"MIGRATION_SCHEMA:{key}")
        need(row.get("historyTable") == expected[3], f"MIGRATION_HISTORY:{key}")
        need(row.get("range") == {"baselineHighWater": 0, "start": 1, "end": 40}, f"MIGRATION_RANGE:{key}")
        need(str(row.get("firstReservedMigration", "")).startswith("V1__hris_listening_"), f"FIRST_MIGRATION:{key}")
        need(row.get("state") == "RESERVED_G3_RANGE_NOT_CREATED", f"MIGRATION_STATE:{key}")

    profiles = doc.get("verificationProfileBindings", [])
    profile_ids = {item.get("profileId") for item in profiles if isinstance(item, dict)}
    need(len(profile_ids) == len(profiles) == 5 and profile_ids == PROFILE_IDS, "PROFILE_SET")
    need(all(item.get("state") == "CONTROL_CATALOG_BINDING_REQUIRED" for item in profiles if isinstance(item, dict)), "PROFILE_STATE")

    dependencies = doc.get("capabilityDependencies", {})
    need(set(dependencies.get("HRIS.MODERN.EMPLOYEE_LISTENING", [])) == set(STREAMS), "LISTENING_DEPENDENCY_SET")
    need(set(dependencies.get("HRIS.MODERN.PEOPLE_ANALYTICS", [])) == {"platform-hris-configuration", "platform-hris-insights"}, "ANALYTICS_DEPENDENCY_SET")
    need(set(dependencies.get("HRIS.MODERN.GOVERNED_AI", [])) == {"platform-hris-configuration", "platform-hris-insights"}, "AI_DEPENDENCY_SET")
    need(dependencies.get("protectedIssuerPairRequired") is True, "PROTECTED_ISSUER_PAIR")

    tx = doc.get("transactionAndIdempotency", {})
    need("RESULT_UNKNOWN" in str(tx.get("publish")) and "REFETCH" in str(tx.get("publish")), "PUBLISH_RESULT_UNKNOWN")
    need("REFETCH" in str(tx.get("close")) and "FENCE" in str(tx.get("close")), "CLOSE_FENCE_REFETCH")
    need(tx.get("crossDatabaseAtomicityClaim") == "FORBIDDEN", "CROSS_DB_ATOMICITY")
    need(tx.get("ownerLocalOutboxInboxHistory") == "REQUIRED_PER_STREAM_NO_SHARED_RECEIPT_TABLE", "LOCAL_INFRASTRUCTURE")

    assurance = doc.get("assurance", {})
    need(assurance.get("canonicalDesignPublished") is True, "DESIGN_PUBLISHED")
    need(assurance.get("runtimeImplemented") is False, "RUNTIME_IMPLEMENTATION_CLAIM")
    need(assurance.get("userJourneyCrud") == "NOT_STARTED_G3_G4", "USER_JOURNEY_STATE")
    need(assurance.get("databaseObjectsCreated") is False, "DATABASE_CREATION_CLAIM")
    need(assurance.get("globalGateAuthorization") == "NONE_FROM_THIS_CONTRACT", "GLOBAL_GATE_CLAIM")
    need(assurance.get("productionAuthorized") is False, "PRODUCTION_CLAIM")
    need(assurance.get("realIdentityAndProcessIsolation") == "G6_ONLY_NOT_CLAIMED", "G6_BOUNDARY")
    need(assurance.get("benskIncluded") is False and assurance.get("addskIncluded") is False, "EXCLUDED_PRODUCTS")

    counts = doc.get("exactCounts", {})
    actual_counts = {
        "streams": len(by_stream),
        "ownerServices": len({item.get("ownerService") for item in stream_rows if isinstance(item, dict)}),
        "runtimePurposes": len(runtime_purposes),
        "publicOperations": len(by_op),
        "ownerPortOperations": len(by_port),
        "ownerLocalHandlers": len(handlers),
        "plannedTables": len(by_table),
        "canonicalPublicEvents": len(public_names),
        "internalPortMessages": len(internal_names),
        "privateReceiptTypes": len(events.get("privateReceiptOnly", [])),
        "migrationReservations": len(by_migration),
        "streamFileAllocationTriples": len(doc.get("fileAllocations", [])),
        "verificationProfiles": len(profile_ids),
    }
    need(counts == actual_counts, "EXACT_COUNTS")

    if check_consumers if check_consumers is not None else check_files:
        validate_consumers(doc, root, errors)
    return errors


def validate_consumers(doc: dict[str, Any], root: Path, errors: list[str]) -> None:
    def need(condition: bool, code: str) -> None:
        if not condition:
            errors.append(code)

    consumers = doc.get("requiredCanonicalConsumers", [])
    need(len(consumers) == len(set(consumers)) == 16, "CONSUMER_SET")
    structured_precedence_consumers = {
        "coding-readiness/sys-exact-business-start-pin.v1.json",
        "g0/file-ownership-register.csv",
        "g0/migration-stream-register.csv",
    }
    for relative in consumers:
        path = root / relative
        need(path.is_file() and not path.is_symlink(), f"CONSUMER_FILE:{relative}")
        if path.is_file() and not path.is_symlink() and relative not in structured_precedence_consumers:
            need(CONTRACT_ID in path.read_text(encoding="utf-8"), f"CONSUMER_PRECEDENCE:{relative}")

    physical = {row.get("binding_id"): row for row in read_csv(root / "coding-readiness/physical-owner-prefix-register.csv")}
    expected_physical = {
        "PFX-SYS-LISTEN-CONFIGURATION": ("dwp-platform-server", "DWP_PLATFORM_HRIS_CONFIGURATION", "hris_configuration"),
        "PFX-SYS-LISTEN-PROTECTED": ("dwp-platform-server", "DWP_PLATFORM_HRIS_LISTENING_PROTECTED", "hris_listening_protected"),
        "PFX-SYS-LISTEN-INSIGHTS": ("dwp-platform-server", "DWP_PLATFORM_HRIS_INSIGHTS", "hris_insights"),
        "PFX-SYS-LISTEN-ISSUER": ("dwp-auth-server", "DWP_AUTH_HRIS_PARTICIPATION_ISSUER", "hris_participation_issuer"),
    }
    for binding, expected in expected_physical.items():
        row = physical.get(binding, {})
        need((row.get("owner_service"), row.get("bounded_context"), row.get("database_schema")) == expected, f"PHYSICAL_OWNER:{binding}")
        need(row.get("status") == "READY_FOR_G3_CODE", f"PHYSICAL_OWNER_STATE:{binding}")
        need(CONTRACT_ID in row.get("cross_boundary_rule", ""), f"PHYSICAL_OWNER_PRECEDENCE:{binding}")

    module_rows = {row.get("session_id"): row for row in read_csv(root / "coding-readiness/module-structure-contract-register.csv")}
    sys_module = module_rows.get("HRIS-SYS", {})
    for stream_row in doc.get("authorityStreams", []):
        need(stream_row.get("sourceRoot") in pipe(sys_module.get("backend_source_roots")), f"MODULE_SOURCE:{stream_row.get('streamKey')}")
        need(stream_row.get("testRoot") in pipe(sys_module.get("backend_test_roots")), f"MODULE_TEST:{stream_row.get('streamKey')}")
    need(CONTRACT_ID in sys_module.get("backend_forbidden_dependencies", ""), "MODULE_PRECEDENCE")

    coding_rows = {row.get("capability_id"): row for row in read_csv(root / "coding-readiness/modern-capability-coding-contract-register.csv")}
    listening = coding_rows.get("HRIS.MODERN.EMPLOYEE_LISTENING", {})
    need(set(STREAMS) == pipe(listening.get("bounded_context")), "CODING_STREAM_BINDING")
    need({"dwp-platform-server", "dwp-auth-server"} == pipe(listening.get("runtime_owner")), "CODING_SERVICE_BINDING")
    expected_coding_migrations = {
        item["migrationLocation"] + "/" + item["firstReservedMigration"]
        for item in doc.get("authorityStreams", [])
    }
    need(expected_coding_migrations == pipe(listening.get("migration_file")), "CODING_MIGRATION_BINDING")
    need(CONTRACT_ID in listening.get("contract_ref", ""), "CODING_PRECEDENCE")

    trace_rows = {row.get("capability_id"): row for row in read_csv(root / "coding-readiness/modern-capability-trace-register.csv")}
    trace = trace_rows.get("HRIS.MODERN.EMPLOYEE_LISTENING", {})
    need(CONTRACT_ID in trace.get("data_contracts", ""), "TRACE_PRECEDENCE")
    need("EmployeeListeningResponseSubmitted.v2" not in pipe(trace.get("api_event_contracts")), "TRACE_LEGACY_RESPONSE_EVENT")
    need(PUBLIC_EVENTS <= pipe(trace.get("api_event_contracts")), "TRACE_PUBLIC_EVENTS")

    slices = {row.get("slice_id"): row for row in read_csv(root / "coding-readiness/g3-slice-code-go-register.csv")}
    slice_row = slices.get("MOD-SYS-LISTEN", {})
    need(set(STREAMS) == pipe(slice_row.get("bounded_context_refs")), "SLICE_STREAM_BINDING")
    need(set(item[5] for item in STREAMS.values()) == pipe(slice_row.get("migration_allocation_ids")), "SLICE_MIGRATION_BINDING")
    need("V287__hris_platform_modern_employee_listening.sql" not in slice_row.get("planned_migration_file", ""), "SLICE_SINGLE_V287")
    need(CONTRACT_ID in slice_row.get("schema_state_contract_refs", ""), "SLICE_PRECEDENCE")
    need("EmployeeListeningResponseSubmitted.v2" not in pipe(slice_row.get("primary_contract_refs")), "SLICE_LEGACY_RESPONSE_EVENT")
    required_file_allocations = {
        item[key]
        for item in doc.get("fileAllocations", [])
        for key in ("sourceAllocationId", "testAllocationId", "migrationAllocationId")
    } | {"G3-SYS-FE-SOURCE"}
    need(required_file_allocations == pipe(slice_row.get("file_allocation_ids")), "SLICE_FILE_ALLOCATIONS")

    file_allocations = {row.get("allocation_id"): row for row in read_csv(root / "coding-readiness/g3-file-allocation-register.csv")}
    for item in doc.get("fileAllocations", []):
        for key, expected_path in (
            ("sourceAllocationId", item.get("sourceRoot")),
            ("testAllocationId", item.get("testRoot")),
            ("migrationAllocationId", item.get("migrationLocation") + "/V{1..40}__hris_listening_<slice>.sql"),
        ):
            row = file_allocations.get(item.get(key), {})
            need(row.get("session_id") == "HRIS-SYS", f"FILE_ALLOCATION_SESSION:{item.get(key)}")
            accepted_paths = {expected_path}
            if key in {"sourceAllocationId", "testAllocationId"}:
                accepted_paths.add(expected_path.rstrip("/") + "/**")
            need(
                bool(accepted_paths & pipe(row.get("path_globs"))),
                f"FILE_ALLOCATION_PATH:{item.get(key)}",
            )
            need(CONTRACT_ID in row.get("scope_boundary", ""), f"FILE_ALLOCATION_PRECEDENCE:{item.get(key)}")
        bootstrap_id = next(
            stream["controlBootstrapAllocationId"]
            for stream in doc.get("authorityStreams", [])
            if stream.get("streamKey") == item.get("streamKey")
        )
        bootstrap = file_allocations.get(bootstrap_id, {})
        need(bootstrap.get("session_id") == "CONTROL" and bootstrap.get("repository") == "DWP_BACKEND", f"CONTROL_BOOTSTRAP:{bootstrap_id}")
        need(CONTRACT_ID in bootstrap.get("scope_boundary", ""), f"CONTROL_BOOTSTRAP_PRECEDENCE:{bootstrap_id}")

    migration_rows = {row.get("allocation_id"): row for row in read_csv(root / "g0/migration-allocation-register.csv") if row.get("allocation_id")}
    stream_register = {row.get("migration_allocation_id"): row for row in read_csv(root / "g0/migration-stream-register.csv")}
    ownership = {row.get("ownership_id"): row for row in read_csv(root / "g0/file-ownership-register.csv")}
    for key, expected in STREAMS.items():
        service, _context, schema, history, location, allocation_id, ownership_id = expected
        allocation = migration_rows.get(allocation_id, {})
        need(allocation.get("service") == service and allocation.get("migration_dir") == location, f"G0_MIGRATION_ALLOCATION:{key}")
        need(allocation.get("allocated_version") == "1-40" and allocation.get("state") == "RESERVED_G3_RANGE", f"G0_MIGRATION_RANGE:{key}")
        need(CONTRACT_ID in allocation.get("vertical_slice", ""), f"G0_MIGRATION_PRECEDENCE:{key}")
        stream_row = stream_register.get(allocation_id, {})
        need(stream_row.get("database_schema") == schema and stream_row.get("history_table") == history, f"G0_STREAM:{key}")
        need(stream_row.get("cross_stream_fk_allowed") == "NO", f"G0_STREAM_FK:{key}")
        expected_bootstrap = next(
            item.get("controlBootstrapAllocationId")
            for item in doc.get("authorityStreams", [])
            if item.get("streamKey") == key
        )
        need(stream_row.get("bootstrap_allocation_id") == expected_bootstrap, f"G0_STREAM_BOOTSTRAP:{key}")
        owner = ownership.get(ownership_id, {})
        need(owner.get("session_id") == "HRIS-SYS" and owner.get("repository") == "DWP_BACKEND", f"G0_OWNERSHIP:{key}")
        need(owner.get("path_glob") == location + "/V{1..40}__hris_listening_<slice>.sql", f"G0_OWNERSHIP_PATH:{key}")

    exact_pin = json.loads((root / "coding-readiness/sys-exact-business-start-pin.v1.json").read_text(encoding="utf-8"))
    pinned = {row.get("path"): row for row in exact_pin.get("artifactPins", [])}
    authority_pin = pinned.get("coding-readiness/sys-listening-stream-authority-successor.v1.json", {})
    authority_bytes = (root / "coding-readiness/sys-listening-stream-authority-successor.v1.json").read_bytes()
    need(
        authority_pin.get("sha256") == sha256_bytes(authority_bytes)
        and authority_pin.get("byteCount") == len(authority_bytes)
        and authority_pin.get("role") == "DERIVED_LISTENING_SUMMARY",
        "SYS_EXACT_PIN_LISTENING_SUMMARY",
    )

    successor = json.loads((root / "coding-readiness/sys-exact-business-start-successor.v1.json").read_text(encoding="utf-8"))
    need(successor.get("authoritativeSources", {}).get("sysListeningDerivedSummary") == "coding-readiness/sys-listening-stream-authority-successor.v1.json", "SYS_SUCCESSOR_DERIVED_SUMMARY")
    sys_slice = next((row for row in successor.get("sliceBindings", []) if row.get("assuranceSliceId") == "MOD-SYS-LISTEN"), {})
    need(
        sys_slice.get("canonicalAuthorityMode")
        == "PRIMARY_CANONICAL_FIVE_ROWS"
        and sys_slice.get("derivedSummaryRef") == CONTRACT_ID
        and sys_slice.get("derivedSummaryPath")
        == "coding-readiness/sys-listening-stream-authority-successor.v1.json"
        and sys_slice.get("derivedSummaryFileSha256")
        == sha256_bytes(authority_bytes)
        and sys_slice.get("derivedSummaryCanonicalInputSetSha256")
        == doc.get("canonicalPrecedence", {}).get(
            "generatedSummary", {}
        ).get("canonicalInputSetSha256"),
        "SYS_SUCCESSOR_SLICE_DERIVED_SUMMARY",
    )
    need(set(sys_slice.get("streamKeys", [])) == set(STREAMS), "SYS_SUCCESSOR_STREAMS")
    need(set(sys_slice.get("runtimeOwners", [])) == {"dwp-platform-server", "dwp-auth-server"}, "SYS_SUCCESSOR_SERVICES")

    authority_path = root / "coding-readiness/sys-listening-stream-authority-successor.v1.json"
    authority_hash = sha256_bytes(authority_path.read_bytes())
    authority_seal = doc.get("sealedPayloadSha256")
    causal = json.loads((root / "coding-readiness/modern-capability-causal-state-contracts.v2.json").read_text(encoding="utf-8"))
    causal_ref = causal.get("canonicalDerivedSummaries", {}).get(
        "sysListeningStreamSummary", {}
    )
    need(
        causal_ref.get("contractId") == CONTRACT_ID
        and causal_ref.get("path") == authority_path.name
        and causal_ref.get("fileSha256") == authority_hash
        and causal_ref.get("sealedPayloadSha256") == authority_seal
        and causal_ref.get("canonicalInputSetSha256")
        == doc.get("canonicalPrecedence", {}).get("generatedSummary", {}).get(
            "canonicalInputSetSha256"
        )
        and causal_ref.get("authorityMode")
        == "DERIVED_SUMMARY_OF_CANONICAL_FIVE"
        and causal_ref.get("canonicalRowsRole")
        == "PRIMARY_ACTIVE_IMPLEMENTATION_AUTHORITY",
        "CAUSAL_SUCCESSOR_PRECEDENCE",
    )
    listening_causal = [
        row for row in causal.get("operations", [])
        if row.get("operationId", "").startswith("modern.listening.")
    ]
    need(
        len(listening_causal) == len(PUBLIC_OPERATIONS)
        and all(
            row.get("derivedSummaryVerification") == causal_ref
            for row in listening_causal
        ),
        "CAUSAL_LISTENING_OPERATION_PRECEDENCE",
    )
    lineage = json.loads((root / "coding-readiness/modern-capability-event-successor-lineage.v2.json").read_text(encoding="utf-8"))
    lineage_ref = lineage.get("canonicalDerivedSummaries", {}).get(
        "sysListeningStreamSummary", {}
    )
    need(
        lineage_ref.get("contractId") == CONTRACT_ID
        and lineage_ref.get("path") == authority_path.name
        and lineage_ref.get("fileSha256") == authority_hash
        and lineage_ref.get("sealedPayloadSha256") == authority_seal
        and lineage_ref.get("canonicalInputSetSha256")
        == doc.get("canonicalPrecedence", {}).get("generatedSummary", {}).get(
            "canonicalInputSetSha256"
        )
        and lineage_ref.get("authorityMode")
        == "DERIVED_SUMMARY_OF_CANONICAL_FIVE"
        and lineage_ref.get("canonicalRowsRole")
        == "PRIMARY_ACTIVE_EVENT_AUTHORITY",
        "EVENT_LINEAGE_SUCCESSOR_PRECEDENCE",
    )
    for validator_relative in (
        "coding-readiness/validate_modern_capability_contracts.py",
        "coding-readiness/validate_modern_causal_state_contracts.py",
    ):
        validator_source = (root / validator_relative).read_text(encoding="utf-8")
        need("sys-listening-stream-authority-successor.v1.json" in validator_source, f"MODERN_VALIDATOR_PRECEDENCE:{validator_relative}")

    # The gate's final endorsement verifier must independently include this
    # authority as a source pin.  The evidence writer remains Control-owned.
    endorsement_source = (root / "coding-readiness/validate_modern_causal_final_endorsement.py").read_text(encoding="utf-8")
    need("sys-listening-stream-authority-successor.v1.json" in endorsement_source, "FINAL_ENDORSEMENT_SOURCE_PIN")


def self_test(base: dict[str, Any]) -> dict[str, bool]:
    cases: list[tuple[str, Callable[[dict[str, Any]], None]]] = [
        ("missing-authority", lambda d: d["authorityStreams"].pop()),
        ("tampered-authority", lambda d: d["authorityStreams"][0].update({"ownerService": "dwp-auth-server"})),
        ("stale-authority", lambda d: d["canonicalPrecedence"]["predecessorPins"][0].update({"sha256": "0" * 64})),
        ("shared-schema", lambda d: d["authorityStreams"][1].update({"databaseSchema": d["authorityStreams"][0]["databaseSchema"]})),
        ("shared-history", lambda d: d["authorityStreams"][1].update({"historyTable": d["authorityStreams"][0]["historyTable"]})),
        ("shared-location", lambda d: d["authorityStreams"][1].update({"migrationLocation": d["authorityStreams"][0]["migrationLocation"]})),
        ("shared-runtime-role", lambda d: d["authorityStreams"][1]["runtimePrincipals"][0].update({"principal": d["authorityStreams"][0]["runtimePrincipals"][0]["principal"]})),
        ("shared-migration-role", lambda d: d["authorityStreams"][1].update({"migrationPrincipal": d["authorityStreams"][0]["migrationPrincipal"]})),
        ("response-to-configuration-local-fk", lambda d: next(row for row in d["tableOwnership"] if row["tableName"] == "sys_hris_listening_responses")["localForeignKeys"][0].update({"targetTable": "sys_hris_listening_surveys"})),
        ("response-configuration-local-id", lambda d: next(row for row in d["tableOwnership"] if row["tableName"] == "sys_hris_listening_responses").update({"foreignLocalIdColumns": ["listening_survey_id"]})),
        ("raw-response-public-event", lambda d: d["eventOwnership"]["canonicalPublicEvents"].append({"eventName": "EmployeeListeningResponseSubmitted.v2", "streamKey": "platform-hris-listening-protected", "payloadClass": "RAW"})),
        ("raw-token-public-field", lambda d: d["eventOwnership"]["canonicalPublicEvents"][0].update({"tokenCommitment": "forbidden"})),
        ("token-event-not-forbidden", lambda d: d["eventOwnership"]["publicBrokerForbidden"].remove("PARTICIPATION_TOKEN_EVENT")),
        ("missing-auth-service-binding", lambda d: d["authorityStreams"].pop()),
        ("single-v287-remains", lambda d: d["migrationReservations"][0].update({"firstReservedMigration": "V287__hris_platform_modern_employee_listening.sql"})),
        ("missing-admin-survey-reentry-query", lambda d: d["publicOperationBindings"].remove(next(row for row in d["publicOperationBindings"] if row["operationId"] == "modern.listening.surveys.query"))),
        ("admin-survey-reentry-status-widened", lambda d: next(row for row in d["publicOperationBindings"] if row["operationId"] == "modern.listening.surveys.query")["requestContract"].update({"status": "OPTIONAL_FREE_TEXT"})),
        ("missing-survey-revise", lambda d: d["publicOperationBindings"].remove(next(row for row in d["publicOperationBindings"] if row["operationId"] == "modern.listening.survey.revise"))),
        ("survey-revise-cas-widened", lambda d: next(row for row in d["publicOperationBindings"] if row["operationId"] == "modern.listening.survey.revise").update({"stateContract": "ANY_TO_DRAFT_NO_CAS"})),
        ("missing-owner-local-erasure-handler", lambda d: d["ownerLocalHandlers"].clear()),
        ("missing-erasure-request-producer", lambda d: d["ownerLocalHandlers"].remove(next(row for row in d["ownerLocalHandlers"] if row["handlerId"] == OWNER_LOCAL_ERASURE_REQUEST_HANDLER))),
        ("erasure-request-not-requested", lambda d: next(row for row in d["ownerLocalHandlers"] if row["handlerId"] == OWNER_LOCAL_ERASURE_REQUEST_HANDLER).update({"initialStatus": "CLAIMED"})),
        ("erasure-handler-raw-public-event", lambda d: next(row for row in d["ownerLocalHandlers"] if row["handlerId"] == OWNER_LOCAL_ERASURE_PROCESS_HANDLER).update({"publicEventEmission": "EmployeeListeningResponseErased.v1"})),
        ("missing-internal-message-handler", lambda d: d["ownerLocalHandlers"].remove(next(row for row in d["ownerLocalHandlers"] if row.get("messageName") == "ListeningAdmissionInstallRequested.v1"))),
        ("internal-message-handler-non-atomic", lambda d: next(row for row in d["ownerLocalHandlers"] if row.get("messageName") == "ListeningCohortPackageReady.v1").update({"transactionBoundary": "INBOX_THEN_EVENTUAL_DOMAIN"})),
        ("internal-message-handler-cross-owner-inbox", lambda d: next(row for row in d["ownerLocalHandlers"] if row.get("messageName") == "ListeningAdmissionInstallReceipt.v1").update({"inboxLedgerTable": "sys_hris_listening_protected_receipts"})),
        ("publish-fake-atomic", lambda d: next(row for row in d["publicOperationBindings"] if row["operationId"] == "modern.listening.survey.publish").update({"crossDatabaseTransactionClaimAllowed": True})),
        ("publish-no-refetch", lambda d: next(row for row in d["publicOperationBindings"] if row["operationId"] == "modern.listening.survey.publish").update({"resultUnknownRefetchRequired": False})),
        ("close-no-refetch", lambda d: next(row for row in d["publicOperationBindings"] if row["operationId"] == "modern.listening.survey.close").update({"resultUnknownRefetchRequired": False})),
        ("missing-protected-owner-port", lambda d: d["ownerPortOperations"].pop(5)),
        ("missing-erasure-request-owner-port", lambda d: d["ownerPortOperations"].remove(next(row for row in d["ownerPortOperations"] if row["ownerPortOperation"] == "protected.requestErasure"))),
        ("foreign-repository-enabled", lambda d: d["authorityStreams"][0].update({"foreignRepositoryImportsAllowed": True})),
        ("cross-schema-fk-enabled", lambda d: d["authorityStreams"][0].update({"crossSchemaForeignKeysAllowed": True})),
        ("local-fk-cross-stream", lambda d: next(row for row in d["tableOwnership"] if row["tableName"] == "sys_hris_listening_actions")["localForeignKeys"][0].update({"targetTable": "sys_hris_listening_admission_versions"})),
        ("missing-verification-profile", lambda d: d["verificationProfileBindings"].pop()),
        ("premature-runtime-claim", lambda d: d["assurance"].update({"runtimeImplemented": True})),
        ("premature-g4-claim", lambda d: d["assurance"].update({"userJourneyCrud": "COMPLETE"})),
        ("premature-g6-claim", lambda d: d["assurance"].update({"productionAuthorized": True})),
        ("wrong-exact-count", lambda d: d["exactCounts"].update({"plannedTables": 23})),
        ("missing-seal", lambda d: d.pop("sealedPayloadSha256")),
        ("invalid-seal", lambda d: d.update({"sealedPayloadSha256": "0" * 64})),
    ]
    results: dict[str, bool] = {}
    for name, mutation in cases:
        candidate = copy.deepcopy(base)
        mutation(candidate)
        candidate["sealedPayloadSha256"] = sha256_bytes(canonical_payload(candidate))
        if name in {"missing-seal", "invalid-seal"}:
            mutation_again = name == "missing-seal"
            if mutation_again:
                candidate.pop("sealedPayloadSha256", None)
            else:
                candidate["sealedPayloadSha256"] = "0" * 64
        results[name] = bool(validate_contract(
            candidate,
            ROOT,
            check_files=name == "stale-authority",
            check_consumers=False,
        ))
    return results


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    try:
        doc = load_strict(CONTRACT)
        errors = validate_contract(doc, ROOT, check_files=True)
    except Exception as exc:  # fail closed on bytes/schema/path errors
        doc = {}
        errors = [f"LOAD:{type(exc).__name__}:{exc}"]
    mutations = self_test(doc) if args.self_test and doc else {}
    failed_mutations = sorted(name for name, passed in mutations.items() if not passed)
    if failed_mutations:
        errors.append("SELF_TEST:" + "|".join(failed_mutations))
    status = "PASS" if not errors else "FAIL"
    counts = doc.get("exactCounts", {}) if doc else {}
    result = {
        "validator": "SYS_LISTENING_STREAM_AUTHORITY_SUCCESSOR_INDEPENDENT_V1",
        "status": status,
        "scope": "G3_START_AUTHORITY_ONLY_NOT_RUNTIME_OR_G4_OR_G6",
        "counts": counts,
        "selfTests": {"total": len(mutations), "passed": sum(mutations.values())} if args.self_test else None,
        "errors": errors,
    }
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":") if args.compact else None, indent=None if args.compact else 2))
    return 0 if status == "PASS" else 1


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
