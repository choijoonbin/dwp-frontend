#!/usr/bin/env python3
"""Fail-closed exact coding contract validator for 16 modern DWP HRIS capabilities.

This validator opens only the generic-core G3 implementation scope.  It does not
claim that any modern capability is implemented or that country, customer,
connector, model-provider, legal, privacy, load, DR or production activation is
authorized.
"""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import time
from collections import Counter, defaultdict
from typing import Any

from validate_modern_semantic_field_lineage import (
    load_base_tables,
    run_semantic_self_tests,
    validate_semantic_field_lineage,
)

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
SUMMARY = HERE / "modern-capability-coding-contract-register.csv"
MENU = HERE / "modern-menu-node-register.csv"
DELIVERY = HERE / "modern-capability-delivery-register.csv"
TRACE = HERE / "modern-capability-trace-register.csv"
AUTH = HERE / "modern-capability-authorization-register.csv"
ROADMAP = ROOT / "modern-hris-capability-roadmap.csv"
PAY_CONSUMER = ROOT / "session-evidence/pay/g3-modern-capability-consumer-contracts.v1.json"
EXACT_SCHEMA = HERE / "modern-capability-exact-schema-contracts.v1.json"
EVENT_PAYLOAD = HERE / "modern-capability-event-payload-contracts.v1.json"
EVENT_LINEAGE = HERE / "modern-capability-event-successor-lineage.v2.json"
LISTENING_AUTHORITY = HERE / "sys-listening-stream-authority-successor.v1.json"
LISTENING_AUTHORITY_ID = "dwp.hris.sys.listening.stream-authority-successor.v1"
TARGET_TABLE_CATALOG = ROOT / "target-table-catalog.md"
BASE_SCHEMA_FILES = {
    "HRIS-HRM": ROOT / "session-evidence/hrm/g2-readiness/physical-schema-blueprint.sql",
    "HRIS-PER": ROOT / "session-evidence/per/g2-readiness/physical-schema.sql",
    "HRIS-TIM": ROOT / "session-evidence/tim/g2-physical-schema.sql",
    "HRIS-PAY": ROOT / "session-evidence/pay/g2-physical-schema.sql",
    "HRIS-SYS": ROOT / "session-evidence/sys/g2-physical-schema.sql",
}
EXPECTED_BASE_TABLE_COUNTS = {
    "HRIS-HRM": 24,
    "HRIS-PER": 34,
    "HRIS-TIM": 31,
    "HRIS-PAY": 42,
    "HRIS-SYS": 32,
}
CONTRACT_FILES = {
    "HRIS-HRM": ROOT / "session-evidence/hrm/g3-modern-capability-contracts.v1.json",
    "HRIS-PER": ROOT / "session-evidence/per/g3-modern-capability-contracts.v2.json",
    "HRIS-TIM": ROOT / "session-evidence/tim/g3-modern-capability-contracts.v1.json",
    "HRIS-SYS": ROOT / "session-evidence/sys/g3-modern-capability-contracts.v1.json",
}

EXPECTED_CAPABILITIES = {
    "HRIS.MODERN.SKILLS_ONTOLOGY": "HRIS-PER",
    "HRIS.MODERN.GROWTH_PROFILE": "HRIS-PER",
    "HRIS.MODERN.RECRUITING_ATS": "HRIS-HRM",
    "HRIS.MODERN.ONBOARDING": "HRIS-HRM",
    "HRIS.MODERN.LEARNING": "HRIS-PER",
    "HRIS.MODERN.INTERNAL_MARKETPLACE": "HRIS-PER",
    "HRIS.MODERN.SUCCESSION": "HRIS-PER",
    "HRIS.MODERN.WORKFORCE_PLANNING": "HRIS-HRM",
    "HRIS.MODERN.COMPENSATION_PLANNING": "HRIS-PER",
    "HRIS.MODERN.BENEFITS_ADMIN": "HRIS-HRM",
    "HRIS.MODERN.HR_SERVICE_DELIVERY": "HRIS-HRM",
    "HRIS.MODERN.EMPLOYEE_LISTENING": "HRIS-SYS",
    "HRIS.MODERN.ADVANCED_WFM": "HRIS-TIM",
    "HRIS.MODERN.CONTINGENT_WORKFORCE": "HRIS-HRM",
    "HRIS.MODERN.PEOPLE_ANALYTICS": "HRIS-SYS",
    "HRIS.MODERN.GOVERNED_AI": "HRIS-SYS",
}
EXPECTED_RUNTIME = {
    "HRIS-HRM": "dwp-people-server",
    "HRIS-PER": "dwp-people-server",
    "HRIS-TIM": "dwp-time-server",
    "HRIS-SYS": "dwp-platform-server",
}
EXPECTED_COUNTS = {
    "capabilities": 16,
    "operations": 100,
    "state_machines": 16,
    "transitions": 85,
    "events": 86,
    "tables": 71,
    "acceptance_tests": 48,
    "menu_nodes": 22,
    "authorization_bindings": 48,
    "pay_consumer_tables": 2,
}
EXPECTED_MIGRATION_FILES = {
    "HRIS.MODERN.RECRUITING_ATS": "dwp-people-server/src/main/resources/db/migration/V64__hrm_modern_recruiting_ats.sql",
    "HRIS.MODERN.ONBOARDING": "dwp-people-server/src/main/resources/db/migration/V65__hrm_modern_onboarding.sql",
    "HRIS.MODERN.WORKFORCE_PLANNING": "dwp-people-server/src/main/resources/db/migration/V66__hrm_modern_workforce_planning.sql",
    "HRIS.MODERN.BENEFITS_ADMIN": "dwp-people-server/src/main/resources/db/migration/V67__hrm_modern_benefits_admin.sql",
    "HRIS.MODERN.HR_SERVICE_DELIVERY": "dwp-people-server/src/main/resources/db/migration/V68__hrm_modern_hr_service_delivery.sql",
    "HRIS.MODERN.CONTINGENT_WORKFORCE": "dwp-people-server/src/main/resources/db/migration/V69__hrm_modern_contingent_workforce.sql",
    "HRIS.MODERN.SKILLS_ONTOLOGY": "dwp-people-server/src/main/resources/db/performance-migration/V17__per_modern_skills_ontology.sql",
    "HRIS.MODERN.GROWTH_PROFILE": "dwp-people-server/src/main/resources/db/performance-migration/V18__per_modern_growth_profile.sql",
    "HRIS.MODERN.LEARNING": "dwp-people-server/src/main/resources/db/performance-migration/V19__per_modern_learning.sql",
    "HRIS.MODERN.INTERNAL_MARKETPLACE": "dwp-people-server/src/main/resources/db/performance-migration/V20__per_modern_internal_marketplace.sql",
    "HRIS.MODERN.SUCCESSION": "dwp-people-server/src/main/resources/db/performance-migration/V21__per_modern_succession.sql",
    "HRIS.MODERN.COMPENSATION_PLANNING": "dwp-people-server/src/main/resources/db/performance-migration/V22__per_modern_compensation_planning.sql",
    "HRIS.MODERN.ADVANCED_WFM": "dwp-time-server/src/main/resources/db/migration/V39__tim_modern_advanced_wfm.sql",
    "HRIS.MODERN.EMPLOYEE_LISTENING": "dwp-platform-server/src/main/resources/db/migration/V287__hris_platform_modern_employee_listening.sql",
    "HRIS.MODERN.PEOPLE_ANALYTICS": "dwp-platform-server/src/main/resources/db/migration/V288__hris_platform_modern_people_analytics.sql",
    "HRIS.MODERN.GOVERNED_AI": "dwp-platform-server/src/main/resources/db/migration/V289__hris_platform_modern_governed_ai.sql",
}
EXPECTED_ROUTE_PREFIX = {
    "HRIS-HRM": "/api/people/v1/hris/",
    "HRIS-PER": "/api/people/v1/hris/performance/",
    "HRIS-TIM": "/api/time/v1/",
    "HRIS-SYS": "/api/platform/v1/",
}
EXPECTED_TABLE_PREFIX = {
    "HRIS-HRM": "ppl_",
    "HRIS-PER": "prf_",
    "HRIS-TIM": "tme_",
    "HRIS-SYS": "sys_hris_",
}
EXPECTED_BACKEND_PREFIX = {
    "HRIS-HRM": "dwp-people-server/src/main/java/com/dwp/services/people/hris/",
    "HRIS-PER": "dwp-people-server/src/main/java/com/dwp/services/people/hris/performance/",
    "HRIS-TIM": "dwp-time-server/src/main/java/com/dwp/services/time/",
    "HRIS-SYS": "dwp-platform-server/src/main/java/com/dwp/services/platform/hrisconfiguration/",
}
EXPECTED_FRONTEND_PREFIX = {
    "HRIS-HRM": "apps/dwp/src/features/hris/",
    "HRIS-PER": "apps/dwp/src/features/hris/performance/",
    "HRIS-TIM": "apps/dwp/src/features/hris/time/",
    "HRIS-SYS": "apps/dwp/src/features/hris/administration/",
}
EXPECTED_ENVELOPE_FIELDS = {
    "specVersion", "id", "source", "type", "schemaVersion", "time", "tenantId",
    "aggregateType", "aggregateId", "aggregateSequence", "correlationId", "data",
}
EXPECTED_SNAPSHOT_FIELDS = {
    "snapshotId", "snapshotRevision", "planId", "cycleId", "effectiveFrom",
    "effectiveTo", "approvalReceiptId", "sourceVersion", "lineCount", "lines",
    "payloadDigest",
}
EXPECTED_SNAPSHOT_LINE_FIELDS = {
    "lineId", "lineSequence", "workerId", "assignmentId", "componentCode",
    "currency", "approvedAmount", "effectiveFrom", "effectiveTo", "lineDigest",
}
EXPECTED_COMPENSATION_EVENT_V2_FIELDS = {
    "aggregateId", "fromState", "toState", "aggregateVersion", "occurredAt",
    "correlationId", "planId", "cycleId", "approvalRevision",
    "approvalReceiptId", "effectiveDate", "snapshotId", "lineCount",
    "snapshotRevision", "sourceVersion", "payloadDigest",
}
SUMMARY_HEADER = [
    "capability_id", "owner_session", "bounded_context", "runtime_owner",
    "backend_root", "backend_test_root", "frontend_root", "frontend_test_root",
    "migration_file", "openapi_file", "asyncapi_file", "menu_node_count",
    "authorization_capability_count", "api_operation_count",
    "state_machine_count", "state_transition_count", "event_count",
    "physical_table_count", "acceptance_test_count", "contract_ref",
    "implementation_state", "production_state", "status",
]
MENU_HEADER = [
    "menu_node_key", "route", "primary_persona", "secondary_personas",
    "owner_session", "runtime_owner", "capability_ids",
    "required_authorization_capabilities", "navigation_surface",
    "visibility_rule", "implementation_state",
]
ALLOWED_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}
ALLOWED_EXPECTED_VERSION = {"NOT_APPLICABLE", "REQUIRED", "CONDITIONAL"}
ALLOWED_PERSONAS = {
    "EMPLOYEE", "MANAGER", "BUSINESS_OPERATOR", "SETTINGS_ADMIN",
    "ENTERPRISE_AUDITOR",
}
MIGRATION_VERSION = re.compile(r"/V(\d+)__")
TOKEN = re.compile(r"^[A-Z][A-Z0-9_]*$")
CAPABILITY_KEY = re.compile(r"^hcm\.[a-z0-9.-]+$")
EVENT_TOPIC = re.compile(r"^dwp\.hris\.[a-z0-9.-]+\.v2$")
HARDCODED_RETENTION = re.compile(r"(?:^|_)\d+Y(?:_|$)")


class Validation:
    def __init__(self) -> None:
        self.errors: list[str] = []

    def require(self, condition: bool, message: str) -> None:
        if not condition:
            self.errors.append(message)


