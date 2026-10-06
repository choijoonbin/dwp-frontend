#!/usr/bin/env python3
"""Generate the 76-base + 22-modern HRIS information-architecture SSOT.

The generator reads the approved frontend catalog and the machine-readable
modern contracts.  Product decisions that cannot be inferred safely (target
route and source-family consolidation) are pinned below and are independently
validated by ``validate_information_architecture.py``.
"""

from __future__ import annotations

import ast
import csv
import hashlib
from collections import defaultdict
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
G0 = ROOT / "g0"
OUTPUT = HERE / "hris-information-architecture-register.csv"

BASE_CATALOG_FRAGMENTS = (
    ("my-hr.ts", "HRIS_MY_HR_CATALOG", "MY_HR", 8),
    ("team.ts", "HRIS_TEAM_CATALOG", "TEAM", 7),
    ("hr-operations.ts", "HRIS_HR_OPERATIONS_CATALOG", "HR_OPERATIONS", 10),
    ("time.ts", "HRIS_TIME_CATALOG", "TIME", 10),
    ("payroll.ts", "HRIS_PAYROLL_CATALOG", "PAYROLL", 14),
    ("performance.ts", "HRIS_PERFORMANCE_CATALOG", "PERFORMANCE", 8),
    ("settings.ts", "HRIS_SETTINGS_CATALOG", "SETTINGS", 13),
    ("dwp-control.ts", "HRIS_DWP_CONTROL_CATALOG", "DWP_CONTROL", 6),
)

HEADER = [
    "ia_node_id",
    "source_set",
    "source_node_key",
    "inventory_group",
    "navigation_surface",
    "owner_session",
    "runtime_owner",
    "personas",
    "source_lifecycle",
    "canonical_route",
    "workbench_tab",
    "source_family_refs",
    "api_contract_refs",
    "authorization_refs",
    "authorization_source_refs",
    "deep_link_template",
    "implementation_state",
    "production_state",
    "source_ref",
    "source_digest_sha256",
    "compatibility_decision_ref",
]

PERSONAS = {
    "employee": ["EMPLOYEE"],
    "manager": ["MANAGER"],
    "operator": ["OPERATOR"],
    "settings": ["SETTINGS_ADMIN"],
}

