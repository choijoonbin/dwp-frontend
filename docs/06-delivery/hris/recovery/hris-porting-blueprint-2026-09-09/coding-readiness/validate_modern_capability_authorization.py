#!/usr/bin/env python3
"""Fail-closed authorization closure for the 16 planned modern HRIS capabilities.

The 48 rows validated here are planned G3 authorization operations.  They are
deliberately not counted as implemented/public API operations in the existing
API PEP register.  A future implementation must first add an exact versioned
API contract and then migrate the affected row through a reviewed gate change.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import pathlib
import re
import sys
from collections import Counter, defaultdict
from typing import Any


HERE = pathlib.Path(__file__).resolve().parent
BLUEPRINT = HERE.parent
REGISTER = HERE / "modern-capability-authorization-register.csv"
TRACE = HERE / "modern-capability-trace-register.csv"
ATOMIC_DUTIES = BLUEPRINT / "hris-atomic-duty-matrix.csv"
PERSONA_PACKAGES = BLUEPRINT / "hris-permission-group-matrix.csv"
PUBLIC_API_PEP = HERE / "api-pep-binding-register.csv"
EXACT_CAPABILITY_CONTRACTS = (
    BLUEPRINT / "session-evidence/hrm/g3-modern-capability-contracts.v1.json",
    BLUEPRINT / "session-evidence/per/g3-modern-capability-contracts.v2.json",
    BLUEPRINT / "session-evidence/tim/g3-modern-capability-contracts.v1.json",
    BLUEPRINT / "session-evidence/sys/g3-modern-capability-contracts.v1.json",
)

EXPECTED_REGISTER_SHA256 = "c6e44f59f1ac258ddcb9e54a89fdbd5c5495aa8bb2f68f2029056ee6a9f15cac"
EXPECTED_APP_ENTITLEMENT = "APP.HCM:VIEW"
EXPECTED_PERSONA_CATEGORIES = {
    "EMPLOYEE",
    "MANAGER",
    "OPERATIONS",
    "CONFIGURATION",
    "AUDIT",
}
EXPECTED_ENFORCEMENT_LAYERS = {
    "GATEWAY_APP_ENTITLEMENT",
    "OWNER_API_OPERATION",
    "RESOURCE_POPULATION",
    "REPOSITORY_TENANT_PREDICATE",
    "FIELD_PROJECTION",
    "PURPOSE_POLICY",
    "AUDIT_DECISION",
}
EXPECTED_MODULE_SERVICES = {
    "HRIS-HRM": "dwp-people-server",
    "HRIS-PER": "dwp-people-server",
    "HRIS-TIM": "dwp-time-server",
    "HRIS-PAY": "dwp-payroll-server",
    "HRIS-SYS": "dwp-platform-server",
}
EXPECTED_ROUTE_PREFIXES = {
    "HRIS-HRM": ("/api/people/v1/hris/",),
    "HRIS-PER": ("/api/people/v1/hris/performance/",),
    "HRIS-TIM": ("/api/time/v1/",),
    "HRIS-PAY": ("/api/payroll/v1/",),
    "HRIS-SYS": ("/api/platform/v1/admin/hris/", "/api/platform/v1/hris/"),
}
EXPECTED_REGISTER_HEADER = [
    "binding_id",
    "modern_capability_id",
    "owner_session",
    "implementation_slice_id",
    "planned_operation_id",
    "operation_kind",
    "planned_route_pattern",
    "menu_node_key",
    "owner_service",
    "canonical_app_entitlement",
    "persona_categories",
    "authorization_profiles",
    "canonical_capability_key",
    "canonical_resource_type",
    "canonical_resource_key",
    "canonical_action",
    "canonical_population_types",
    "canonical_field_group_keys",
    "purpose_code",
    "enforcement_layers",
    "public_api_coverage_state",
    "implementation_state",
    "production_state",
    "source_trace_ref",
]
EXPECTED_DUTY_FIELDS = {
    "duty_code",
    "menu_node_key",
    "capability_key",
    "resource_type",
    "resource_key",
    "permission_code",
    "owner_service",
    "population_types",
    "field_group_keys",
    "package_codes",
    "implementation_status",
    "api_pep_status",
    "ui_projection_status",
}
EXPECTED_PACKAGE_FIELDS = {
    "package_code",
    "package_category",
    "canonical_app_entitlement",
    "atomic_duty_codes",
}
MODERN_DUTY_STATE = "PLANNED_G3_NOT_IMPLEMENTED"
MODERN_API_STATE = "PLANNED_OPERATION_NO_PUBLIC_API_YET"
MODERN_UI_STATE = "PLANNED_REQUIRED_NOT_IMPLEMENTED"
REGISTER_IMPLEMENTATION_STATE = "PLANNED_G3_AUTHORIZATION_NOT_IMPLEMENTED"
REGISTER_PUBLIC_API_STATE = "PLANNED_NOT_COUNTED_IN_IMPLEMENTED_PUBLIC_API"
REGISTER_PRODUCTION_STATE = "NOT_AUTHORIZED_G6"
TOKEN = re.compile(r"^[A-Z][A-Z0-9_]*$")
CAPABILITY = re.compile(r"^hcm\.[a-z0-9.-]+$")
OPERATION = re.compile(r"^MODOP\.[A-Z0-9._]+$")
RESOURCE = re.compile(r"^(?:ACTION|CONFIG|DATA)\.[A-Z0-9_]+$")


def pipe_set(value: str) -> set[str]:
    return {part.strip() for part in value.split("|") if part.strip()}


def read_csv(path: pathlib.Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def route_pattern_covers(patterns: str, path: str) -> bool:
    """Match an exact union of canonical ``/root/**`` patterns.

    A capability may legitimately own operations below sibling collection roots
    (for example ``opportunities`` and ``opportunity-applications``).  Keeping
    those roots explicit avoids widening the authorization contract to the
    entire bounded-context API family.
    """
    for pattern in pipe_set(patterns):
        if not pattern.endswith("/**") or "*" in pattern[:-3]:
            continue
        root = pattern[:-3]
        if path == root or path.startswith(root + "/"):
            return True
    return False


def validate() -> dict[str, Any]:
    findings: dict[str, list[str]] = defaultdict(list)

    def require(category: str, condition: bool, message: str) -> None:
        if not condition:
            findings[category].append(message)

    register_header, rows = read_csv(REGISTER)
    trace_header, traces = read_csv(TRACE)
    duty_header, duty_rows = read_csv(ATOMIC_DUTIES)
    package_header, package_rows = read_csv(PERSONA_PACKAGES)
    pep_header, pep_rows = read_csv(PUBLIC_API_PEP)

    exact_capabilities: dict[str, dict[str, Any]] = {}
    exact_operation_count = 0
    for contract_path in EXACT_CAPABILITY_CONTRACTS:
        try:
            contract = json.loads(contract_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            findings["exactOperationContract"].append(
                f"cannot read exact capability contract {contract_path}: {error}"
            )
            continue
        for capability in contract.get("capabilities", []):
            capability_id = capability.get("capabilityId", "")
            if not capability_id or capability_id in exact_capabilities:
                findings["exactOperationContract"].append(
                    f"blank or duplicate exact capability {capability_id} in {contract_path.name}"
                )
                continue
            exact_capabilities[capability_id] = capability
            exact_operation_count += len(capability.get("operations", []))

    require(
        "registerIntegrity",
        register_header == EXPECTED_REGISTER_HEADER,
        f"register header mismatch: {register_header}",
    )
    require(
        "registerIntegrity",
        sha256(REGISTER) == EXPECTED_REGISTER_SHA256,
        f"register digest drift: {sha256(REGISTER)}",
    )
    require(
        "globalMatrixIntegrity",
        EXPECTED_DUTY_FIELDS <= set(duty_header),
        "atomic duty matrix columns incomplete",
    )
    require(
        "globalMatrixIntegrity",
        EXPECTED_PACKAGE_FIELDS <= set(package_header),
        "persona package matrix columns incomplete",
    )
    require(
        "exactOperationContract",
        len(exact_capabilities) == 16 and set(exact_capabilities) == set(trace_by_id),
        "exact capability contract/trace set must be the same 16 capabilities; "
        f"exact={len(exact_capabilities)} trace={len(trace_by_id)}",
    )

    trace_by_id: dict[str, dict[str, str]] = {}
    trace_by_capability: dict[str, dict[str, str]] = {}
    duplicate_trace_capabilities: set[str] = set()
    for line, trace in enumerate(traces, 2):
        capability_id = trace.get("capability_id", "")
        if capability_id in trace_by_id:
            findings["traceCoverage"].append(
                f"trace line {line}: duplicate capability_id {capability_id}"
            )
        trace_by_id[capability_id] = trace
        require(
            "notImplementedBoundary",
            trace.get("state") == "ALLOCATED_REQUIRED_NOT_STARTED",
            f"trace line {line}: implementation state is overstated",
        )
        routes = [
            item
            for item in pipe_set(trace.get("api_event_contracts", ""))
            if item.startswith("/api/")
        ]
        require(
            "routeOwnerBinding",
            bool(routes) and len(routes) == len(set(routes)),
            f"trace line {line}: one or more unique planned browser route patterns required",
        )
        trace_prefixes = EXPECTED_ROUTE_PREFIXES.get(trace.get("owner_session", ""), ())
        require(
            "routeOwnerBinding",
            bool(routes)
            and all(
                route.endswith("/**")
                and "*" not in route[:-3]
                and any(route.startswith(prefix) for prefix in trace_prefixes)
                for route in routes
            ),
            f"trace line {line}: route family reference is outside its owner session",
        )
        for capability_key in pipe_set(trace.get("authorization_capabilities", "")):
            if capability_key in trace_by_capability:
                duplicate_trace_capabilities.add(capability_key)
            trace_by_capability[capability_key] = {
                **trace,
                "planned_trace_route_patterns": "|".join(sorted(routes)),
            }
    require(
        "traceCoverage",
        len(traces) == 16 and len(trace_by_id) == 16,
        f"modern trace must contain 16 unique capabilities; rows={len(traces)} unique={len(trace_by_id)}",
    )
    require(
        "traceCoverage",
        len(trace_by_capability) == 48 and not duplicate_trace_capabilities,
        "trace authorization capability coverage must be exactly 48 unique keys; "
        f"unique={len(trace_by_capability)} duplicates={sorted(duplicate_trace_capabilities)}",
    )

    duties: dict[str, dict[str, str]] = {}
    duplicate_duties: set[str] = set()
    for duty in duty_rows:
        duty_code = duty.get("duty_code", "")
        if duty_code in duties:
            duplicate_duties.add(duty_code)
        duties[duty_code] = duty
    packages: dict[str, dict[str, str]] = {}
    duplicate_packages: set[str] = set()
    for package in package_rows:
        package_code = package.get("package_code", "")
        if package_code in packages:
            duplicate_packages.add(package_code)
        packages[package_code] = package
    require(
        "globalMatrixIntegrity",
        not duplicate_duties,
        f"duplicate global duty IDs: {sorted(duplicate_duties)}",
    )
    require(
        "globalMatrixIntegrity",
        len(package_rows) == 31 and len(packages) == 31 and not duplicate_packages,
        f"persona package matrix must contain 31 unique packages; rows={len(package_rows)} unique={len(packages)}",
    )
    require(
        "fivePersonaClosure",
        {row.get("package_category", "") for row in package_rows}
        == EXPECTED_PERSONA_CATEGORIES,
        "global package categories must be exactly employee/manager/operations/configuration/audit",
    )

    binding_ids: set[str] = set()
    operation_ids: set[str] = set()
    register_capabilities: set[str] = set()
    referenced_duties: set[str] = set()
    module_counts: Counter[str] = Counter()
    persona_counts: Counter[str] = Counter()
    for line, row in enumerate(rows, 2):
        binding_id = row.get("binding_id", "")
        capability_key = row.get("canonical_capability_key", "")
        operation_id = row.get("planned_operation_id", "")
        require(
            "registerIntegrity",
            binding_id not in binding_ids,
            f"line {line}: duplicate binding_id {binding_id}",
        )
        binding_ids.add(binding_id)
        require(
            "plannedOperationClosure",
            operation_id not in operation_ids and OPERATION.fullmatch(operation_id) is not None,
            f"line {line}: invalid or duplicate planned_operation_id {operation_id}",
        )
        operation_ids.add(operation_id)
        require(
            "registerCoverage",
            capability_key not in register_capabilities,
            f"line {line}: duplicate authorization capability {capability_key}",
        )
        register_capabilities.add(capability_key)
        require(
            "registerIntegrity",
            CAPABILITY.fullmatch(capability_key) is not None,
            f"line {line}: invalid canonical capability key {capability_key}",
        )
        trace = trace_by_capability.get(capability_key)
        require(
            "registerCoverage",
            trace is not None,
            f"line {line}: capability is absent from modern trace {capability_key}",
        )
        if trace is not None:
            for field in ("modern_capability_id", "owner_session", "implementation_slice_id"):
                trace_field = "capability_id" if field == "modern_capability_id" else field
                require(
                    "traceBinding",
                    row.get(field) == trace.get(trace_field),
                    f"line {line}: {field} differs from trace",
                )
            require(
                "traceBinding",
                row.get("menu_node_key") in pipe_set(trace.get("menu_node_keys", "")),
                f"line {line}: menu node is outside the trace allocation",
            )
            require(
                "traceBinding",
                row.get("source_trace_ref")
                == f"modern-capability-trace-register.csv#{trace.get('capability_id')}",
                f"line {line}: source trace reference drift",
            )
            require(
                "traceBinding",
                bool(pipe_set(row.get("planned_route_pattern", "")))
                and pipe_set(row.get("planned_route_pattern", ""))
                <= pipe_set(trace.get("planned_trace_route_patterns", "")),
                f"line {line}: authorization route is outside the trace route union",
            )

        exact_capability = exact_capabilities.get(row.get("modern_capability_id", ""))
        require(
            "exactOperationContract",
            exact_capability is not None,
            f"line {line}: exact capability contract is absent",
        )
        if exact_capability is not None:
            exact_operations = [
                operation
                for operation in exact_capability.get("operations", [])
                if operation.get("authorizationCapability") == capability_key
            ]
            require(
                "exactOperationContract",
                bool(exact_operations)
                and all(
                    route_pattern_covers(
                        row.get("planned_route_pattern", ""),
                        operation.get("path", ""),
                    )
                    for operation in exact_operations
                ),
                f"line {line}: planned route does not cover every exact operation for {capability_key}",
            )
            route_patterns = pipe_set(row.get("planned_route_pattern", ""))
            require(
                "exactOperationContract",
                bool(route_patterns)
                and all(
                    any(route_pattern_covers(pattern, operation.get("path", "")) for operation in exact_operations)
                    for pattern in route_patterns
                ),
                f"line {line}: planned route contains a root with no exact operation for {capability_key}",
            )
            require(
                "exactOperationContract",
                row.get("owner_session") == exact_capability.get("session")
                and row.get("owner_service") == exact_capability.get("runtimeOwner")
                and row.get("menu_node_key") in set(exact_capability.get("menuNodeKeys", []))
                and capability_key in set(exact_capability.get("authorizationCapabilities", [])),
                f"line {line}: authorization owner/menu/capability differs from exact contract",
            )

        owner_session = row.get("owner_session", "")
        module_counts[owner_session] += 1
        require(
            "routeOwnerBinding",
            row.get("owner_service") == EXPECTED_MODULE_SERVICES.get(owner_session),
            f"line {line}: owner service mismatch",
        )
        prefixes = EXPECTED_ROUTE_PREFIXES.get(owner_session, ())
        route = row.get("planned_route_pattern", "")
        route_patterns = pipe_set(route)
        require(
            "routeOwnerBinding",
            bool(prefixes)
            and bool(route_patterns)
            and all(
                any(pattern.startswith(prefix) for prefix in prefixes)
                and pattern.endswith("/**")
                and "*" not in pattern[:-3]
                and "/v1/v1/" not in pattern
                for pattern in route_patterns
            ),
            f"line {line}: non-canonical planned route {route}",
        )
        require(
            "plannedOperationClosure",
            row.get("operation_kind") in {"QUERY", "COMMAND"}
            and ((row.get("canonical_action") == "VIEW") == (row.get("operation_kind") == "QUERY")),
            f"line {line}: operation kind/action mismatch",
        )
        require(
            "canonicalTupleClosure",
            row.get("canonical_resource_type") in {"ACTION", "CONFIG", "DATA"}
            and RESOURCE.fullmatch(row.get("canonical_resource_key", "")) is not None
            and bool(pipe_set(row.get("canonical_population_types", "")))
            and all(TOKEN.fullmatch(value) for value in pipe_set(row.get("canonical_population_types", "")))
            and bool(pipe_set(row.get("canonical_field_group_keys", "")))
            and all(TOKEN.fullmatch(value) for value in pipe_set(row.get("canonical_field_group_keys", "")))
            and TOKEN.fullmatch(row.get("purpose_code", "")) is not None,
            f"line {line}: canonical resource/population/field/purpose tuple invalid",
        )
        require(
            "notImplementedBoundary",
            row.get("canonical_app_entitlement") == EXPECTED_APP_ENTITLEMENT
            and pipe_set(row.get("enforcement_layers", "")) == EXPECTED_ENFORCEMENT_LAYERS
            and row.get("public_api_coverage_state") == REGISTER_PUBLIC_API_STATE
            and row.get("implementation_state") == REGISTER_IMPLEMENTATION_STATE
            and row.get("production_state") == REGISTER_PRODUCTION_STATE,
            f"line {line}: planned/not-implemented/G6 boundary drift",
        )

        profiles = pipe_set(row.get("authorization_profiles", ""))
        parsed_profiles: list[tuple[str, str]] = []
        for profile in sorted(profiles):
            if profile.count(">") != 1:
                findings["fivePersonaClosure"].append(
                    f"line {line}: malformed authorization profile {profile}"
                )
                continue
            parsed_profiles.append(tuple(profile.split(">", 1)))
        profile_packages = {package_code for package_code, _ in parsed_profiles}
        profile_duties = {duty_code for _, duty_code in parsed_profiles}
        referenced_duties.update(profile_duties)
        expected_categories = {
            packages.get(package_code, {}).get("package_category", "")
            for package_code in profile_packages
        }
        persona_counts.update(expected_categories - {""})
        require(
            "fivePersonaClosure",
            bool(parsed_profiles)
            and all(package_code in packages for package_code in profile_packages)
            and expected_categories <= EXPECTED_PERSONA_CATEGORIES
            and pipe_set(row.get("persona_categories", "")) == expected_categories,
            f"line {line}: persona package/category closure failed",
        )
        require(
            "atomicDutyClosure",
            len(profile_duties) == 1 and all(duty_code in duties for duty_code in profile_duties),
            f"line {line}: exactly one existing stable atomic duty is required",
        )
        if len(profile_duties) != 1:
            continue
        duty_code = next(iter(profile_duties))
        duty = duties.get(duty_code)
        if duty is None:
            continue
        require(
            "atomicDutyClosure",
            pipe_set(duty.get("package_codes", "")) == profile_packages
            and all(
                duty_code in pipe_set(packages.get(package_code, {}).get("atomic_duty_codes", ""))
                for package_code in profile_packages
            ),
            f"line {line}: duty/package reverse membership mismatch for {duty_code}",
        )
        tuple_pairs = {
            "menu_node_key": "menu_node_key",
            "owner_service": "owner_service",
            "canonical_capability_key": "capability_key",
            "canonical_resource_type": "resource_type",
            "canonical_resource_key": "resource_key",
            "canonical_action": "permission_code",
        }
        require(
            "canonicalTupleClosure",
            all(row.get(register_field) == duty.get(duty_field) for register_field, duty_field in tuple_pairs.items())
            and pipe_set(row.get("canonical_population_types", "")) == pipe_set(duty.get("population_types", ""))
            and pipe_set(row.get("canonical_field_group_keys", "")) == pipe_set(duty.get("field_group_keys", "")),
            f"line {line}: register/duty canonical tuple mismatch for {duty_code}",
        )
        require(
            "notImplementedBoundary",
            duty.get("implementation_status") == MODERN_DUTY_STATE
            and duty.get("api_pep_status") == MODERN_API_STATE
            and duty.get("ui_projection_status") == MODERN_UI_STATE,
            f"line {line}: duty state overstates implementation for {duty_code}",
        )

    require(
        "registerIntegrity",
        len(rows) == 48
        and binding_ids == {f"MOD-AUTH-{number:03d}" for number in range(1, 49)},
        f"register must contain exact MOD-AUTH-001..048 rows; rows={len(rows)}",
    )
    require(
        "registerCoverage",
        register_capabilities == set(trace_by_capability),
        "register/trace authorization capability sets differ; "
        f"missing={sorted(set(trace_by_capability) - register_capabilities)} "
        f"extra={sorted(register_capabilities - set(trace_by_capability))}",
    )
    require(
        "atomicDutyClosure",
        len(referenced_duties) == 48,
        f"48 distinct planned atomic duties required; actual={len(referenced_duties)}",
    )

    public_capabilities = {
        capability
        for row in pep_rows
        for capability in pipe_set(row.get("canonical_capability_keys", ""))
    }
    modern_public_overlap = sorted(register_capabilities & public_capabilities)
    require(
        "publicApiSeparation",
        not modern_public_overlap,
        "planned modern capabilities leaked into implemented-contract API PEP coverage: "
        f"{modern_public_overlap}",
    )

    checks = {
        "registerIntegrity": not findings["registerIntegrity"],
        "exactTraceCapabilityCoverage": not findings["traceCoverage"]
        and not findings["registerCoverage"],
        "traceBinding": not findings["traceBinding"],
        "canonicalRouteAndOwnerBinding": not findings["routeOwnerBinding"],
        "exactOperationContractClosure": not findings["exactOperationContract"],
        "stablePlannedOperationClosure": not findings["plannedOperationClosure"],
        "existingFivePersonaClosure": not findings["fivePersonaClosure"],
        "globalAtomicDutyClosure": not findings["atomicDutyClosure"]
        and not findings["globalMatrixIntegrity"],
        "canonicalTupleClosure": not findings["canonicalTupleClosure"],
        "implementedPublicApiSeparation": not findings["publicApiSeparation"],
        "plannedNotImplementedAndG6Boundary": not findings["notImplementedBoundary"],
    }
    blockers = [
        f"{category}: {len(messages)}"
        for category, messages in sorted(findings.items())
        if messages
    ]
    return {
        "schema": "dwp.hris.modern-capability-authorization.v1",
        "status": "PASS" if not blockers else "FAIL",
        "register": REGISTER.name,
        "checks": checks,
        "coverage": {
            "modernProductCapabilityCount": len(trace_by_id),
            "exactCapabilityContractCount": len(exact_capabilities),
            "plannedExactOperationCount": exact_operation_count,
            "sourceAuthorizationCapabilityCount": len(trace_by_capability),
            "plannedAuthorizationOperationCount": len(rows),
            "plannedAtomicDutyCount": len(referenced_duties),
            "implementedPublicApiOperationsClaimed": 0,
            "currentImplementedContractPepRowCount": len(pep_rows),
            "modernImplementedPepOverlapCount": len(modern_public_overlap),
            "globalPersonaPackageCount": len(packages),
            "globalAtomicDutyCount": len(duties),
            "byModule": {key: module_counts[key] for key in EXPECTED_MODULE_SERVICES},
            "byPersonaCategory": {
                key: persona_counts[key] for key in sorted(EXPECTED_PERSONA_CATEGORIES)
            },
        },
        "states": {
            "authorization": REGISTER_IMPLEMENTATION_STATE,
            "publicApiCoverage": REGISTER_PUBLIC_API_STATE,
            "production": REGISTER_PRODUCTION_STATE,
        },
        "blockers": blockers,
        "detail": {
            category: messages
            for category, messages in sorted(findings.items())
            if messages
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    try:
        result = validate()
    except Exception as error:
        result = {
            "schema": "dwp.hris.modern-capability-authorization.v1",
            "status": "FAIL",
            "register": REGISTER.name,
            "checks": {},
            "coverage": {},
            "states": {},
            "blockers": [
                f"validator execution error: {type(error).__name__}: {error}"
            ],
            "detail": {},
        }
    json.dump(
        result,
        sys.stdout,
        ensure_ascii=False,
        indent=None if args.compact else 2,
    )
    sys.stdout.write("\n")
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