def read_csv(path: pathlib.Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def pipe_set(value: str) -> set[str]:
    return {part.strip() for part in value.split("|") if part.strip()}


def route_matches_pattern(route: str, pattern: str) -> bool:
    if not pattern.endswith("/**"):
        return route == pattern
    root = pattern[:-3]
    return route == root or route.startswith(root + "/")


def check_nonempty_list(v: Validation, value: Any, where: str) -> None:
    v.require(isinstance(value, list) and bool(value), f"{where} must be a non-empty list")
    if isinstance(value, list):
        v.require(all(isinstance(item, str) and item.strip() for item in value),
                  f"{where} contains a blank/non-string item")
        v.require(len(value) == len(set(value)), f"{where} contains duplicates")


def validate_migration_assignment(
    v: Validation,
    capability_id: str,
    owner_session: str,
    migration_file: str,
) -> None:
    """Validate the complete migration identity, not merely its numeric version."""
    expected_file = EXPECTED_MIGRATION_FILES.get(capability_id)
    v.require(expected_file is not None,
              f"{capability_id}: migration assignment is not registered")
    v.require(migration_file == expected_file,
              f"{capability_id}: migration version/path drift")
    expected_owner = EXPECTED_CAPABILITIES.get(capability_id)
    v.require(owner_session == expected_owner,
              f"{capability_id}: migration owner/session drift")
    match = MIGRATION_VERSION.search(migration_file)
    expected_match = MIGRATION_VERSION.search(expected_file or "")
    v.require(
        bool(match and expected_match and match.group(1) == expected_match.group(1)),
        f"{capability_id}: migration numeric version drift",
    )


def validate_contracts(v: Validation) -> tuple[dict[str, dict[str, Any]], dict[str, int]]:
    capabilities: dict[str, dict[str, Any]] = {}
    operation_ids: set[str] = set()
    operation_routes: set[tuple[str, str]] = set()
    transition_ids: set[str] = set()
    event_names: set[str] = set()
    event_topics: set[str] = set()
    table_names: set[str] = set()
    migration_files: set[str] = set()
    test_ids: set[str] = set()
    evidence_paths: set[str] = set()
    counts = Counter()

    for expected_session, path in CONTRACT_FILES.items():
        v.require(path.is_file(), f"missing contract file: {path}")
        if not path.is_file():
            continue
        raw = path.read_text(encoding="utf-8")
        v.require("tenant_id UUID" not in raw, f"{path.name}: UUID tenant drift")
        v.require("dwp.tenant_id',true)::uuid" not in raw, f"{path.name}: UUID RLS cast drift")
        v.require(not HARDCODED_RETENTION.search(raw), f"{path.name}: hardcoded retention duration")
        try:
            doc = json.loads(raw)
        except json.JSONDecodeError as exc:
            v.errors.append(f"{path.name}: invalid JSON: {exc}")
            continue
        v.require(doc.get("schemaVersion") == 1, f"{path.name}: schemaVersion drift")
        v.require(doc.get("session") == expected_session, f"{path.name}: session drift")
        v.require(doc.get("status") == "G3_CONTRACT_READY_NOT_IMPLEMENTED",
                  f"{path.name}: status drift")
        v.require(doc.get("runtimeOwners") == [EXPECTED_RUNTIME[expected_session]],
                  f"{path.name}: runtime owner drift")
        defaults = doc.get("physicalTableDefaults", {})
        v.require(defaults.get("tenantColumn") == "tenant_id BIGINT NOT NULL",
                  f"{path.name}: tenant column must be BIGINT")
        v.require("::bigint" in defaults.get("rowSecurity", ""),
                  f"{path.name}: RLS tenant cast must be bigint")
        v.require("UUID" in defaults.get("publicId", ""),
                  f"{path.name}: public ID must remain UUID")
        envelope = doc.get("eventEnvelope", {})
        v.require(set(envelope.get("required", [])) == EXPECTED_ENVELOPE_FIELDS,
                  f"{path.name}: event envelope drift")
        v.require(envelope.get("outbox") == "same_transaction",
                  f"{path.name}: transactional outbox drift")

        for cap in doc.get("capabilities", []):
            cap_id = cap.get("capabilityId", "")
            counts["capabilities"] += 1
            v.require(cap_id in EXPECTED_CAPABILITIES, f"unknown capability {cap_id}")
            v.require(cap_id not in capabilities, f"duplicate capability {cap_id}")
            if cap_id:
                capabilities[cap_id] = cap
            session = cap.get("session")
            v.require(session == expected_session == EXPECTED_CAPABILITIES.get(cap_id),
                      f"{cap_id}: owner session drift")
            v.require(cap.get("runtimeOwner") == EXPECTED_RUNTIME.get(session),
                      f"{cap_id}: runtime owner drift")
            v.require(cap.get("implementationState") == "NOT_STARTED_G3",
                      f"{cap_id}: implementation state must remain NOT_STARTED_G3")
            v.require(cap.get("productionState") == "NOT_AUTHORIZED_G6",
                      f"{cap_id}: production state must remain NOT_AUTHORIZED_G6")
            v.require("PRODUCT_CORE" in cap.get("activationLayers", []),
                      f"{cap_id}: PRODUCT_CORE missing")
            check_nonempty_list(v, cap.get("countryOrExternalActivation"), f"{cap_id}.countryOrExternalActivation")
            check_nonempty_list(v, cap.get("menuNodeKeys"), f"{cap_id}.menuNodeKeys")
            check_nonempty_list(v, cap.get("authorizationCapabilities"), f"{cap_id}.authorizationCapabilities")
            check_nonempty_list(v, cap.get("dataContracts"), f"{cap_id}.dataContracts")
            v.require(all(CAPABILITY_KEY.fullmatch(x) for x in cap.get("authorizationCapabilities", [])),
                      f"{cap_id}: malformed authorization capability")

            backend_root = cap.get("backendRoot", "")
            backend_test_root = cap.get("backendTestRoot", "")
            frontend_root = cap.get("frontendRoot", "")
            frontend_test_root = cap.get("frontendTestRoot", "")
            v.require(backend_root.startswith(EXPECTED_BACKEND_PREFIX.get(session, "!")),
                      f"{cap_id}: backend root outside bounded context")
            expected_test = backend_root.replace("/src/main/", "/src/test/", 1)
            v.require(backend_test_root == expected_test,
                      f"{cap_id}: backend test root must mirror source root")
            v.require(frontend_root.startswith(EXPECTED_FRONTEND_PREFIX.get(session, "!")),
                      f"{cap_id}: frontend root outside module")
            v.require(frontend_test_root == frontend_root + "/__tests__",
                      f"{cap_id}: frontend test root drift")
            v.require(cap.get("openapiFile", "").startswith("contracts/openapi/hris/"),
                      f"{cap_id}: OpenAPI allocation missing")
            v.require(cap.get("asyncapiFile", "").startswith("contracts/asyncapi/hris/"),
                      f"{cap_id}: AsyncAPI allocation missing")
            migration = cap.get("migrationFile", "")
            validate_migration_assignment(v, cap_id, session, migration)
            v.require(migration not in migration_files, f"{cap_id}: duplicate migration file")
            migration_files.add(migration)

            operations = cap.get("operations", [])
            counts["operations"] += len(operations)
            used_auth: set[str] = set()
            local_ops: dict[str, dict[str, Any]] = {}
            for operation in operations:
                required = {
                    "operationId", "method", "path", "action",
                    "authorizationCapability", "scope", "mode", "response",
                    "idempotency", "expectedVersion", "transitionIds", "emits",
                }
                v.require(required <= set(operation), f"{cap_id}: incomplete operation fields")
                op_id = operation.get("operationId", "")
                v.require(op_id and op_id not in operation_ids, f"{cap_id}: duplicate/blank operation {op_id}")
                operation_ids.add(op_id)
                local_ops[op_id] = operation
                method = operation.get("method")
                route = operation.get("path", "")
                v.require(method in ALLOWED_METHODS, f"{op_id}: invalid method")
                v.require(route.startswith(EXPECTED_ROUTE_PREFIX.get(session, "!")),
                          f"{op_id}: route outside runtime")
                v.require("**" not in route and "/api/hris/" not in route,
                          f"{op_id}: wildcard or legacy route")
                v.require((method, route) not in operation_routes,
                          f"{op_id}: duplicate method/path")
                operation_routes.add((method, route))
                v.require(TOKEN.fullmatch(operation.get("action", "")) is not None,
                          f"{op_id}: malformed action")
                auth_key = operation.get("authorizationCapability", "")
                used_auth.add(auth_key)
                v.require(auth_key in cap.get("authorizationCapabilities", []),
                          f"{op_id}: authorization key outside capability")
                check_nonempty_list(v, operation.get("scope"), f"{op_id}.scope")
                v.require(all(TOKEN.fullmatch(x) for x in operation.get("scope", [])),
                          f"{op_id}: malformed scope")
                v.require(str(operation.get("response", "")).endswith(".v1"),
                          f"{op_id}: response major version missing")
                v.require(operation.get("expectedVersion") in ALLOWED_EXPECTED_VERSION,
                          f"{op_id}: expectedVersion drift")
                if operation.get("mode") == "QUERY":
                    v.require(method == "GET", f"{op_id}: query must be GET")
                    v.require(operation.get("idempotency") == "READ_SAFE",
                              f"{op_id}: query idempotency drift")
                    v.require(operation.get("expectedVersion") == "NOT_APPLICABLE",
                              f"{op_id}: query expectedVersion drift")
                    v.require(operation.get("transitionIds") == [] and operation.get("emits") == [],
                              f"{op_id}: query cannot mutate state or emit domain event")
                elif operation.get("mode") == "COMMAND":
                    v.require(method != "GET", f"{op_id}: command cannot be GET")
                    v.require(operation.get("idempotency") == "REQUIRED",
                              f"{op_id}: command idempotency required")
                    check_nonempty_list(v, operation.get("transitionIds"), f"{op_id}.transitionIds")
                    check_nonempty_list(v, operation.get("emits"), f"{op_id}.emits")
                else:
                    v.errors.append(f"{op_id}: invalid mode")
            v.require(used_auth == set(cap.get("authorizationCapabilities", [])),
                      f"{cap_id}: not every authorization capability is bound to an operation")

            local_transitions: dict[str, dict[str, Any]] = {}
            local_handlers = {
                handler.get("handlerId", ""): handler
                for handler in cap.get("internalConsumerHandlers", [])
            }
            state_machines = cap.get("stateMachines", [])
            counts["state_machines"] += len(state_machines)
            v.require(len(state_machines) == 1, f"{cap_id}: exact primary state machine missing")
            for machine in state_machines:
                v.require(machine.get("stateMachineId") and machine.get("aggregate")
                          and machine.get("initialState"), f"{cap_id}: incomplete state machine")
                check_nonempty_list(v, machine.get("terminalStates"), f"{cap_id}.terminalStates")
                for transition in machine.get("transitions", []):
                    counts["transitions"] += 1
                    tid = transition.get("transitionId", "")
                    v.require(tid and tid not in transition_ids,
                              f"{cap_id}: duplicate/blank transition {tid}")
                    transition_ids.add(tid)
                    local_transitions[tid] = transition
                    op_id = transition.get("operationId", "")
                    v.require(op_id in local_ops or op_id in local_handlers,
                              f"{tid}: orphan operation/handler")
                    if op_id in local_ops:
                        v.require(local_ops[op_id].get("mode") == "COMMAND",
                                  f"{tid}: transition operation must be command")
                    if op_id in local_handlers:
                        handler = local_handlers[op_id]
                        v.require(handler.get("aggregateRootTable") == transition.get("aggregateRootTable")
                                  and handler.get("transitionId") == tid,
                                  f"{tid}: internal handler transition binding drift")
                    v.require(bool(transition.get("from")) and bool(transition.get("to"))
                              and bool(transition.get("guard")), f"{tid}: incomplete edge/guard")

            local_event_names: set[str] = set()
            covered_transitions: set[str] = set()
            for event in cap.get("events", []):
                counts["events"] += 1
                name = event.get("name", "")
                v.require(name == f"{event.get('type')}.v2" and event.get("version") == 2,
                          f"{cap_id}: event name/type/version drift {name}")
                v.require(name not in event_names, f"{cap_id}: duplicate event {name}")
                event_names.add(name)
                local_event_names.add(name)
                topic = event.get("topic", "")
                v.require(EVENT_TOPIC.fullmatch(topic) is not None,
                          f"{name}: malformed topic")
                v.require(topic not in event_topics, f"{name}: duplicate topic")
                event_topics.add(topic)
                check_nonempty_list(v, event.get("payloadRequired"), f"{name}.payloadRequired")
                v.require(len(event.get("payloadRequired", [])) >= 5,
                          f"{name}: payload contract is not exact enough")
                check_nonempty_list(v, event.get("emittedOn"), f"{name}.emittedOn")
                v.require(set(event.get("emittedOn", [])) <= set(local_transitions),
                          f"{name}: orphan emittedOn transition")
                covered_transitions.update(event.get("emittedOn", []))
            v.require(covered_transitions == set(local_transitions),
                      f"{cap_id}: every transition must emit a declared event")
            for op_id, operation in local_ops.items():
                expected_tids = {
                    tid for tid, transition in local_transitions.items()
                    if transition.get("operationId") == op_id
                }
                expected_events = {
                    event.get("name") for event in cap.get("events", [])
                    if set(event.get("emittedOn", [])) & expected_tids
                }
                v.require(set(operation.get("transitionIds", [])) == expected_tids,
                          f"{op_id}: transition links drift")
                v.require(set(operation.get("emits", [])) == expected_events,
                          f"{op_id}: event links drift")

            for table in cap.get("tables", []):
                counts["tables"] += 1
                name = table.get("name", "")
                required = {
                    "name", "kind", "idColumn", "effectiveTime", "immutability",
                    "foreignKeyBoundaries", "uniqueKeys", "checks", "indexes",
                    "retentionClass", "rowSecurity",
                }
                v.require(required <= set(table), f"{cap_id}: incomplete table {name}")
                v.require(name.startswith(EXPECTED_TABLE_PREFIX.get(session, "!")),
                          f"{cap_id}: table outside owner schema {name}")
                v.require(name not in table_names, f"{cap_id}: duplicate table {name}")
                table_names.add(name)
                v.require(str(table.get("idColumn", "")).endswith("_id"),
                          f"{name}: internal id column drift")
                # A physical root/allocator may legitimately have no FK, but
                # the boundary inventory must still be explicit. Constraints
                # that establish identity and lifecycle remain non-empty.
                v.require(isinstance(table.get("foreignKeyBoundaries"), list),
                          f"{name}.foreignKeyBoundaries must be an explicit list")
                for key in ("uniqueKeys", "checks", "indexes"):
                    check_nonempty_list(v, table.get(key), f"{name}.{key}")
                v.require(table.get("rowSecurity") == "INHERIT_EXACT_DEFAULT",
                          f"{name}: RLS inheritance drift")
                retention = table.get("retentionClass", "")
                v.require(bool(retention) and not HARDCODED_RETENTION.search(retention),
                          f"{name}: retention must be policy keyed, never hardcoded years")

            tests = cap.get("acceptanceTests", [])
            counts["acceptance_tests"] += len(tests)
            v.require(len(tests) == 3, f"{cap_id}: exactly three G4 acceptance contracts required")
            types: set[str] = set()
            for test in tests:
                test_id = test.get("testId", "")
                evidence = test.get("evidencePath", "")
                test_type = test.get("type", "")
                v.require(test_id and test_id not in test_ids, f"{cap_id}: duplicate/blank test ID")
                test_ids.add(test_id)
                v.require(evidence and evidence not in evidence_paths,
                          f"{cap_id}: duplicate/blank evidence path")
                evidence_paths.add(evidence)
                v.require("/g4/modern/" in evidence and evidence.endswith(".json"),
                          f"{test_id}: G4 evidence path drift")
                v.require(bool(test.get("assertion")), f"{test_id}: assertion missing")
                types.add(test_type)
            v.require("CONTRACT" in types and "ACCEPTANCE" in types
                      and bool(types & {"SECURITY", "STATE"}),
                      f"{cap_id}: contract + security/state + acceptance coverage required")

    v.require(set(capabilities) == set(EXPECTED_CAPABILITIES),
              "modern capability set must be exact 16")
    v.require(Counter(c.get("session") for c in capabilities.values())
              == Counter({"HRIS-HRM": 6, "HRIS-PER": 6, "HRIS-TIM": 1, "HRIS-SYS": 3}),
              "modern owner distribution drift")
    for key in ("capabilities", "operations", "state_machines", "transitions",
                "events", "tables", "acceptance_tests"):
        v.require(counts[key] == EXPECTED_COUNTS[key],
                  f"{key} count drift: {counts[key]} != {EXPECTED_COUNTS[key]}")
    return capabilities, dict(counts)


def validate_summary(v: Validation, capabilities: dict[str, dict[str, Any]]) -> None:
    header, rows = read_csv(SUMMARY)
    v.require(header == SUMMARY_HEADER, "modern coding summary header drift")
    v.require(len(rows) == EXPECTED_COUNTS["capabilities"], "modern coding summary row count drift")
    by_id = {row["capability_id"]: row for row in rows}
    v.require(len(by_id) == len(rows), "duplicate summary capability")
    v.require(set(by_id) == set(capabilities), "summary capability closure drift")
    listening_authority = json.loads(LISTENING_AUTHORITY.read_text(encoding="utf-8"))
    v.require(
        listening_authority.get("contractId") == LISTENING_AUTHORITY_ID
        and listening_authority.get("status")
        == "CANONICAL_G3_START_AUTHORITY_NOT_IMPLEMENTED",
        "Employee Listening successor authority missing or stale",
    )
    for cap_id, cap in capabilities.items():
        row = by_id.get(cap_id, {})
        expected_ref = next(
            "../" + path.relative_to(ROOT).as_posix()
            for session, path in CONTRACT_FILES.items() if session == cap["session"]
        )
        exact = {
            "owner_session": cap["session"],
            "bounded_context": cap["boundedContext"],
            "runtime_owner": cap["runtimeOwner"],
            "backend_root": cap["backendRoot"],
            "backend_test_root": cap["backendTestRoot"],
            "frontend_root": cap["frontendRoot"],
            "frontend_test_root": cap["frontendTestRoot"],
            "migration_file": cap["migrationFile"],
            "openapi_file": cap["openapiFile"],
            "asyncapi_file": cap["asyncapiFile"],
            "menu_node_count": str(len(cap["menuNodeKeys"])),
            "authorization_capability_count": str(len(cap["authorizationCapabilities"])),
            "api_operation_count": str(len(cap["operations"])),
            "state_machine_count": str(len(cap["stateMachines"])),
            "state_transition_count": str(sum(len(x["transitions"]) for x in cap["stateMachines"])),
            "event_count": str(len(cap["events"])),
            "physical_table_count": str(len(cap["tables"])),
            "acceptance_test_count": str(len(cap["acceptanceTests"])),
            "contract_ref": expected_ref,
            "implementation_state": "NOT_STARTED_G3",
            "production_state": "NOT_AUTHORIZED_G6",
            "status": "EXACT_G3_CONTRACT_READY_NOT_IMPLEMENTED",
        }
        if cap_id == "HRIS.MODERN.EMPLOYEE_LISTENING":
            streams = listening_authority.get("authorityStreams", [])
            exact.update({
                "bounded_context": "|".join(row["streamKey"] for row in streams),
                "runtime_owner": "|".join(dict.fromkeys(row["ownerService"] for row in streams)),
                "backend_root": "|".join(row["sourceRoot"] for row in streams),
                "backend_test_root": "|".join(row["testRoot"] for row in streams),
                "migration_file": "|".join(
                    row["migrationLocation"] + "/" + row["firstReservedMigration"]
                    for row in streams
                ),
                "state_machine_count": "0",
                "state_transition_count": "0",
                "physical_table_count": "24",
                "openapi_file": "contracts/openapi/hris/sys/employee-listening.v2.yaml",
                "asyncapi_file": "contracts/asyncapi/hris/sys/employee-listening.v2.yaml",
                "contract_ref": LISTENING_AUTHORITY_ID + "|" + expected_ref,
                "status": "SUCCESSOR_EXACT_G3_START_AUTHORITY_NOT_IMPLEMENTED",
            })
        for field, value in exact.items():
            v.require(row.get(field) == value, f"{cap_id}: summary {field} drift")


def validate_trace_v2_lineage(
    v: Validation,
    trace_rows: list[dict[str, str]],
    event_payload: dict[str, Any],
    lineage: dict[str, Any],
) -> None:
    """Bind every modern trace row to its complete reviewed public v2 event set."""
    expected_by_capability: dict[str, set[str]] = defaultdict(set)
    for event in event_payload.get("eventPayloadSchemas", []):
        expected_by_capability[event.get("capabilityId", "")].add(
            event.get("eventName", "")
        )
    listening_authority = json.loads(LISTENING_AUTHORITY.read_text(encoding="utf-8"))
    listening_authority_body = {
        key: value for key, value in listening_authority.items()
        if key != "sealedPayloadSha256"
    }
    listening_authority_seal = hashlib.sha256(json.dumps(
        listening_authority_body,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")).hexdigest()
    listening_lineage_reference = {
        "contractId": LISTENING_AUTHORITY_ID,
        "path": LISTENING_AUTHORITY.name,
        "fileSha256": hashlib.sha256(LISTENING_AUTHORITY.read_bytes()).hexdigest(),
        "sealedPayloadSha256": listening_authority_seal,
        "canonicalInputSetSha256": listening_authority.get(
            "canonicalPrecedence", {}
        ).get("generatedSummary", {}).get("canonicalInputSetSha256", ""),
        "capabilityId": "HRIS.MODERN.EMPLOYEE_LISTENING",
        "authorityMode": "DERIVED_SUMMARY_OF_CANONICAL_FIVE",
        "canonicalRowsRole": "PRIMARY_ACTIVE_EVENT_AUTHORITY",
    }
    v.require(
        listening_authority.get("sealedPayloadSha256") == listening_authority_seal
        and listening_authority.get("canonicalPrecedence", {}).get("mode")
        == "CANONICAL_FIVE_PRIMARY_DERIVED_SUMMARY_ONLY"
        and lineage.get("canonicalDerivedSummaries")
        == {"sysListeningStreamSummary": listening_lineage_reference},
        "modern trace: Listening derived-summary authority drift",
    )
    listening_active_events = {
        row.get("eventName", "")
        for row in listening_authority.get("eventOwnership", {}).get(
            "canonicalPublicEvents", []
        )
    }
    listening_internal_messages = {
        row.get("messageName", "")
        for row in listening_authority.get("eventOwnership", {}).get(
            "internalPortMessages", []
        )
    }
    expected_by_capability["HRIS.MODERN.EMPLOYEE_LISTENING"] = (
        listening_active_events | listening_internal_messages
    )
    successor_names = {
        name
        for item in lineage.get("lineage", [])
        for name in item.get("successorEvents", [])
    }
    introduced_names = set(lineage.get("introducedV2Events", []))
    predecessor_names = {
        item.get("predecessorEvent", "") for item in lineage.get("lineage", [])
    }
    payload_names = {
        event.get("eventName", "")
        for event in event_payload.get("eventPayloadSchemas", [])
    }
    v.require(
        payload_names == successor_names | introduced_names
        and not (successor_names & introduced_names)
        and len(payload_names) == EXPECTED_COUNTS["events"]
        and all(
            name.endswith(".v2") or name in listening_active_events
            for name in payload_names
        ),
        "modern trace: lineage successor/introduced event universe drift",
    )
    v.require(
        all(
            item.get("runtimeDualPublish", {}).get("required") is False
            for item in lineage.get("lineage", [])
        ),
        "modern trace: runtime dual-publish authority must remain false",
    )
    v.require(
        len(trace_rows) == len(expected_by_capability) == EXPECTED_COUNTS["capabilities"],
        "modern trace: capability/event grouping cardinality drift",
    )
    for row in trace_rows:
        capability_id = row.get("capability_id", "")
        event_refs = {
            ref for ref in pipe_set(row.get("api_event_contracts", ""))
            if not ref.startswith("/")
        }
        expected = expected_by_capability.get(capability_id, set())
        if capability_id == "HRIS.MODERN.EMPLOYEE_LISTENING":
            v.require(
                event_refs == expected,
                f"{capability_id}: trace must contain its exact canonical Listening event/message set",
            )
            v.require(
                "EmployeeListeningResponseSubmitted.v2" not in event_refs,
                f"{capability_id}: forbidden raw-response event remains active in trace",
            )
        else:
            v.require(
                event_refs == expected,
                f"{capability_id}: trace must contain its exact lineage successor v2 event set",
            )
            v.require(
                not (event_refs & predecessor_names)
                and all(ref.endswith(".v2") for ref in event_refs),
                f"{capability_id}: predecessor or non-v2 event remains active in trace",
            )


def validate_existing_registers(v: Validation, capabilities: dict[str, dict[str, Any]]) -> None:
    for path, id_field, owner_field in (
        (DELIVERY, "capability_id", "owner_session"),
        (TRACE, "capability_id", "owner_session"),
        (ROADMAP, "capability_id", "proposed_owner"),
    ):
        _, rows = read_csv(path)
        by_id = {row.get(id_field, ""): row for row in rows}
        v.require(set(by_id) == set(capabilities), f"{path.name}: capability closure drift")
        for cap_id, cap in capabilities.items():
            v.require(by_id.get(cap_id, {}).get(owner_field) == cap["session"],
                      f"{path.name}: {cap_id} owner drift")
    _, delivery_rows = read_csv(DELIVERY)
    for row in delivery_rows:
        v.require(row.get("implementation_state") == "NOT_STARTED_G3"
                  and row.get("production_state") == "NOT_AUTHORIZED_G6",
                  f"{row.get('capability_id')}: delivery state drift")
    _, trace_rows = read_csv(TRACE)
    validate_trace_v2_lineage(
        v,
        trace_rows,
        json.loads(EVENT_PAYLOAD.read_text(encoding="utf-8")),
        json.loads(EVENT_LINEAGE.read_text(encoding="utf-8")),
    )
    trace = {row["capability_id"]: row for row in trace_rows}
    for cap_id, cap in capabilities.items():
        row = trace[cap_id]
        v.require(pipe_set(row["menu_node_keys"]) == set(cap["menuNodeKeys"]),
                  f"{cap_id}: trace menu drift")
        v.require(pipe_set(row["authorization_capabilities"]) == set(cap["authorizationCapabilities"]),
                  f"{cap_id}: trace authorization drift")
        v.require(row.get("state") == "ALLOCATED_REQUIRED_NOT_STARTED",
                  f"{cap_id}: trace state drift")
        patterns = [x for x in pipe_set(row["api_event_contracts"]) if x.startswith("/")]
        v.require(bool(patterns) and all(pattern.endswith("/**") for pattern in patterns),
                  f"{cap_id}: trace API pattern drift")
        v.require(all(any(route_matches_pattern(op["path"], pattern)
                          for pattern in patterns)
                      for op in cap["operations"]),
                  f"{cap_id}: exact operation outside trace API root")


def validate_menu(v: Validation, capabilities: dict[str, dict[str, Any]]) -> None:
    header, rows = read_csv(MENU)
    v.require(header == MENU_HEADER, "modern menu header drift")
    v.require(len(rows) == EXPECTED_COUNTS["menu_nodes"], "modern menu count drift")
    keys = [row["menu_node_key"] for row in rows]
    routes = [row["route"] for row in rows]
    v.require(len(keys) == len(set(keys)), "duplicate modern menu node")
    v.require(len(routes) == len(set(routes)), "duplicate modern menu route")
    by_key = {row["menu_node_key"]: row for row in rows}
    expected_links: dict[str, set[str]] = defaultdict(set)
    for cap_id, cap in capabilities.items():
        for key in cap["menuNodeKeys"]:
            expected_links[key].add(cap_id)
    v.require(set(by_key) == set(expected_links), "menu-node key closure drift")
    for key, expected_caps in expected_links.items():
        row = by_key.get(key, {})
        linked = pipe_set(row.get("capability_ids", ""))
        v.require(linked == expected_caps, f"{key}: capability links drift")
        owners = {capabilities[c]["session"] for c in linked}
        runtimes = {capabilities[c]["runtimeOwner"] for c in linked}
        v.require(owners == {row.get("owner_session")}, f"{key}: owner drift")
        v.require(runtimes == {row.get("runtime_owner")}, f"{key}: runtime drift")
        allowed_auth = set().union(*(set(capabilities[c]["authorizationCapabilities"]) for c in linked))
        required_auth = pipe_set(row.get("required_authorization_capabilities", ""))
        v.require(required_auth and required_auth <= allowed_auth,
                  f"{key}: authorization links drift")
        v.require(row.get("primary_persona") in ALLOWED_PERSONAS,
                  f"{key}: invalid primary persona")
        v.require(pipe_set(row.get("secondary_personas", "")) <= ALLOWED_PERSONAS,
                  f"{key}: invalid secondary persona")
        v.require(row.get("navigation_surface") in {"MY_HR", "OPERATIONS", "SETTINGS"},
                  f"{key}: invalid navigation surface")
        v.require(row.get("route", "").startswith("/hr/") and "**" not in row.get("route", ""),
                  f"{key}: exact route missing")
        v.require(row.get("visibility_rule")
                  == "APP.HCM:VIEW+ANY_REQUIRED_CAPABILITY+OWNER_SCOPE",
                  f"{key}: visibility rule drift")
        v.require(row.get("implementation_state") == "NOT_STARTED_G3",
                  f"{key}: implementation state drift")


def validate_authorization(v: Validation, capabilities: dict[str, dict[str, Any]]) -> None:
    _, rows = read_csv(AUTH)
    v.require(len(rows) == EXPECTED_COUNTS["authorization_bindings"],
              "modern authorization binding count drift")
    by_cap: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        by_cap[row["modern_capability_id"]].append(row)
    v.require(set(by_cap) == set(capabilities), "authorization capability closure drift")
    for cap_id, cap in capabilities.items():
        rows_for_cap = by_cap.get(cap_id, [])
        v.require(len(rows_for_cap) == 3, f"{cap_id}: exact 3 auth bindings required")
        v.require({row["canonical_capability_key"] for row in rows_for_cap}
                  == set(cap["authorizationCapabilities"]),
                  f"{cap_id}: auth capability tuple drift")
        for row in rows_for_cap:
            v.require(row["owner_session"] == cap["session"], f"{cap_id}: auth owner drift")
            v.require(row["owner_service"] == cap["runtimeOwner"], f"{cap_id}: auth runtime drift")
            v.require(row["menu_node_key"] in cap["menuNodeKeys"], f"{cap_id}: auth menu drift")
            pattern = row["planned_route_pattern"]
            v.require(pattern.endswith("/**")
                      and all(route_matches_pattern(op["path"], pattern)
                              for op in cap["operations"]
                              if op["authorizationCapability"] == row["canonical_capability_key"]),
                      f"{cap_id}: auth route pattern does not cover exact operations")
            v.require(row["implementation_state"] == "PLANNED_G3_AUTHORIZATION_NOT_IMPLEMENTED"
                      and row["production_state"] == "NOT_AUTHORIZED_G6",
                      f"{cap_id}: auth state drift")


def validate_typed_fields(
    v: Validation,
    fields: Any,
    where: str,
    *,
    physical: bool = False,
) -> set[str]:
    v.require(isinstance(fields, list) and bool(fields), f"{where}: typed fields missing")
    if not isinstance(fields, list):
        return set()
    names: list[str] = []
    for field in fields:
        v.require(isinstance(field, dict), f"{where}: field must be an object")
        if not isinstance(field, dict):
            continue
        name = field.get("name", "")
        names.append(name)
        required_keys = (
            {"name", "sqlType", "nullable", "default", "sensitivity", "tokenization"}
            if physical else
            {"name", "type", "required", "validation", "sensitivity", "tokenization"}
        )
        v.require(required_keys <= set(field), f"{where}.{name}: incomplete field contract")
        v.require(bool(name) and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_-]*", name) is not None,
                  f"{where}.{name}: invalid field name")
        type_key = "sqlType" if physical else "type"
        v.require(isinstance(field.get(type_key), str) and bool(field.get(type_key)),
                  f"{where}.{name}: type missing")
        flag_key = "nullable" if physical else "required"
        v.require(isinstance(field.get(flag_key), bool),
                  f"{where}.{name}: {flag_key} must be boolean")
        if not physical:
            v.require(isinstance(field.get("validation"), str) and bool(field.get("validation")),
                      f"{where}.{name}: validation missing")
        v.require(field.get("sensitivity") in {
            "PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "HIGHLY_RESTRICTED",
        },
                  f"{where}.{name}: sensitivity drift")
        v.require(isinstance(field.get("tokenization"), str) and bool(field.get("tokenization")),
                  f"{where}.{name}: tokenization missing")
    v.require(len(names) == len(set(names)) and all(names), f"{where}: duplicate/blank fields")
    return set(names)


def canonical_operation_and_table_maps(
    capabilities: dict[str, dict[str, Any]],
) -> tuple[dict[str, tuple[str, dict[str, Any]]], dict[str, tuple[str, dict[str, Any]]]]:
    operations: dict[str, tuple[str, dict[str, Any]]] = {}
    tables: dict[str, tuple[str, dict[str, Any]]] = {}
    for cap_id, cap in capabilities.items():
        for operation in cap["operations"]:
            operations[operation["operationId"]] = (cap_id, operation)
        for table in cap["tables"]:
            tables[table["name"]] = (cap_id, table)
    return operations, tables


def physical_column_map(
    doc: dict[str, Any], spec: dict[str, Any], *, include_common: bool = True,
) -> dict[str, dict[str, Any]]:
    columns: dict[str, dict[str, Any]] = {}
    if include_common:
        for item in doc.get("commonTableContract", {}).get("columns", []):
            if item.get("name") != "__internal_id__":
                columns[item.get("name", "")] = item
    ident = spec.get("idColumn", {})
    if ident.get("name"):
        columns[ident["name"]] = ident
    for item in spec.get("columns", []):
        columns[item.get("name", "")] = item
    return columns


def enum_literals_are_quoted(expression: str) -> bool:
    """Reject the PostgreSQL-invalid `status IN (DRAFT,OPEN)` pattern."""
    match = re.search(r"\bIN\s*\(([^)]*)\)", expression, re.IGNORECASE)
    if not match:
        return True
    parts = [part.strip() for part in match.group(1).split(",")]
    return bool(parts) and all(re.fullmatch(r"'(?:[^']|'')+'", part) for part in parts)


def validate_schema_feasibility(
    v: Validation,
    doc: dict[str, Any],
    capabilities: dict[str, dict[str, Any]],
) -> dict[str, int]:
    """Validate executable relational constraints and lossless field lineage."""
    policies = doc.get("policies", {})
    v.require(policies.get("crossBoundaryReferenceType", "").startswith("UUID"),
              "feasibility: cross-boundary public/version reference policy missing")
    v.require("candidate key" in policies.get("localCompositeForeignKey", ""),
              "feasibility: local composite FK candidate-key policy missing")
    v.require("single-quoted" in policies.get("enumCheckSql", ""),
              "feasibility: executable enum SQL policy missing")
    v.require("UUID[]" in policies.get("arrayPersistence", "")
              and "digest" in policies.get("arrayPersistence", ""),
              "feasibility: lossless canonical array policy missing")
    v.require("all 100 operations" in policies.get("fieldLineage", "")
              and "digest-only mutation is forbidden" in policies.get("fieldLineage", ""),
              "feasibility: fail-closed field-lineage policy missing")

    specifications = doc.get("tableSpecifications", [])
    tables = {spec.get("tableName", ""): spec for spec in specifications}
    local_fk_count = 0
    opaque_refs = 0
    for spec in specifications:
        name = spec.get("tableName", "")
        child_columns = physical_column_map(doc, spec)
        for check in spec.get("checks", []):
            expression = check.get("expression", "")
            v.require(enum_literals_are_quoted(expression),
                      f"{name}.{check.get('constraintId')}: enum SQL literal is not quoted")
        for fk in spec.get("foreignKeys", []):
            columns = fk.get("columns", [])
            if fk.get("mode") == "OPAQUE_CROSS_BOUNDARY_REFERENCE":
                opaque_refs += 1
                for column in columns:
                    v.require(child_columns.get(column, {}).get("sqlType") != "BIGINT",
                              f"{name}.{column}: cross-boundary BIGINT reference forbidden")
                continue
            if fk.get("mode") != "LOCAL_COMPOSITE_FK":
                continue
            local_fk_count += 1
            target_name = fk.get("target", "")
            target = tables.get(target_name)
            v.require(target is not None, f"{name}: local FK target {target_name} missing")
            if target is None:
                continue
            target_columns = fk.get("targetColumns", [])
            expected_targets = [
                ["tenant_id", target.get("idColumn", {}).get("name")],
                ["tenant_id", "public_id"],
            ]
            # SQL permits a child FK column name to differ from the parent's
            # surrogate key name (for example pending_offer_id -> offer_id).
            # Tenant must remain first and the parent target order is exact.
            v.require(len(columns) == 2 and columns[0] == "tenant_id"
                      and target_columns in expected_targets,
                      f"{name}.{fk.get('constraintId')}: source/target FK column order drift")
            parent_columns = physical_column_map(doc, target)
            source_types = [child_columns.get(column, {}).get("sqlType") for column in columns]
            target_types = [parent_columns.get(column, {}).get("sqlType") for column in target_columns]
            v.require(None not in source_types + target_types and source_types == target_types,
                      f"{name}.{fk.get('constraintId')}: FK SQL type/order mismatch")
            candidate_keys = [key.get("columns", []) for key in target.get("uniqueKeys", [])]
            v.require(target_columns in candidate_keys,
                      f"{name}.{fk.get('constraintId')}: target candidate key missing")
    v.require(local_fk_count == 60,
              f"feasibility: expected exact 60 local composite FKs, got {local_fk_count}")
    v.require(opaque_refs >= 60, "feasibility: opaque boundary inventory unexpectedly shrank")

    # A public API record/reference ID can never expose an internal BIGINT surrogate.
    for group_name in ("recordSchemas", "responseSchemas"):
        for schema in doc.get(group_name, []):
            for field in schema.get("fields", []):
                if str(field.get("name", "")).lower().endswith("id"):
                    v.require(field.get("type") != "BIGINT",
                              f"{schema.get('schemaId')}.{field.get('name')}: public record ID cannot be BIGINT")
    for operation in doc.get("operationBindings", []):
        request = operation.get("requestSchema", {})
        for section in ("pathParameters", "queryParameters", "body"):
            for field in request.get(section, []):
                if str(field.get("name", "")).lower().endswith("id"):
                    v.require(field.get("type") != "BIGINT",
                              f"{operation.get('operationId')}.{section}.{field.get('name')}: request ID cannot be BIGINT")

    # Immutable compensation snapshot: one header plus ordered immutable lines.
    schemas = {
        schema.get("schemaId", ""): schema
        for group in ("recordSchemas", "responseSchemas")
        for schema in doc.get(group, [])
    }
    snapshot = schemas.get("ApprovedCompensationPlanSnapshot.v1", {})
    line = schemas.get("ApprovedCompensationPlanLine.v1", {})
    snapshot_fields = {field.get("name"): field for field in snapshot.get("fields", [])}
    line_fields = {field.get("name"): field for field in line.get("fields", [])}
    v.require(set(snapshot_fields) == EXPECTED_SNAPSHOT_FIELDS,
              "compensation snapshot header field closure drift")
    v.require(set(line_fields) == EXPECTED_SNAPSHOT_LINE_FIELDS,
              "compensation snapshot line field closure drift")
    lines = snapshot_fields.get("lines", {})
    v.require(lines.get("type") == "ARRAY",
              "compensation snapshot lines must be an array")
    v.require(lines.get("itemSchemaRef") == "ApprovedCompensationPlanLine.v1"
              and lines.get("minItems") == 1 and lines.get("maxItems") == 100000
              and lines.get("canonicalOrder") == "lineSequence ASC",
              "compensation snapshot line cardinality/order drift")
    header = tables.get("prf_cmp_approved_snapshots", {})
    line_table = tables.get("prf_cmp_approved_snapshot_lines", {})
    v.require(header.get("kind") == "IMMUTABLE_SNAPSHOT_HEADER"
              and header.get("immutability") == "APPEND_ONLY_SUPERSESSION",
              "compensation snapshot header physical contract drift")
    v.require(line_table.get("kind") == "IMMUTABLE_SNAPSHOT_LINE"
              and line_table.get("immutability") == "APPEND_ONLY",
              "compensation snapshot line physical contract drift")
    module_snapshot = capabilities.get(
        "HRIS.MODERN.COMPENSATION_PLANNING", {}
    ).get("approvedSnapshotContract", {})
    v.require(module_snapshot.get("responseSchema")
              == "ApprovedCompensationPlanSnapshot.v1"
              and module_snapshot.get("lineSchema")
              == "ApprovedCompensationPlanLine.v1"
              and "1..100000" in module_snapshot.get("cardinality", "")
              and "line_count equals exact child count"
              in module_snapshot.get("cardinality", "")
              and "serialized ASC" in module_snapshot.get("ordering", "")
              and "ordered line_digest list" in module_snapshot.get("digest", "")
              and "exactly one immutable pay_compensation_plan_inputs row per line"
              in module_snapshot.get("payMaterialization", ""),
              "PER module compensation header/line consumer contract drift")
    line_table_columns = physical_column_map(doc, line_table)
    expected_line_sql = {
        "worker_public_id": "UUID", "assignment_public_id": "UUID",
        "approved_amount": "NUMERIC(19,4)", "line_sequence": "INTEGER",
        "line_digest": "CHAR(64)",
    }
    v.require(all(line_table_columns.get(key, {}).get("sqlType") == value
                  for key, value in expected_line_sql.items()),
              "compensation line physical field/type mapping drift")

    # Arrays must remain lossless and deterministically digestible.
    array_contracts = {
        "modern.analytics.export.create": (
            "metricProjectionIds", "sys_hris_analytics_export_receipts",
            "metric_projection_ids", "metric_projection_ids_digest",
        ),
        "modern.ai.assist.create": (
            "sourceReferenceIds", "sys_hris_ai_provenance_receipts",
            "source_refs", "source_refs_digest",
        ),
    }
    operations = {item.get("operationId", ""): item for item in doc.get("operationBindings", [])}
    for operation_id, (request_name, table_name, column_name, digest_name) in array_contracts.items():
        operation = operations.get(operation_id, {})
        body = {field.get("name"): field for field in operation.get("requestSchema", {}).get("body", [])}
        field = body.get(request_name, {})
        v.require(field.get("type") == "ARRAY<UUID>"
                  and field.get("minItems") == 1 and field.get("maxItems") == 200
                  and field.get("uniqueBy") == ["value"]
                  and field.get("canonicalOrder") == "UUID_BYTE_ASC",
                  f"{operation_id}: canonical UUID array request drift")
        columns = physical_column_map(doc, tables.get(table_name, {}))
        v.require(columns.get(column_name, {}).get("sqlType") == "UUID[]"
                  and columns.get(digest_name, {}).get("sqlType") == "CHAR(64)",
                  f"{operation_id}: array was truncated to scalar or lacks digest")
        module_table = next(
            table
            for capability in capabilities.values()
            for table in capability.get("tables", [])
            if table.get("name") == table_name
        )
        module_array = module_table.get("arrayColumnContracts", [])
        v.require(len(module_array) == 1
                  and module_array[0].get("requestField") == request_name
                  and module_array[0].get("column") == column_name
                  and module_array[0].get("sqlType") == "UUID[]"
                  and module_array[0].get("cardinality") == "1..200"
                  and module_array[0].get("canonicalOrder") == "UUID_BYTE_ASC"
                  and module_array[0].get("duplicates") == "REJECT"
                  and module_array[0].get("digestColumn") == digest_name
                  and "authenticated tenant"
                  in module_array[0].get("tenantValidation", ""),
                  f"{operation_id}: module lossless array contract drift")

    # Every request field and every command sink must have exact, lossless lineage.
    canonical_ops, _ = canonical_operation_and_table_maps(capabilities)
    bindings = {item.get("operationId", ""): item for item in doc.get("operationFieldLineage", [])}
    scope = doc.get("fieldLineageScope", {})
    v.require(scope == {
        "operations": 100,
        "commands": 81,
        "queries": 19,
        "contract": "REQUEST_TO_VALIDATION_DERIVATION_AGGREGATE_OBJECT_REF_TABLE_EVENT_V1",
    }, "field lineage declared scope drift")
    v.require(len(bindings) == 100 and set(bindings) == set(canonical_ops),
              "field lineage must close all 100 operations exactly once")
    event_doc = json.loads(EVENT_PAYLOAD.read_text(encoding="utf-8"))
    event_schemas = {item.get("eventName", ""): item for item in event_doc.get("eventPayloadSchemas", [])}
    for operation_id, exact in operations.items():
        binding = bindings.get(operation_id, {})
        request = exact.get("requestSchema", {})
        expected_inputs: dict[str, dict[str, Any]] = {}

        def add_input(path: str, field: dict[str, Any]) -> None:
            expected_inputs[path] = field
            nested_ref = field.get("schemaRef") or field.get("itemSchemaRef")
            if not nested_ref:
                return
            nested = schemas.get(nested_ref, {})
            marker = "[]" if field.get("itemSchemaRef") else ""
            for member in nested.get("fields", []):
                inherited = dict(member)
                inherited["required"] = bool(field.get("required")) and bool(member.get("required"))
                add_input(path + marker + "." + member.get("name", ""), inherited)

        for section in ("pathParameters", "queryParameters", "headers", "body"):
            for field in request.get(section, []):
                add_input(f"{section}.{field.get('name')}", field)
        input_mappings = {
            item.get("source", ""): item for item in binding.get("inputMappings", [])
        }
        v.require(len(input_mappings) == len(binding.get("inputMappings", []))
                  and set(input_mappings) == set(expected_inputs),
                  f"{operation_id}: required/optional request field lineage gap")
        for source, field in expected_inputs.items():
            mapping = input_mappings.get(source, {})
            v.require(mapping.get("type") == field.get("type")
                      and mapping.get("required") == field.get("required")
                      and mapping.get("validation") == field.get("validation")
                      and bool(mapping.get("derivation"))
                      and bool(mapping.get("aggregateTarget"))
                      and isinstance(mapping.get("sinks"), list)
                      and bool(mapping.get("sinks")),
                      f"{operation_id}.{source}: incomplete request→sink lineage")
        if exact.get("mode") == "COMMAND":
            expected_columns: dict[str, str] = {}
            for table_name in exact.get("writesTables", []):
                spec = tables.get(table_name, {})
                for column in physical_column_map(doc, spec).values():
                    if column.get("nullable") is False and column.get("default") is None:
                        expected_columns[f"{table_name}.{column.get('name')}"] = column.get("sqlType")
            column_sources = {
                item.get("target", ""): item for item in binding.get("requiredColumnSources", [])
            }
            v.require(len(column_sources) == len(binding.get("requiredColumnSources", []))
                      and set(column_sources) == set(expected_columns),
                      f"{operation_id}: NOT NULL/no-default physical column source gap")
            for target, sql_type in expected_columns.items():
                source = column_sources.get(target, {})
                v.require(source.get("sqlType") == sql_type
                          and source.get("sourceKind") in {
                              "REQUEST", "REQUEST_OR_DERIVED", "AUTHENTICATED_CONTEXT",
                              "DERIVED", "STATE_MACHINE", "AGGREGATE",
                              "OBJECT_REFERENCE_RESOLUTION", "OWNER_CLOCK_OR_POLICY",
                              "AGGREGATE_DERIVATION",
                          }
                          and bool(source.get("sourcePath"))
                          and bool(source.get("derivation")),
                          f"{operation_id}.{target}: incomplete column source")
            expected_event_fields = {
                f"{event_name}.{field.get('name')}": field.get("type")
                for event_name in exact.get("eventNames", [])
                for field in event_schemas.get(event_name, {}).get("fields", [])
            }
            event_sources = {
                item.get("target", ""): item for item in binding.get("eventFieldSources", [])
            }
            v.require(len(event_sources) == len(binding.get("eventFieldSources", []))
                      and set(event_sources) == set(expected_event_fields),
                      f"{operation_id}: required event field source gap")
            v.require(all(event_sources.get(target, {}).get("type") == field_type
                          and event_sources.get(target, {}).get("sourceKind") == "AGGREGATE_SNAPSHOT"
                          and bool(event_sources.get(target, {}).get("sourcePath"))
                          for target, field_type in expected_event_fields.items()),
                      f"{operation_id}: event field source/type drift")
            expected_non_digest = {
                source for source, field in expected_inputs.items()
                if field.get("required") and not source.startswith("headers.")
                and re.search(r"(?:digest|hash)", str(field.get("name", "")), re.IGNORECASE) is None
            }
            mutation = binding.get("mutationEvidence", {})
            v.require(set(mutation.get("nonDigestDrivers", [])) == expected_non_digest
                      and bool(expected_non_digest)
                      and mutation.get("digestOnlyMutation") == "FORBIDDEN"
                      and mutation.get("stateTransitionIds") == exact.get("stateTransitionIds"),
                      f"{operation_id}: digest-only mutation protection drift")
        else:
            v.require(binding.get("requiredColumnSources") == []
                      and binding.get("eventFieldSources") == [],
                      f"{operation_id}: query cannot have mutation lineage")
        response_schema = schemas.get(exact.get("responseSchemaRef"), {})
        expected_response = {
            f"{response_schema.get('schemaId')}.{field.get('name')}": field.get("type")
            for field in response_schema.get("fields", [])
        }
        response_sources = {
            item.get("target", ""): item for item in binding.get("responseFieldSources", [])
        }
        v.require(len(response_sources) == len(binding.get("responseFieldSources", []))
                  and set(response_sources) == set(expected_response),
                  f"{operation_id}: response field projection lineage gap")
        v.require(all(response_sources.get(target, {}).get("type") == field_type
                      and bool(response_sources.get(target, {}).get("source"))
                      for target, field_type in expected_response.items()),
                  f"{operation_id}: response source/type drift")
    return {
        "local_composite_fks": local_fk_count,
        "opaque_boundary_refs": opaque_refs,
        "operation_field_lineages": len(bindings),
        "command_field_lineages": sum(item.get("mode") == "COMMAND" for item in bindings.values()),
    }


def validate_exact_schema(
    v: Validation,
    capabilities: dict[str, dict[str, Any]],
) -> dict[str, int]:
    raw = EXACT_SCHEMA.read_text(encoding="utf-8")
    v.require("tenant_id UUID" not in raw and "::uuid" not in raw,
              "exact schema: UUID tenant drift")
    v.require(HARDCODED_RETENTION.search(raw) is None,
              "exact schema: hardcoded numeric retention")
    doc = json.loads(raw)
    v.require(doc.get("contractId") == "dwp.hris.modern.exact-schema.v1"
              and doc.get("schemaVersion") == 1,
              "exact schema: identity/version drift")
    v.require(doc.get("status") == "G3_SCHEMA_CONTRACT_READY_NOT_IMPLEMENTED",
              "exact schema: lifecycle state drift")
    scope = doc.get("scope", {})
    v.require(scope == {
        "ownedCapabilities": EXPECTED_COUNTS["capabilities"],
        "operations": EXPECTED_COUNTS["operations"],
        "physicalTables": EXPECTED_COUNTS["tables"],
        "implementationState": "NOT_STARTED_G3",
        "productionState": "NOT_AUTHORIZED_G6",
        "internalConsumerHandlers": 4,
    }, "exact schema: declared scope/count/state drift")
    policies = doc.get("policies", {})
    v.require(policies.get("tenantIdType") == "BIGINT",
              "exact schema: tenant policy must be BIGINT")
    v.require(policies.get("publicIdType") == "UUID",
              "exact schema: public ID policy must be UUID")
    v.require(policies.get("additionalProperties") == "REJECT",
              "exact schema: unknown-field policy must fail closed")
    v.require(set(policies.get("commandHeaders", []))
              == {"Idempotency-Key", "X-Correlation-ID"},
              "exact schema: command header contract drift")
    v.require(policies.get("concurrencyHeader") == "If-Match",
              "exact schema: concurrency header drift")
    v.require("numeric durations forbidden" in policies.get("retentionResolution", ""),
              "exact schema: retention must resolve by country/tenant policy")

    common = doc.get("commonTableContract", {})
    v.require(common.get("contractId") == "DWP_MODERN_TENANT_TABLE_V1",
              "exact schema: common table ref drift")
    common_names = validate_typed_fields(
        v, common.get("columns"), "commonTableContract.columns", physical=True
    )
    expected_common = {
        "tenant_id", "__internal_id__", "public_id", "aggregate_version",
        "created_at", "created_by", "updated_at", "updated_by", "correlation_id",
    }
    v.require(common_names == expected_common, "exact schema: common column closure drift")
    common_by_name = {
        field.get("name"): field for field in common.get("columns", [])
        if isinstance(field, dict)
    }
    v.require(common_by_name.get("tenant_id", {}).get("sqlType") == "BIGINT"
              and common_by_name.get("tenant_id", {}).get("nullable") is False,
              "exact schema: tenant_id must be BIGINT NOT NULL")
    v.require(common_by_name.get("public_id", {}).get("sqlType") == "UUID"
              and common_by_name.get("public_id", {}).get("nullable") is False,
              "exact schema: public_id must be UUID NOT NULL")
    v.require("::bigint" in common.get("rowSecurity", "")
              and "NOBYPASSRLS" in common.get("rowSecurity", ""),
              "exact schema: RLS BIGINT/NOBYPASSRLS contract drift")

    schema_groups = {
        "commonErrorSchemas": doc.get("commonErrorSchemas", []),
        "recordSchemas": doc.get("recordSchemas", []),
        "responseSchemas": doc.get("responseSchemas", []),
    }
    v.require(len(schema_groups["commonErrorSchemas"]) == 3,
              "exact schema: common error schema count drift")
    v.require(len(schema_groups["recordSchemas"]) == 23,
              "exact schema: 16 capability records plus seven reviewed nested value-object schemas required")
    v.require(len(schema_groups["responseSchemas"]) == 38,
              "exact schema: response schema count drift")
    schemas: dict[str, dict[str, Any]] = {}
    for group_name, group in schema_groups.items():
        v.require(isinstance(group, list), f"exact schema: {group_name} must be a list")
        for schema in group if isinstance(group, list) else []:
            schema_id = schema.get("schemaId", "")
            v.require(schema_id.endswith(".v1") and schema_id not in schemas,
                      f"exact schema: duplicate/unversioned schema {schema_id}")
            if schema_id:
                schemas[schema_id] = schema
            v.require(schema.get("kind") == "OBJECT"
                      and schema.get("additionalProperties") is False,
                      f"{schema_id}: object schema must reject unknown fields")
            validate_typed_fields(v, schema.get("fields"), f"{schema_id}.fields")
    for schema_id, schema in schemas.items():
        for field in schema.get("fields", []):
            if "schemaRef" in field:
                v.require(field["schemaRef"] in schemas,
                          f"{schema_id}.{field.get('name')}: unresolved schemaRef")
            if "itemSchemaRef" in field:
                v.require(field.get("type") == "ARRAY"
                          and field["itemSchemaRef"] in schemas,
                          f"{schema_id}.{field.get('name')}: unresolved itemSchemaRef")

    canonical_ops, canonical_tables = canonical_operation_and_table_maps(capabilities)
    bindings = doc.get("operationBindings", [])
    v.require(len(bindings) == EXPECTED_COUNTS["operations"],
              "exact schema: operation binding count drift")
    binding_ids = [item.get("operationId", "") for item in bindings]
    v.require(len(binding_ids) == len(set(binding_ids))
              and set(binding_ids) == set(canonical_ops),
              "exact schema: operation binding closure drift")
    request_refs: set[str] = set()
    used_response_refs: set[str] = set()
    referenced_tables: set[str] = set()
    for binding in bindings:
        op_id = binding.get("operationId", "")
        if op_id not in canonical_ops:
            continue
        cap_id, canonical = canonical_ops[op_id]
        cap = capabilities[cap_id]
        exact_fields = (
            "method", "path", "action", "authorizationCapability", "scope",
            "mode", "idempotency", "expectedVersion",
        )
        v.require(binding.get("capabilityId") == cap_id
                  and binding.get("session") == cap["session"],
                  f"{op_id}: exact owner binding drift")
        for field in exact_fields:
            v.require(binding.get(field) == canonical.get(field),
                      f"{op_id}: exact {field} drift")
        v.require(binding.get("responseSchemaRef") == canonical.get("response"),
                  f"{op_id}: response schema binding drift")
        v.require(binding.get("responseSchemaRef") in schemas,
                  f"{op_id}: unresolved response schema")
        used_response_refs.add(binding.get("responseSchemaRef", ""))
        v.require(set(binding.get("errorSchemaRefs", []))
                  == {"DwpProblem.v1", "AuthorizationProblem.v1", "ConcurrencyProblem.v1"},
                  f"{op_id}: fail-closed error schemas drift")
        request = binding.get("requestSchema", {})
        request_ref = binding.get("requestSchemaRef", "")
        v.require(request_ref.endswith(".Request.v1")
                  and request.get("schemaId") == request_ref
                  and request_ref not in request_refs,
                  f"{op_id}: unique versioned request schema binding drift")
        request_refs.add(request_ref)
        v.require(request.get("kind") == "OBJECT"
                  and request.get("additionalProperties") is False,
                  f"{op_id}: request must reject unknown fields")
        for section in ("pathParameters", "queryParameters", "headers"):
            validate_typed_fields(v, request.get(section), f"{op_id}.{section}")                 if request.get(section) else v.require(
                    isinstance(request.get(section), list),
                    f"{op_id}.{section}: must be an explicit list",
                )
        validate_typed_fields(v, request.get("body"), f"{op_id}.body")             if request.get("body") else v.require(
                isinstance(request.get("body"), list),
                f"{op_id}.body: must be an explicit list",
            )
        v.require(isinstance(request.get("validationRules"), list)
                  and len(request.get("validationRules", [])) >= 4,
                  f"{op_id}: request validation rules incomplete")
        placeholders = set(re.findall(r"\{([A-Za-z][A-Za-z0-9_]*)\}", binding.get("path", "")))
        path_fields = {
            field.get("name") for field in request.get("pathParameters", [])
            if isinstance(field, dict)
        }
        v.require(placeholders == path_fields,
                  f"{op_id}: URI path-parameter schema drift")
        headers = {
            field.get("name") for field in request.get("headers", [])
            if isinstance(field, dict)
        }
        v.require("X-Correlation-ID" in headers,
                  f"{op_id}: correlation header missing")
        if binding.get("mode") == "COMMAND":
            v.require("Idempotency-Key" in headers and bool(request.get("body")),
                      f"{op_id}: command idempotency/body contract incomplete")
        else:
            v.require(request.get("body") == []
                      and "Idempotency-Key" not in headers,
                      f"{op_id}: query must be body-free/read-safe")
        if binding.get("expectedVersion") == "REQUIRED":
            v.require("If-Match" in headers,
                      f"{op_id}: required optimistic concurrency header missing")
        else:
            v.require("If-Match" not in headers,
                      f"{op_id}: unexpected concurrency header")

        v.require(binding.get("stateTransitionIds") == canonical.get("transitionIds"),
                  f"{op_id}: exact state-transition link drift")
        v.require(binding.get("eventNames") == canonical.get("emits"),
                  f"{op_id}: exact event link drift")
        reads = set(binding.get("readsTables", []))
        writes = set(binding.get("writesTables", []))
        cap_tables = {table["name"] for table in cap["tables"]}
        v.require(reads <= cap_tables and writes <= cap_tables,
                  f"{op_id}: cross-owner/unknown physical table access")
        if binding.get("mode") == "QUERY":
            v.require(bool(reads) and not writes,
                      f"{op_id}: query table access must be read-only and nonempty")
        else:
            v.require(bool(writes),
                      f"{op_id}: command must allocate exact write tables")
        referenced_tables.update(reads | writes)
    v.require(len(request_refs) == EXPECTED_COUNTS["operations"],
              "exact schema: request schema count drift")
    v.require(used_response_refs == {
        schema["schemaId"] for schema in schema_groups["responseSchemas"]
    }, "exact schema: unused/missing response schema")

    specifications = doc.get("tableSpecifications", [])
    v.require(len(specifications) == EXPECTED_COUNTS["tables"],
              "exact schema: physical table specification count drift")
    spec_names = [spec.get("tableName", "") for spec in specifications]
    v.require(len(spec_names) == len(set(spec_names))
              and set(spec_names) == set(canonical_tables),
              "exact schema: physical table closure drift")
    for spec in specifications:
        name = spec.get("tableName", "")
        if name not in canonical_tables:
            continue
        cap_id, canonical = canonical_tables[name]
        cap = capabilities[cap_id]
        v.require(spec.get("capabilityId") == cap_id
                  and spec.get("session") == cap["session"],
                  f"{name}: physical owner drift")
        v.require(spec.get("kind") == canonical.get("kind"),
                  f"{name}: physical kind drift")
        ident = spec.get("idColumn", {})
        v.require(ident.get("name") == canonical.get("idColumn")
                  and ident.get("sqlType") == "BIGINT"
                  and ident.get("nullable") is False
                  and ident.get("exposure") == "INTERNAL_ONLY",
                  f"{name}: internal BIGINT id contract drift")
        v.require(spec.get("commonColumnsRef") == common.get("contractId"),
                  f"{name}: common table contract ref drift")
        business_columns = validate_typed_fields(
            v, spec.get("columns"), f"{name}.columns", physical=True
        )
        v.require(len(business_columns) >= 3,
                  f"{name}: insufficient explicit business columns")
        reserved = expected_common - {"__internal_id__"}
        v.require(not (business_columns & reserved)
                  and ident.get("name") not in business_columns,
                  f"{name}: business/common/id column collision")
        declared = reserved | {ident.get("name")} | business_columns
        for collection, id_key in (
            ("foreignKeys", None),
            ("uniqueKeys", "constraintId"),
            ("checks", "constraintId"),
            ("indexes", "indexId"),
        ):
            items = spec.get(collection, [])
            v.require(isinstance(items, list)
                      and (collection == "foreignKeys" or bool(items)),
                      f"{name}.{collection}: exact constraint/index list missing")
            seen_ids: set[str] = set()
            for item in items if isinstance(items, list) else []:
                columns = item.get("columns", [])
                v.require(isinstance(columns, list) and bool(columns)
                          and set(columns) <= declared,
                          f"{name}.{collection}: undeclared/empty column reference")
                if id_key:
                    item_id = item.get(id_key, "")
                    v.require(bool(item_id) and item_id not in seen_ids,
                              f"{name}.{collection}: duplicate/blank identifier")
                    seen_ids.add(item_id)
                if collection == "foreignKeys":
                    v.require(item.get("mode") in {
                        "LOCAL_COMPOSITE_FK",
                        "OPAQUE_CROSS_BOUNDARY_REFERENCE",
                    } and bool(item.get("target")),
                              f"{name}: invalid FK boundary")
                    if item.get("mode") == "LOCAL_COMPOSITE_FK":
                        v.require("tenant_id" in columns,
                                  f"{name}: local FK must include tenant_id")
                if collection == "uniqueKeys":
                    v.require("tenant_id" in columns,
                              f"{name}: unique key must be tenant bounded")
                if collection == "checks":
                    v.require(bool(item.get("expression")),
                              f"{name}: check expression missing")
        v.require(spec.get("rowSecurity")
                  == "ENABLE_FORCE_DWP_TENANT_BIGINT_NOBYPASSRLS",
                  f"{name}: exact RLS contract drift")
        retention = spec.get("retentionPolicyRef", "")
        v.require(retention == canonical.get("retentionClass")
                  and retention.endswith("_RETENTION_POLICY_REF")
                  and HARDCODED_RETENTION.search(retention) is None,
                  f"{name}: retention must be an exact country/tenant policy ref")
        v.require(spec.get("immutability") == canonical.get("immutability"),
                  f"{name}: immutability drift")
        v.require(spec.get("effectiveTime") == canonical.get("effectiveTime"),
                  f"{name}: effective-time drift")
    for handler in doc.get("internalConsumerHandlers", []):
        v.require(handler.get("handlerId") and handler.get("session")
                  and handler.get("aggregateRootTable") in canonical_tables,
                  "exact schema: internal owner handler identity/root drift")
        handler_tables = set(handler.get("readsTables", [])) | set(handler.get("writesTables", []))
        v.require(handler_tables <= set(canonical_tables),
                  f"{handler.get('handlerId')}: handler references an unknown physical table")
        referenced_tables.update(handler_tables)
    v.require(referenced_tables == set(canonical_tables),
              "exact schema: one or more physical tables are orphaned from all operations")
    feasibility = validate_schema_feasibility(v, doc, capabilities)
    # Presence/shape checks above cannot establish entity identity or that a
    # projection references a real column. Keep this independently tested graph
    # check on the aggregate's authoritative path, even while current contracts
    # are invalid. A self-test PASS must never suppress real-contract failures.
    event_doc = json.loads(EVENT_PAYLOAD.read_text(encoding="utf-8"))
    semantic = validate_semantic_field_lineage(
        doc, event_doc, load_base_tables(), validation_mode="READINESS",
        expected_operation_ids=tuple(sorted(canonical_ops)),
        expected_operation_count=len(canonical_ops),
    )
    v.errors.extend(str(issue) for issue in semantic.errors)
    return {
        "request_schemas": len(request_refs),
        "response_schemas": len(schema_groups["responseSchemas"]),
        "record_schemas": len(schema_groups["recordSchemas"]),
        "table_column_specs": len(specifications),
        **feasibility,
    }


def validate_event_payloads(
    v: Validation,
    capabilities: dict[str, dict[str, Any]],
) -> int:
    raw = EVENT_PAYLOAD.read_text(encoding="utf-8")
    v.require("tenant_id UUID" not in raw and "::uuid" not in raw,
              "event payload: UUID tenant drift")
    doc = json.loads(raw)
    v.require(doc.get("contractId") == "dwp.hris.modern.event-payloads.v1"
              and doc.get("schemaVersion") == 1,
              "event payload: identity/version drift")
    v.require(doc.get("status") == "G3_EVENT_SCHEMA_CONTRACT_READY_NOT_IMPLEMENTED",
              "event payload: lifecycle state drift")
    v.require(doc.get("scope") == {
        "capabilities": EXPECTED_COUNTS["capabilities"],
        "events": EXPECTED_COUNTS["events"],
        "implementationState": "NOT_STARTED_G3",
        "productionState": "NOT_AUTHORIZED_G6",
        "publicCommandPrimaryEvents": 81,
        "conditionalCommandEvents": 1,
        "internalHandlerEvents": 4,
        "operations": 100,
        "commands": 81,
        "queries": 19,
    }, "event payload: declared scope/count/state drift")
    envelope = doc.get("eventEnvelope", {})
    v.require(set(envelope.get("requiredFields", [])) == EXPECTED_ENVELOPE_FIELDS,
              "event payload: envelope fields drift")
    v.require(envelope.get("tenantId", {}).get("type") == "BIGINT",
              "event payload: envelope tenant type must be BIGINT")
    v.require(envelope.get("aggregateId", {}).get("type") == "UUID",
              "event payload: aggregate public ID type drift")
    v.require(envelope.get("data", {}).get("additionalProperties") is False,
              "event payload: data must reject unknown fields")

    canonical: dict[str, tuple[str, dict[str, Any], set[str], set[str]]] = {}
    for cap_id, cap in capabilities.items():
        transition_to_op = {
            transition["transitionId"]: transition["operationId"]
            for machine in cap["stateMachines"]
            for transition in machine["transitions"]
        }
        for event in cap["events"]:
            producers = {transition_to_op[item] for item in event["emittedOn"]}
            operation_ids = {item for item in producers if item.startswith("modern.")}
            handler_ids = producers - operation_ids
            canonical[event["name"]] = (cap_id, event, operation_ids, handler_ids)
    schemas = doc.get("eventPayloadSchemas", [])
    event_names = [schema.get("eventName", "") for schema in schemas]
    v.require(len(schemas) == EXPECTED_COUNTS["events"]
              and len(event_names) == len(set(event_names))
              and set(event_names) == set(canonical),
              "event payload: exact primary/conditional/internal event closure drift")
    payload_schema_ids: set[str] = set()
    for schema in schemas:
        name = schema.get("eventName", "")
        if name not in canonical:
            continue
        cap_id, event, operations, handlers = canonical[name]
        v.require(schema.get("capabilityId") == cap_id
                  and schema.get("session") == capabilities[cap_id]["session"],
                  f"{name}: event owner drift")
        v.require(schema.get("eventType") == event.get("type")
                  and schema.get("schemaVersion") == event.get("version")
                  and schema.get("topic") == event.get("topic"),
                  f"{name}: exact type/version/topic drift")
        schema_id = schema.get("payloadSchemaId", "")
        v.require(schema_id.endswith(".Payload.v2")
                  and schema_id not in payload_schema_ids,
                  f"{name}: duplicate/unversioned payload schema")
        payload_schema_ids.add(schema_id)
        v.require(schema.get("additionalProperties") is False,
                  f"{name}: event payload must reject unknown fields")
        fields = validate_typed_fields(v, schema.get("fields"), f"{name}.payload")
        required_fields = {field.get("name") for field in schema.get("fields", [])
                           if field.get("required") is True}
        v.require(required_fields == set(event.get("payloadRequired", []))
                  and required_fields <= fields,
                  f"{name}: payload required-field closure drift")
        v.require(set(schema.get("emittedOnTransitionIds", []))
                  == set(event.get("emittedOn", [])),
                  f"{name}: payload transition binding drift")
        v.require(set(schema.get("emittedByOperationIds", [])) == operations,
                  f"{name}: payload operation binding drift")
        v.require(set(schema.get("emittedByInternalHandlerIds", [])) == handlers,
                  f"{name}: payload internal-handler binding drift")
    return len(schemas)


def validate_total_table_catalog(
    v: Validation,
    capabilities: dict[str, dict[str, Any]],
) -> tuple[int, int]:
    create_table = re.compile(
        r"^\s*CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-z][a-z0-9_]*)\s*\(",
        re.IGNORECASE | re.MULTILINE,
    )
    base_names: set[str] = set()
    base_count = 0
    for session, path in BASE_SCHEMA_FILES.items():
        v.require(path.is_file(), f"missing base physical schema: {path}")
        if not path.is_file():
            continue
        names = create_table.findall(path.read_text(encoding="utf-8"))
        v.require(len(names) == EXPECTED_BASE_TABLE_COUNTS[session],
                  f"{session}: base physical table count drift")
        v.require(len(names) == len(set(names)),
                  f"{session}: duplicate base physical table declaration")
        overlap = base_names & set(names)
        v.require(not overlap, f"{session}: cross-module base table collision {sorted(overlap)}")
        base_names.update(names)
        base_count += len(names)
    predecessor_modern_names = {
        table["name"] for cap in capabilities.values() for table in cap["tables"]
    }
    listening_predecessor_names = {
        table["name"]
        for table in capabilities["HRIS.MODERN.EMPLOYEE_LISTENING"]["tables"]
    }
    listening_authority = json.loads(LISTENING_AUTHORITY.read_text(encoding="utf-8"))
    listening_successor_names = {
        row.get("tableName", "") for row in listening_authority.get("tableOwnership", [])
    }
    modern_names = predecessor_modern_names - listening_predecessor_names | listening_successor_names
    v.require(base_count == 163 and len(base_names) == 163,
              "base physical table total must remain exact 163")
    v.require(len(predecessor_modern_names) == EXPECTED_COUNTS["tables"],
              "modern predecessor physical table total must remain exact 71")
    v.require(len(listening_successor_names) == 24 and len(modern_names) == 91,
              "active modern physical table total must remain exact 91")
    v.require(not (base_names & modern_names),
              "base and modern physical table names must not overlap")
    planned_total = len(base_names | modern_names)
    v.require(planned_total == 254,
              "planned physical table total must remain exact 254")
    catalog = TARGET_TABLE_CATALOG.read_text(encoding="utf-8")
    v.require("총 163개" in catalog
              and "modern 계획은 나머지 67개" in catalog
              and "합계 91개" in catalog
              and "base 163 + modern 91 = 254개" in catalog
              and "중복은 0" in catalog,
              "target-table-catalog.md must state base163 + active-modern91 = 254, overlap0")
    return base_count, planned_total


def validate_pay_consumer(v: Validation) -> None:
    raw = PAY_CONSUMER.read_text(encoding="utf-8")
    v.require("tenant_id UUID" not in raw and "::uuid" not in raw,
              "PAY consumer UUID tenant drift")
    v.require(not HARDCODED_RETENTION.search(raw),
              "PAY consumer hardcoded retention duration")
    doc = json.loads(raw)
    v.require(doc.get("session") == "HRIS-PAY"
              and doc.get("runtimeOwner") == "dwp-payroll-server",
              "PAY modern consumer owner drift")
    v.require(doc.get("ownedModernCapabilities") == [],
              "PAY must not own Compensation Planning")
    consumed = doc.get("consumedModernCapabilities", [])
    v.require(len(consumed) == 1
              and consumed[0].get("capabilityId") == "HRIS.MODERN.COMPENSATION_PLANNING",
              "PAY compensation consumer closure drift")
    if not consumed:
        return
    item = consumed[0]
    snap = item.get("snapshotContract", {})
    v.require(snap.get("operationId") == "getApprovedCompensationPlanSnapshot"
              and snap.get("ownerPath")
              == "/internal/hris-performance/v1/approved-compensation-plan-snapshots/{snapshotId}"
              and snap.get("serviceAuthBindingId") == "SVC-PEP-PER-001"
              and snap.get("callerWorkload") == "dwp-payroll-server"
              and snap.get("purposeCode")
              == "HRIS_APPROVED_COMPENSATION_PLAN_SNAPSHOT_REFETCH",
              "PAY exact snapshot refetch binding drift")
    v.require(set(snap.get("requiredFields", [])) == EXPECTED_SNAPSHOT_FIELDS,
              "PAY approved compensation snapshot field drift")
    line = snap.get("lineItemSchema", {})
    v.require(line.get("name") == "ApprovedCompensationPlanLine.v1"
              and set(line.get("requiredFields", [])) == EXPECTED_SNAPSHOT_LINE_FIELDS
              and line.get("cardinality") == "1..100000"
              and "lineSequence ASC" in line.get("ordering", "")
              and "binary float forbidden" in line.get("amountEncoding", "")
              and "ordered lineDigest list" in line.get("digestRule", ""),
              "PAY approved compensation line schema/cardinality drift")
    v.require(snap.get("projectionCardinality", "").startswith(
                  "exactly one immutable header and 1..100000 immutable lines"
              ) and "lineCount equals lines.length" in snap.get("projectionCardinality", ""),
              "PAY snapshot projection cardinality drift")
    materialization = snap.get("fieldMaterialization", {})
    expected_header_mapping = EXPECTED_SNAPSHOT_FIELDS - {"lines"}
    expected_line_mapping = {f"lines[].{name}" for name in EXPECTED_SNAPSHOT_LINE_FIELDS}
    v.require(set(materialization.get("header", {})) == expected_header_mapping,
              "PAY snapshot header materialization field gap")
    v.require(set(materialization.get("perLine", {})) == expected_line_mapping,
              "PAY snapshot line materialization field gap")
    v.require(materialization.get("container") == {
        "lines": "perLine mapping; all items materialize atomically in canonical lineSequence order"
    }, "PAY snapshot lines container mapping drift")
    v.require("one pay_compensation_plan_inputs row per lines[] item"
              in materialization.get("cardinality", "")
              and "row count must equal lineCount" in materialization.get("cardinality", ""),
              "PAY line-to-input exact cardinality rule missing")
    event = item.get("invalidationEvent", {})
    v.require(event.get("name") == "ApprovedCompensationPlanSnapshotPublished.v2"
              and event.get("type") == "ApprovedCompensationPlanSnapshotPublished"
              and event.get("version") == 2
              and event.get("topic") ==
              "dwp.hris.modern.approved-compensation-plan-snapshot-published.v2"
              and set(event.get("payloadRequired", []))
              == EXPECTED_COMPENSATION_EVENT_V2_FIELDS,
              "PAY compensation invalidation event drift")
    v.require(
        event.get("name") != "CompensationPlanApproved.v1"
        and "CompensationPlanApproved.v1" in event.get("consumerAction", "")
        and "never trigger PAY" in event.get("consumerAction", "")
        and "dual publish is forbidden" in event.get("consumerAction", ""),
        "PAY predecessor/dual-publish trigger authority drift",
    )
    v.require(set(event.get("requiredEnvelope", [])) == EXPECTED_ENVELOPE_FIELDS,
              "PAY consumer event envelope drift")
    input_table = next(
        (table for table in item.get("tables", [])
         if table.get("name") == "pay_compensation_plan_inputs"),
        {},
    )
    physical_columns = {
        column.get("name"): column
        for column in input_table.get("physicalColumnContract", [])
    }
    expected_physical_sources = (
        set(materialization.get("header", {}).values())
        | set(materialization.get("perLine", {}).values())
    )
    v.require({f"pay_compensation_plan_inputs.{name}" for name in physical_columns}
              == expected_physical_sources,
              "PAY materialization mapping and physical column closure drift")
    v.require(all(column.get("sqlType") != "BIGINT"
                  for name, column in physical_columns.items()
                  if name.endswith("_id") and name not in {"snapshot_revision", "source_version"}),
              "PAY public/cross-boundary ID cannot use BIGINT")
    v.require("(tenant_id,snapshot_id,snapshot_revision,source_line_id)"
              in input_table.get("uniqueKeys", [])
              and "(tenant_id,snapshot_id,snapshot_revision,line_sequence)"
              in input_table.get("uniqueKeys", []),
              "PAY snapshot line id/sequence idempotency keys missing")
    v.require(item.get("migrationFile")
              == "dwp-payroll-server/src/main/resources/db/migration/V49__pay_modern_compensation_plan_input.sql",
              "PAY consumer migration drift")
    tables = item.get("tables", [])
    v.require(len(tables) == EXPECTED_COUNTS["pay_consumer_tables"],
              "PAY consumer table count drift")
    v.require({t.get("name") for t in tables}
              == {"pay_compensation_plan_inputs", "pay_input_snapshot_compensation_refs"},
              "PAY consumer table allocation drift")
    v.require(item.get("physicalTableDefaults", {}).get("tenantColumn")
              == "tenant_id BIGINT NOT NULL", "PAY consumer tenant type drift")
    for table in tables:
        v.require(table.get("rowSecurity") == "INHERIT_EXACT_DEFAULT",
                  f"{table.get('name')}: PAY RLS drift")
        v.require(not HARDCODED_RETENTION.search(table.get("retentionClass", "")),
                  f"{table.get('name')}: PAY retention duration hardcoded")
    v.require(len(item.get("acceptanceTests", [])) == 3,
              "PAY consumer exact three acceptance tests required")


def run_negative_self_tests(
    capabilities: dict[str, dict[str, Any]],
) -> tuple[int, list[str]]:
    """Prove representative schema/lineage defects cannot pass the gate."""
    base = json.loads(EXACT_SCHEMA.read_text(encoding="utf-8"))
    cases: list[tuple[str, str, Any]] = []

    def remove_input(doc: dict[str, Any]) -> None:
        doc["operationFieldLineage"][0]["inputMappings"].pop()

    def remove_column_source(doc: dict[str, Any]) -> None:
        command = next(
            item for item in doc["operationFieldLineage"]
            if item["mode"] == "COMMAND" and item["requiredColumnSources"]
        )
        command["requiredColumnSources"].pop()

    def allow_digest_only(doc: dict[str, Any]) -> None:
        command = next(
            item for item in doc["operationFieldLineage"]
            if item["mode"] == "COMMAND"
        )
        command["mutationEvidence"]["nonDigestDrivers"] = []

    def leak_internal_id(doc: dict[str, Any]) -> None:
        table = next(
            item for item in doc["tableSpecifications"]
            if item["tableName"] == "ppl_rec_offers"
        )
        column = next(
            item for item in table["columns"]
            if item["name"] == "compensation_policy_version_id"
        )
        column["sqlType"] = "BIGINT"

    def expose_public_record_bigint(doc: dict[str, Any]) -> None:
        schema = next(
            item for item in doc["recordSchemas"]
            if item["schemaId"] == "HRIS.MODERN.BENEFITS_ADMIN.Record.v1"
        )
        field = next(
            item for item in schema["fields"]
            if item["name"] == "eligibilityPolicyVersionId"
        )
        field["type"] = "BIGINT"

    def break_enum_sql(doc: dict[str, Any]) -> None:
        table = next(
            item for item in doc["tableSpecifications"]
            if item["tableName"] == "ppl_rec_requisitions"
        )
        table["checks"][0]["expression"] = "status IN (DRAFT,OPEN)"

    def remove_candidate_key(doc: dict[str, Any]) -> None:
        table = next(
            item for item in doc["tableSpecifications"]
            if item["tableName"] == "ppl_rec_requisitions"
        )
        table["uniqueKeys"] = [
            item for item in table["uniqueKeys"]
            if item["columns"] != ["tenant_id", "requisition_id"]
        ]

    def break_fk_type(doc: dict[str, Any]) -> None:
        table = next(
            item for item in doc["tableSpecifications"]
            if item["tableName"] == "ppl_rec_candidate_cases"
        )
        column = next(
            item for item in table["columns"]
            if item["name"] == "requisition_id"
        )
        column["sqlType"] = "UUID"

    def break_fk_order(doc: dict[str, Any]) -> None:
        table = next(
            item for item in doc["tableSpecifications"]
            if item["tableName"] == "ppl_rec_candidate_cases"
        )
        fk = next(
            item for item in table["foreignKeys"]
            if item["mode"] == "LOCAL_COMPOSITE_FK"
        )
        fk["targetColumns"] = list(reversed(fk["targetColumns"]))

    def truncate_array(doc: dict[str, Any]) -> None:
        table = next(
            item for item in doc["tableSpecifications"]
            if item["tableName"] == "sys_hris_analytics_export_receipts"
        )
        column = next(
            item for item in table["columns"]
            if item["name"] == "metric_projection_ids"
        )
        column["sqlType"] = "UUID"

    def break_snapshot_cardinality(doc: dict[str, Any]) -> None:
        schema = next(
            item for item in doc["responseSchemas"]
            if item["schemaId"] == "ApprovedCompensationPlanSnapshot.v1"
        )
        lines = next(item for item in schema["fields"] if item["name"] == "lines")
        lines["minItems"] = 0

    def remove_event_source(doc: dict[str, Any]) -> None:
        command = next(
            item for item in doc["operationFieldLineage"]
            if item["mode"] == "COMMAND" and item["eventFieldSources"]
        )
        command["eventFieldSources"].pop()

    def remove_response_source(doc: dict[str, Any]) -> None:
        doc["operationFieldLineage"][0]["responseFieldSources"].pop()

    cases.extend([
        ("REQUEST_INPUT_UNMAPPED", "request field lineage gap", remove_input),
        ("REQUIRED_COLUMN_UNSOURCED", "physical column source gap", remove_column_source),
        ("DIGEST_ONLY_MUTATION", "digest-only mutation protection drift", allow_digest_only),
        ("OPAQUE_BIGINT_LEAK", "cross-boundary BIGINT reference forbidden", leak_internal_id),
        ("PUBLIC_RECORD_BIGINT_LEAK", "public record ID cannot be BIGINT", expose_public_record_bigint),
        ("UNQUOTED_ENUM_SQL", "enum SQL literal is not quoted", break_enum_sql),
        ("LOCAL_FK_WITHOUT_CANDIDATE_KEY", "target candidate key missing", remove_candidate_key),
        ("LOCAL_FK_TYPE_MISMATCH", "FK SQL type/order mismatch", break_fk_type),
        ("LOCAL_FK_ORDER_MISMATCH", "source/target FK column order drift", break_fk_order),
        ("ARRAY_TRUNCATED_TO_SCALAR", "array was truncated to scalar", truncate_array),
        ("SNAPSHOT_CARDINALITY_DRIFT", "line cardinality/order drift", break_snapshot_cardinality),
        ("EVENT_FIELD_UNSOURCED", "required event field source gap", remove_event_source),
        ("RESPONSE_FIELD_UNSOURCED", "response field projection lineage gap", remove_response_source),
    ])
    failures: list[str] = []
    for case_id, expected_message, mutate in cases:
        candidate = copy.deepcopy(base)
        mutate(candidate)
        result = Validation()
        validate_schema_feasibility(result, candidate, capabilities)
        if not any(expected_message in error for error in result.errors):
            failures.append(
                f"{case_id}: mutation was not rejected with {expected_message!r}"
            )
    migration_cases = [
        (
            "PER_OLD_SHARED_STREAM_VERSION",
            "dwp-people-server/src/main/resources/db/migration/V84__per_modern_skills_ontology.sql",
        ),
        (
            "PER_CORRECT_VERSION_WRONG_STREAM",
            "dwp-people-server/src/main/resources/db/migration/V17__per_modern_skills_ontology.sql",
        ),
        (
            "PER_CORRECT_STREAM_WRONG_SUFFIX",
            "dwp-people-server/src/main/resources/db/performance-migration/V17__per_modern_skills.sql",
        ),
    ]
    for case_id, migration_file in migration_cases:
        result = Validation()
        validate_migration_assignment(
            result,
            "HRIS.MODERN.SKILLS_ONTOLOGY",
            "HRIS-PER",
            migration_file,
        )
        if not any("migration version/path drift" in error for error in result.errors):
            failures.append(f"{case_id}: migration path mutation was not rejected")
    trace_rows = read_csv(TRACE)[1]
    event_payload = json.loads(EVENT_PAYLOAD.read_text(encoding="utf-8"))
    lineage = json.loads(EVENT_LINEAGE.read_text(encoding="utf-8"))

    def trace_case(case_id: str, expected_message: str, mutate: Any) -> None:
        candidate_trace = copy.deepcopy(trace_rows)
        candidate_lineage = copy.deepcopy(lineage)
        mutate(candidate_trace, candidate_lineage)
        result = Validation()
        validate_trace_v2_lineage(
            result, candidate_trace, copy.deepcopy(event_payload), candidate_lineage
        )
        if not any(expected_message in error for error in result.errors):
            failures.append(
                f"{case_id}: mutation was not rejected with {expected_message!r}"
            )

    def compensation_trace(rows: list[dict[str, str]]) -> dict[str, str]:
        return next(
            row for row in rows
            if row["capability_id"] == "HRIS.MODERN.COMPENSATION_PLANNING"
        )

    def replace_v2_with_v1(
        rows: list[dict[str, str]], _lineage: dict[str, Any]
    ) -> None:
        row = compensation_trace(rows)
        refs = pipe_set(row["api_event_contracts"])
        refs.remove("ApprovedCompensationPlanSnapshotPublished.v2")
        refs.add("CompensationPlanApproved.v1")
        row["api_event_contracts"] = "|".join(sorted(refs))

    def add_dual_publish(
        rows: list[dict[str, str]], _lineage: dict[str, Any]
    ) -> None:
        row = compensation_trace(rows)
        row["api_event_contracts"] = "|".join(
            sorted(pipe_set(row["api_event_contracts"]) | {"CompensationPlanApproved.v1"})
        )

    def remove_successor(
        rows: list[dict[str, str]], _lineage: dict[str, Any]
    ) -> None:
        row = compensation_trace(rows)
        row["api_event_contracts"] = "|".join(
            sorted(
                pipe_set(row["api_event_contracts"])
                - {"ApprovedCompensationPlanSnapshotPublished.v2"}
            )
        )

    def require_dual_publish(
        _rows: list[dict[str, str]], candidate_lineage: dict[str, Any]
    ) -> None:
        item = next(
            row for row in candidate_lineage["lineage"]
            if row["predecessorEvent"] == "CompensationPlanApproved.v1"
        )
        item["runtimeDualPublish"]["required"] = True

    trace_case(
        "TRACE_V2_TO_V1", "predecessor or non-v2 event remains active", replace_v2_with_v1
    )
    trace_case(
        "TRACE_DUAL_PUBLISH", "predecessor or non-v2 event remains active", add_dual_publish
    )
    trace_case(
        "TRACE_SUCCESSOR_OMITTED", "exact lineage successor v2 event set", remove_successor
    )
    trace_case(
        "LINEAGE_DUAL_PUBLISH_ENABLED",
        "runtime dual-publish authority must remain false",
        require_dual_publish,
    )
    return len(cases) + len(migration_cases) + 4, failures


def build_postgres_feasibility_ddl(doc: dict[str, Any]) -> str:
    """Render all modern table specs into executable PostgreSQL 16 DDL."""
    common = [
        item for item in doc["commonTableContract"]["columns"]
        if item["name"] != "__internal_id__"
    ]
    statements = [
        "BEGIN",
        "CREATE EXTENSION IF NOT EXISTS pgcrypto",
    ]
    for table_number, spec in enumerate(doc["tableSpecifications"], start=1):
        definitions: list[str] = []
        ident = spec["idColumn"]
        definitions.append(
            f"{ident['name']} BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY"
        )
        for column in common + spec["columns"]:
            definition = f"{column['name']} {column['sqlType']}"
            if column.get("default") is not None:
                definition += f" DEFAULT {column['default']}"
            if column.get("nullable") is False:
                definition += " NOT NULL"
            definitions.append(definition)
        statements.append(
            f"CREATE TABLE {spec['tableName']} (\n  "
            + ",\n  ".join(definitions)
            + "\n)"
        )
        for key_number, key in enumerate(spec["uniqueKeys"], start=1):
            columns = ", ".join(key["columns"])
            statements.append(
                f"ALTER TABLE {spec['tableName']} ADD CONSTRAINT "
                f"m{table_number}_uk{key_number} UNIQUE ({columns})"
            )
        for check_number, check in enumerate(spec["checks"], start=1):
            statements.append(
                f"ALTER TABLE {spec['tableName']} ADD CONSTRAINT "
                f"m{table_number}_ck{check_number} CHECK ({check['expression']})"
            )
        statements.append(
            f"ALTER TABLE {spec['tableName']} ENABLE ROW LEVEL SECURITY"
        )
        statements.append(
            f"ALTER TABLE {spec['tableName']} FORCE ROW LEVEL SECURITY"
        )
    tables = {item["tableName"]: item for item in doc["tableSpecifications"]}
    for table_number, spec in enumerate(doc["tableSpecifications"], start=1):
        local_number = 0
        for fk in spec["foreignKeys"]:
            if fk["mode"] != "LOCAL_COMPOSITE_FK":
                continue
            local_number += 1
            source_columns = ", ".join(fk["columns"])
            target_columns = ", ".join(fk["targetColumns"])
            if fk["target"] not in tables:
                raise ValueError(f"unknown FK target {fk['target']}")
            statements.append(
                f"ALTER TABLE {spec['tableName']} ADD CONSTRAINT "
                f"m{table_number}_fk{local_number} FOREIGN KEY ({source_columns}) "
                f"REFERENCES {fk['target']} ({target_columns})"
            )
    statements.extend(["ROLLBACK", ""])
    return ";\n".join(statements)


def run_postgres_feasibility() -> tuple[bool, str]:
    """Compile the generated DDL in a disposable PostgreSQL 16 container."""
    doc = json.loads(EXACT_SCHEMA.read_text(encoding="utf-8"))
    ddl = build_postgres_feasibility_ddl(doc)
    container_name = f"dwp-modern-schema-{os.getpid()}"
    try:
        probe = subprocess.run(
            ["docker", "version"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        if probe.returncode != 0:
            return False, "docker unavailable: " + probe.stderr.strip()
        start = subprocess.run(
            [
                "docker", "run", "--rm", "--detach", "--name", container_name,
                "--env", "POSTGRES_PASSWORD=dwp_feasibility_only",
                "--env", "POSTGRES_DB=modern_contract",
                "postgres:16-alpine",
            ],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
        if start.returncode != 0:
            return False, "postgres container start failed: " + start.stderr.strip()
        ready = False
        for _ in range(30):
            check = subprocess.run(
                [
                    "docker", "exec", container_name, "psql",
                    "-U", "postgres", "-d", "modern_contract",
                    "-Atqc", "SELECT 1",
                ],
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            if check.returncode == 0:
                ready = True
                break
            time.sleep(0.25)
        if not ready:
            return False, "postgres container did not become ready"
        compile_result = subprocess.run(
            [
                "docker", "exec", "-i", container_name,
                "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres",
                "-d", "modern_contract",
            ],
            input=ddl,
            capture_output=True,
            text=True,
            timeout=40,
            check=False,
        )
        if compile_result.returncode != 0:
            return False, compile_result.stderr.strip()
        return True, (
            f"postgres=16 tables={len(doc['tableSpecifications'])} "
            f"checks={sum(len(item['checks']) for item in doc['tableSpecifications'])} "
            f"local_fks={sum(1 for item in doc['tableSpecifications'] for fk in item['foreignKeys'] if fk['mode'] == 'LOCAL_COMPOSITE_FK')}"
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return False, str(exc)
    finally:
        subprocess.run(
            ["docker", "rm", "--force", container_name],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--compact", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--postgres-feasibility", action="store_true")
    args = parser.parse_args()
    v = Validation()
    schema_counts: dict[str, int] = {}
    event_payload_count = 0
    base_table_count = 0
    planned_table_count = 0
    try:
        capabilities, counts = validate_contracts(v)
        validate_summary(v, capabilities)
        validate_existing_registers(v, capabilities)
        validate_menu(v, capabilities)
        validate_authorization(v, capabilities)
        schema_counts = validate_exact_schema(v, capabilities)
        event_payload_count = validate_event_payloads(v, capabilities)
        base_table_count, planned_table_count = validate_total_table_catalog(v, capabilities)
        validate_pay_consumer(v)
        if args.self_test:
            self_test_count, self_test_failures = run_negative_self_tests(capabilities)
            for failure in self_test_failures:
                v.errors.append("negative self-test: " + failure)
            semantic_self_test_count, semantic_self_test_ok = run_semantic_self_tests()
            v.require(semantic_self_test_ok, "semantic lineage healthy/negative self-tests failed")
            print("MODERN_SEMANTIC_LINEAGE_SELF_TESTS=" + ("PASS" if semantic_self_test_ok else "FAIL")
                  + f" cases={semantic_self_test_count}", flush=True)
        else:
            self_test_count = 0
        if args.postgres_feasibility:
            postgres_ok, postgres_detail = run_postgres_feasibility()
            v.require(postgres_ok, "PostgreSQL feasibility: " + postgres_detail)
        else:
            postgres_ok, postgres_detail = False, ""
    except (OSError, KeyError, ValueError, json.JSONDecodeError) as exc:
        v.errors.append(f"validator exception: {exc}")

    if v.errors:
        print(f"MODERN_CAPABILITY_CONTRACTS=FAIL errors={len(v.errors)}")
        for error in v.errors if not args.compact else v.errors[:20]:
            print(f"- {error}")
        return 1
    print(
        "MODERN_CAPABILITY_CONTRACTS=PASS "
        f"capabilities={counts['capabilities']} "
        f"operations={counts['operations']} "
        f"menu_nodes={EXPECTED_COUNTS['menu_nodes']} "
        f"auth_bindings={EXPECTED_COUNTS['authorization_bindings']} "
        f"state_machines={counts['state_machines']} "
        f"transitions={counts['transitions']} "
        f"events={counts['events']} "
        f"tables={counts['tables']} "
        f"pay_consumer_tables={EXPECTED_COUNTS['pay_consumer_tables']} "
        f"acceptance_tests={counts['acceptance_tests']} "
        "implementation=NOT_STARTED_G3 production=NOT_AUTHORIZED_G6"
    )
    print(
        "MODERN_EXACT_SCHEMAS=PASS "
        f"request_schemas={schema_counts['request_schemas']} "
        f"response_schemas={schema_counts['response_schemas']} "
        f"record_schemas={schema_counts['record_schemas']} "
        f"event_payload_schemas={event_payload_count} "
        f"table_column_specs={schema_counts['table_column_specs']} "
        f"base_tables={base_table_count} planned_tables={planned_table_count} overlap=0"
    )
    if args.self_test:
        print(f"MODERN_SCHEMA_NEGATIVE_SELF_TESTS=PASS cases={self_test_count}")
    if args.postgres_feasibility:
        print(f"MODERN_POSTGRES_FEASIBILITY=PASS {postgres_detail}")
    return 0


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