# A base navigation node can consolidate more than one source family.  These
# are references to the exact, independently validated TFR rows—not free-form
# API strings.
BASE_TFR = {
    "my-hr-home": "TFR-SYS-012",
    "my-hr-profile": "TFR-HRM-004",
    "my-employment-documents": "TFR-HRM-008|TFR-HRM-011",
    "my-time": "TFR-TIM-017|TFR-TIM-018",
    "my-leave": "TFR-TIM-012|TFR-TIM-014",
    "my-pay-tax": "TFR-PAY-009|TFR-PAY-015|TFR-PAY-017",
    # The scoped performance dashboard is the initial read for the personal
    # goals/performance workbench; goal/review/result families supply actions.
    "my-goals-performance": "TFR-PER-007|TFR-PER-009|TFR-PER-012|TFR-PER-013",
    "my-hr-requests": "TFR-HRM-009|TFR-HRM-010|TFR-HRM-013",
    "team-home": "TFR-HRM-003|TFR-PER-007|TFR-TIM-018|TFR-PAY-015|TFR-SYS-012",
    "team-members": "TFR-HRM-004|TFR-HRM-008",
    "team-time": "TFR-TIM-016|TFR-TIM-017",
    "team-leave": "TFR-TIM-012|TFR-TIM-014",
    "team-people-changes": "TFR-HRM-007|TFR-HRM-010",
    "team-performance": "TFR-PER-008|TFR-PER-009|TFR-PER-013",
    "team-delegation": "TFR-SYS-003",
    "hr-operations-home": "TFR-HRM-003|TFR-PER-007|TFR-TIM-018|TFR-PAY-015|TFR-SYS-012",
    "hr-people": "TFR-HRM-004",
    "hr-employment-assignments": "TFR-HRM-008",
    "hr-appointments": "TFR-HRM-007",
    "hr-organization-positions": "TFR-HRM-005",
    "hr-contracts-compensation-basis": "TFR-HRM-011",
    "hr-employee-change-requests": "TFR-HRM-010",
    "hr-certificates-documents": "TFR-HRM-009",
    "hr-exit-return": "TFR-HRM-013",
    "hr-data-quality": "TFR-HRM-012",
    "time-command-center": "TFR-TIM-007|TFR-TIM-017|TFR-TIM-018",
    "time-work-plans": "TFR-TIM-016",
    "time-clock-ingestion": "TFR-TIM-006|TFR-TIM-008",
    "time-interpretation": "TFR-TIM-010",
    "time-exceptions": "TFR-TIM-006|TFR-TIM-010|TFR-TIM-017",
    "time-daily-close": "TFR-TIM-007",
    "time-monthly-close": "TFR-TIM-007",
    "time-leave-operations": "TFR-TIM-012|TFR-TIM-014",
    "time-accrual-expiration": "TFR-TIM-012|TFR-TIM-013",
    "time-reports": "TFR-TIM-009",
    "pay-command-center": "TFR-PAY-011|TFR-PAY-012|TFR-PAY-013|TFR-PAY-015",
    "pay-population": "TFR-PAY-013|TFR-PAY-021",
    "pay-inputs": "TFR-PAY-016|TFR-PAY-020|TFR-PAY-021",
    "pay-calculation": "TFR-PAY-011",
    "pay-validation-reconciliation": "TFR-PAY-012",
    "pay-retro-corrections": "TFR-PAY-010",
    "pay-results": "TFR-PAY-012",
    "pay-payments": "TFR-PAY-008",
    "pay-accounting": "TFR-PAY-008",
    "pay-statements": "TFR-PAY-009",
    "pay-tax-social-insurance": "TFR-PAY-003|TFR-PAY-005|TFR-PAY-014",
    "pay-retirement": "TFR-PAY-004",
    "pay-year-end-tax": "TFR-PAY-017",
    "pay-reports": "TFR-PAY-012|TFR-PAY-015",
    "performance-command-center": "TFR-PER-007|TFR-PER-011",
    "performance-goal-cycles": "TFR-PER-005|TFR-PER-009",
    "performance-review-operations": "TFR-PER-006|TFR-PER-013",
    "performance-forms-scales": "TFR-PER-004|TFR-PER-014",
    "performance-multirater-surveys": "TFR-PER-013|TFR-PER-014",
    "performance-conversations-feedback": "TFR-PER-003|TFR-PER-008",
    "performance-calibration": "TFR-PER-002",
    "performance-results": "TFR-PER-012",
    "settings-enterprise": "TFR-HRM-005|TFR-SYS-011",
    "settings-reference": "TFR-SYS-007",
    "settings-people-employment": "TFR-HRM-007|TFR-HRM-008",
    "settings-time": "TFR-TIM-005|TFR-TIM-016",
    "settings-leave": "TFR-TIM-005|TFR-TIM-013",
    "settings-payroll": "TFR-PAY-006|TFR-PAY-007|TFR-PAY-019",
    "settings-statutory": "TFR-PAY-003|TFR-PAY-004|TFR-PAY-005|TFR-PAY-017",
    "settings-performance": "TFR-PER-004|TFR-PER-005|TFR-PER-014",
    "settings-workflow": "TFR-SYS-003",
    "settings-documents-communications": "TFR-HRM-014",
    "settings-integrations": "TFR-SYS-008",
    "settings-extensions": "TFR-HRM-015",
    "settings-operations": "TFR-SYS-002|TFR-SYS-006",
    "dwp-experience": "TFR-SYS-012",
    "dwp-identity": "TFR-SYS-004",
    "dwp-platform": "TFR-SYS-007|TFR-SYS-011",
    "dwp-integrations": "TFR-SYS-008",
    "dwp-governance": "TFR-SYS-001|TFR-SYS-010",
    "dwp-extensibility": "TFR-HRM-015",
}

EXTERNAL_ROUTES = {
    "dwp-experience": "/admin/experience/branding?product=HCM",
    "dwp-identity": "/admin/identity/app-governance?product=HCM",
    "dwp-platform": "/admin/platform/catalog?product=HCM",
    "dwp-integrations": "/admin/integrations/productivity?product=HCM",
    "dwp-governance": "/admin/governance/audit-overview?product=HCM",
    "dwp-extensibility": "/admin/platform/registry?namespace=hris-extension",
}

AUTH_FALLBACKS = {
    "team-delegation": "approvals.work.delegation.manage|approvals.work.delegation.read",
    "settings-workflow": "approvals.oversight.policy.read|approvals.policy.read",
    "dwp-governance": "ADMIN.AUDIT_VIEW:VIEW|DATA_GOVERNANCE_READ",
}

AUTH_FALLBACK_SOURCE = {
    "team-delegation": "backend:contracts/product-authorization/product-surfaces-v1.bundle-v6.json#route.approvals.work.delegations.page",
    "settings-workflow": "backend:contracts/product-authorization/product-surfaces-v1.bundle-v6.json#route.approvals.admin.policies.page",
    "dwp-governance": "backend:dwp-platform-server/src/main/java/com/dwp/services/platform/auditcontrol/AuditAccessGuard.java|backend:dwp-provider-server/src/main/java/com/dwp/services/provider/governance/DataGovernanceController.java",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def split_top_level(text: str) -> list[str]:
    values: list[str] = []
    start = 0
    stack: list[str] = []
    quote = ""
    escaped = False
    pairs = {"(": ")", "[": "]", "{": "}"}
    for index, char in enumerate(text):
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = ""
            continue
        if char in "'\"`":
            quote = char
        elif char in pairs:
            stack.append(pairs[char])
        elif stack and char == stack[-1]:
            stack.pop()
        elif char == "," and not stack:
            value = text[start:index].strip()
            if value:
                values.append(value)
            start = index + 1
    value = text[start:].strip()
    if value:
        values.append(value)
    return values


def parse_string(value: str) -> str:
    parsed = ast.literal_eval(value.strip())
    if not isinstance(parsed, str):
        raise ValueError(f"not a string literal: {value}")
    return parsed


def find_balanced(text: str, open_index: int) -> int:
    pairs = {"(": ")", "[": "]", "{": "}"}
    stack = [pairs[text[open_index]]]
    quote = ""
    escaped = False
    for index in range(open_index + 1, len(text)):
        char = text[index]
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = ""
            continue
        if char in "'\"`":
            quote = char
        elif char in pairs:
            stack.append(pairs[char])
        elif stack and char == stack[-1]:
            stack.pop()
            if not stack:
                return index
    raise ValueError("unbalanced TypeScript catalog")


def property_string(block: str, name: str) -> str:
    import re

    match = re.search(rf"\b{name}:\s*('(?:\\.|[^'])*')", block)
    if not match:
        raise ValueError(f"missing {name} in catalog node")
    return parse_string(match.group(1))


def parse_personas(value: str) -> list[str]:
    value = value.strip()
    if value in PERSONAS:
        return PERSONAS[value]
    if value.startswith("[") and value.endswith("]"):
        return [parse_string(item) for item in split_top_level(value[1:-1])]
    raise ValueError(f"unsupported persona expression: {value}")


def parse_base_catalog(path: Path, export_name: str) -> list[dict[str, object]]:
    import re

    text = path.read_text(encoding="utf-8")
    marker = f"export const {export_name}"
    marker_index = text.index(marker)
    freeze_index = text.index("Object.freeze", marker_index)
    array_index = text.index("[", freeze_index)
    array_end = find_balanced(text, array_index)
    elements = split_top_level(text[array_index + 1 : array_end])
    rows: list[dict[str, object]] = []
    for element in elements:
        if element.startswith("planned("):
            close = find_balanced(element, element.index("("))
            args = split_top_level(element[element.index("(") + 1 : close])
            if len(args) not in {9, 10}:
                raise ValueError(f"planned node argument drift: {len(args)}")
            rows.append(
                {
                    "id": parse_string(args[0]),
                    "inventoryGroup": parse_string(args[1]),
                    "surface": parse_string(args[2]),
                    "module": parse_string(args[3]),
                    "personas": parse_personas(args[4]),
                    "lifecycle": "PLANNED",
                    "href": "",
                }
            )
            continue
        if not element.startswith("node("):
            raise ValueError(f"unsupported catalog element: {element[:40]}")
        object_start = element.index("{")
        object_end = find_balanced(element, object_start)
        block = element[object_start : object_end + 1]
        persona_match = re.search(r"\bpersonas:\s*(\[[^]]*\]|[A-Za-z_]+)", block)
        if not persona_match:
            raise ValueError("missing personas in catalog node")
        href_match = re.search(r"\bhref:\s*('(?:\\.|[^'])*')", block)
        rows.append(
            {
                "id": property_string(block, "id"),
                "inventoryGroup": property_string(block, "inventoryGroup"),
                "surface": property_string(block, "surface"),
                "module": property_string(block, "module"),
                "personas": parse_personas(persona_match.group(1)),
                "lifecycle": property_string(block, "lifecycle"),
                "href": parse_string(href_match.group(1)) if href_match else "",
            }
        )
    return rows


def frontend_root() -> Path:
    with (G0 / "integration-baseline-manifest.csv").open(
        newline="", encoding="utf-8-sig"
    ) as handle:
        rows = list(csv.DictReader(handle))
    matches = [row for row in rows if row["repository"] == "DWP_FRONTEND"]
    if len(matches) != 1:
        raise ValueError("frontend integration baseline must be exact-one")
    return Path(matches[0]["integration_worktree"])


def frontend_catalog_fragments() -> list[tuple[Path, str, str, int]]:
    frontend = frontend_root()
    catalog_root = (
        frontend / "apps/dwp/src/features/hris/shell/model/catalog"
    )
    if not catalog_root.is_dir() or catalog_root.is_symlink():
        raise ValueError("layered base catalog directory is missing or non-regular")
    expected_names = {item[0] for item in BASE_CATALOG_FRAGMENTS}
    actual_names = {path.name for path in catalog_root.iterdir()}
    if actual_names != expected_names:
        raise ValueError(
            "base catalog fragment set drift: "
            f"missing={sorted(expected_names - actual_names)} "
            f"unknown={sorted(actual_names - expected_names)}"
        )
    fragments: list[tuple[Path, str, str, int]] = []
    for file_name, export_name, inventory_group, expected_count in BASE_CATALOG_FRAGMENTS:
        path = catalog_root / file_name
        if not path.is_file() or path.is_symlink():
            raise ValueError(f"catalog fragment missing or non-regular: {file_name}")
        fragments.append((path, export_name, inventory_group, expected_count))
    aggregate = frontend / "apps/dwp/src/features/hris/shell/model/hris-product-map-catalog.ts"
    if not aggregate.is_file() or aggregate.is_symlink():
        raise ValueError("layered catalog aggregate is missing or non-regular")
    aggregate_text = aggregate.read_text(encoding="utf-8")
    marker_index = aggregate_text.index("export const HRIS_PRODUCT_MAP_CATALOG")
    freeze_index = aggregate_text.index("Object.freeze", marker_index)
    array_index = aggregate_text.index("[", freeze_index)
    array_end = find_balanced(aggregate_text, array_index)
    actual_order = split_top_level(aggregate_text[array_index + 1 : array_end])
    expected_order = [f"...{item[1]}" for item in BASE_CATALOG_FRAGMENTS]
    if actual_order != expected_order:
        raise ValueError(
            f"base catalog aggregate order drift: {actual_order} != {expected_order}"
        )
    return fragments


def base_route(node: dict[str, object]) -> str:
    node_id = str(node["id"])
    href = str(node["href"])
    if href:
        return href
    if node_id in EXTERNAL_ROUTES:
        return EXTERNAL_ROUTES[node_id]
    group = str(node["inventoryGroup"])
    if group == "MY_HR":
        suffix = {
            "my-hr-profile": "profile",
            "my-employment-documents": "employment-documents",
            "my-leave": "leave",
            "my-hr-requests": "requests",
        }[node_id]
        return f"/hr/me/{suffix}"
    if group == "TEAM":
        return f"/hr/team/{node_id.removeprefix('team-')}"
    if group == "HR_OPERATIONS":
        if node_id == "hr-operations-home":
            return "/hr/operations/home"
        return f"/hr/operations/people/{node_id.removeprefix('hr-')}"
    if group == "TIME":
        return f"/hr/operations/time/{node_id.removeprefix('time-')}"
    if group == "PAYROLL":
        return f"/hr/operations/payroll/{node_id.removeprefix('pay-')}"
    if group == "PERFORMANCE":
        return f"/hr/operations/performance/{node_id.removeprefix('performance-')}"
    if group == "SETTINGS":
        suffix = node_id.removeprefix("settings-")
        if suffix == "reference":
            suffix = "reference-data"
        return f"/hr/settings/{suffix}"
    raise ValueError(f"no canonical route rule for {node_id}")


def base_runtime(node: dict[str, object]) -> str:
    node_id = str(node["id"])
    if node_id == "team-delegation":
        return "dwp-approval-server"
    if node_id == "dwp-identity":
        return "dwp-auth-server"
    if node_id in {"dwp-governance"}:
        return "dwp-audit|dwp-provider-server"
    if node_id in {"dwp-integrations"}:
        return "dwp-platform-server"
    module = str(node["module"])
    return {
        "HRM": "dwp-people-server",
        "PER": "dwp-people-server",
        "TIM": "dwp-time-server",
        "PAY": "dwp-payroll-server",
        "SYS": "dwp-platform-server",
    }[module]


def owner_session(module: str) -> str:
    return f"HRIS-{module}"


def source_resolution() -> tuple[dict[str, list[str]], dict[str, set[str]]]:
    with (HERE / "target-family-resolution-register.csv").open(
        newline="", encoding="utf-8-sig"
    ) as handle:
        tfr_rows = list(csv.DictReader(handle))
    with (HERE / "api-pep-binding-register.csv").open(
        newline="", encoding="utf-8-sig"
    ) as handle:
        pep_rows = list(csv.DictReader(handle))
    refs_by_tfr = {
        row["resolution_id"]: row["resolution_refs"].split("|")
        for row in tfr_rows
    }
    auth_by_ref: defaultdict[str, set[str]] = defaultdict(set)
    for row in pep_rows:
        capabilities = set(row["canonical_capability_keys"].split("|"))
        auth_by_ref[row["binding_id"]].update(capabilities)
        if row["module"] == "SYS":
            auth_by_ref[row["source_operation_id"]].update(capabilities)
    return refs_by_tfr, auth_by_ref


def resolved_contract_refs(
    tfr_ids: list[str], refs_by_tfr: dict[str, list[str]]
) -> str:
    refs = {
        reference
        for tfr_id in tfr_ids
        for reference in refs_by_tfr[tfr_id]
        if not reference.startswith("DECISION:")
    }
    if not refs:
        raise ValueError(f"source families have no executable/data contract: {tfr_ids}")
    return "|".join(sorted(refs))


def base_authorization(
    node_id: str,
    tfr_ids: list[str],
    refs_by_tfr: dict[str, list[str]],
    auth_by_ref: dict[str, set[str]],
) -> str:
    capabilities: set[str] = set()
    for tfr_id in tfr_ids:
        for reference in refs_by_tfr[tfr_id]:
            capabilities.update(auth_by_ref.get(reference, set()))
    if not capabilities:
        fallback = AUTH_FALLBACKS.get(node_id)
        if fallback:
            capabilities.update(fallback.split("|"))
    if not capabilities:
        raise ValueError(f"no browser authorization capability for {node_id}")
    return "|".join(sorted(capabilities))


def deep_link(route: str, node_id: str) -> str:
    delimiter = "&" if "?" in route else "?"
    if node_id.endswith("-home"):
        return f"{route}{delimiter}widget={{widgetKey}}"
    if node_id.endswith("command-center") or node_id.endswith("operations-home"):
        return f"{route}{delimiter}period={{periodPublicId}}&tab=exceptions"
    return f"{route}{delimiter}tab=overview&focus={{resourcePublicId}}"


def modern_capabilities() -> dict[str, dict[str, object]]:
    result: dict[str, dict[str, object]] = {}
    current_paths = (
        "session-evidence/hrm/g3-modern-capability-contracts.v1.json",
        "session-evidence/per/g3-modern-capability-contracts.v2.json",
        "session-evidence/tim/g3-modern-capability-contracts.v1.json",
        "session-evidence/sys/g3-modern-capability-contracts.v1.json",
    )
    for relative_path in current_paths:
        path = ROOT / relative_path
        import json

        payload = json.loads(path.read_text(encoding="utf-8"))
        for capability in payload["capabilities"]:
            result[str(capability["capabilityId"])] = capability
    return result


def rows() -> list[dict[str, str]]:
    catalog = frontend_catalog()
    base_nodes = parse_base_catalog(catalog)
    base_keys = {str(node["id"]) for node in base_nodes}
    if len(base_nodes) != 76 or len(base_keys) != 76 or base_keys != set(BASE_TFR):
        raise ValueError(
            "base IA source drift: "
            f"rows={len(base_nodes)} unique={len(base_keys)} "
            f"missingMappings={sorted(base_keys - set(BASE_TFR))} "
            f"orphanMappings={sorted(set(BASE_TFR) - base_keys)}"
        )
    refs_by_tfr, auth_by_ref = source_resolution()
    catalog_digest = sha256(catalog)
    output: list[dict[str, str]] = []
    for node in base_nodes:
        node_id = str(node["id"])
        tfr_ids = BASE_TFR[node_id].split("|")
        route = base_route(node)
        lifecycle = str(node["lifecycle"])
        implementation = (
            "PILOT_CURRENT_RUNTIME_LIMITED_SCOPE"
            if lifecycle == "PILOT"
            else (
                "NOT_STARTED_G3_TEST_PROVIDER_ONLY"
                if lifecycle == "BLOCKED_EVIDENCE"
                else "NOT_STARTED_G3"
            )
        )
        output.append(
            {
                "ia_node_id": f"BASE:{node_id}",
                "source_set": "BASE76",
                "source_node_key": node_id,
                "inventory_group": str(node["inventoryGroup"]),
                "navigation_surface": str(node["surface"]),
                "owner_session": owner_session(str(node["module"])),
                "runtime_owner": base_runtime(node),
                "personas": "|".join(str(value) for value in node["personas"]),
                "source_lifecycle": lifecycle,
                "canonical_route": route,
                "workbench_tab": "summary" if "home" in node_id or "command-center" in node_id else "overview",
                "source_family_refs": "|".join(tfr_ids),
                "api_contract_refs": resolved_contract_refs(tfr_ids, refs_by_tfr),
                "authorization_refs": base_authorization(
                    node_id, tfr_ids, refs_by_tfr, auth_by_ref
                ),
                "authorization_source_refs": AUTH_FALLBACK_SOURCE.get(
                    node_id, "api-pep-binding-register.csv"
                ),
                "deep_link_template": deep_link(route, node_id),
                "implementation_state": implementation,
                "production_state": "NOT_AUTHORIZED_G6",
                "source_ref": "frontend:apps/dwp/src/features/hris/shell/hris-product-map-catalog.ts#" + node_id,
                "source_digest_sha256": catalog_digest,
                "compatibility_decision_ref": "NONE",
            }
        )

    modern_menu_path = HERE / "modern-menu-node-register.csv"
    with modern_menu_path.open(newline="", encoding="utf-8-sig") as handle:
        modern_menu_rows = list(csv.DictReader(handle))
    modern_keys = {row["menu_node_key"] for row in modern_menu_rows}
    if len(modern_menu_rows) != 22 or len(modern_keys) != 22:
        raise ValueError(
            f"modern IA source drift: rows={len(modern_menu_rows)} unique={len(modern_keys)}"
        )
    capabilities = modern_capabilities()
    modern_digest = sha256(modern_menu_path)
    group_by_surface_module = {
        ("MY_HR", "HRIS-HRM"): "MY_HR",
        ("MY_HR", "HRIS-PER"): "MY_HR",
        ("MY_HR", "HRIS-SYS"): "MY_HR",
        ("OPERATIONS", "HRIS-HRM"): "HR_OPERATIONS",
        ("OPERATIONS", "HRIS-PER"): "PERFORMANCE",
        ("OPERATIONS", "HRIS-TIM"): "TIME",
        ("OPERATIONS", "HRIS-SYS"): "HR_OPERATIONS",
        ("SETTINGS", "HRIS-PER"): "SETTINGS",
        ("SETTINGS", "HRIS-SYS"): "SETTINGS",
    }
    for menu in modern_menu_rows:
        capability_ids = menu["capability_ids"].split("|")
        operation_ids = sorted(
            {
                str(operation["operationId"])
                for capability_id in capability_ids
                for operation in capabilities[capability_id]["operations"]
            }
        )
        key = menu["menu_node_key"]
        route = menu["route"]
        compatibility = "ROUTE-DEC-002" if key == "hcm.operations.benefits" else (
            "ROUTE-DEC-001" if key == "hcm.personal.benefits" else "NONE"
        )
        output.append(
            {
                "ia_node_id": f"MODERN:{key}",
                "source_set": "MODERN22",
                "source_node_key": key,
                "inventory_group": group_by_surface_module[(menu["navigation_surface"], menu["owner_session"])],
                "navigation_surface": menu["navigation_surface"],
                "owner_session": menu["owner_session"],
                "runtime_owner": menu["runtime_owner"],
                "personas": "|".join(
                    value
                    for value in [
                        menu["primary_persona"],
                        *menu["secondary_personas"].split("|"),
                    ]
                    if value
                ),
                "source_lifecycle": "PLANNED_REQUIRED_SCOPE",
                "canonical_route": route,
                "workbench_tab": "overview",
                "source_family_refs": "|".join(capability_ids),
                "api_contract_refs": "|".join(f"MODOP:{value}" for value in operation_ids),
                "authorization_refs": menu["required_authorization_capabilities"],
                "authorization_source_refs": "modern-capability-authorization-register.csv",
                "deep_link_template": deep_link(route, key),
                "implementation_state": menu["implementation_state"],
                "production_state": "NOT_AUTHORIZED_G6",
                "source_ref": f"modern-menu-node-register.csv#{key}",
                "source_digest_sha256": modern_digest,
                "compatibility_decision_ref": compatibility,
            }
        )
    route_keys = [row["canonical_route"].split("?", 1)[0] for row in output]
    if len(output) != 98 or len(set(route_keys)) != 98:
        raise ValueError(
            f"integrated IA drift: rows={len(output)} uniqueRoutes={len(set(route_keys))}"
        )
    return output


def main() -> int:
    generated = rows()
    with OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=HEADER, lineterminator="\n")
        writer.writeheader()
        writer.writerows(generated)
    print(f"WROTE={OUTPUT} rows={len(generated)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
