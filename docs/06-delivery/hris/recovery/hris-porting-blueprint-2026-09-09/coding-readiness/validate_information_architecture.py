#!/usr/bin/env python3
"""Fail-closed proof for the 76-base + 22-modern HRIS navigation SSOT."""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import generate_information_architecture_register as generator


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REGISTER = HERE / "hris-information-architecture-register.csv"
TRANSITIONS = HERE / "route-transition-register.csv"

HEADER = generator.HEADER
TRANSITION_HEADER = [
    "decision_id",
    "source_scope",
    "legacy_route",
    "canonical_target_route",
    "decision",
    "redirect_allowed",
    "coexistence_rule",
    "retirement_gate",
    "owner_role",
    "status",
    "evidence",
]

EXPECTED_TRANSITIONS = {
    "ROUTE-DEC-001": {
        "legacy_route": "/hr/benefits",
        "canonical_target_route": "/hr/me/benefits",
    },
    "ROUTE-DEC-002": {
        "legacy_route": "/hr/operations/benefits",
        "canonical_target_route": "/hr/operations/employee-services/benefits",
    },
}

PILOT_COMPATIBILITY_ROUTES = {
    "/hr/home",
    "/hr/time",
    "/hr/pay",
    "/hr/talent",
    "/hr/operations/people",
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_csv(path: Path, header: list[str]) -> tuple[list[dict[str, str]], list[str]]:
    errors: list[str] = []
    if not path.is_file():
        return [], [f"missing artifact: {path.name}"]
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != header:
            errors.append(
                f"{path.name}: header drift expected={header} actual={reader.fieldnames}"
            )
        rows = list(reader)
    return rows, errors


def split_pipe(value: str) -> list[str]:
    return [part for part in value.split("|") if part]


def modern_operation_ids() -> set[str]:
    result: set[str] = set()
    for capability in generator.modern_capabilities().values():
        for operation in capability["operations"]:
            result.add(f"MODOP:{operation['operationId']}")
    return result


def backend_worktree() -> Path:
    with (ROOT / "g0/integration-baseline-manifest.csv").open(
        newline="", encoding="utf-8-sig"
    ) as handle:
        row = next(
            item
            for item in csv.DictReader(handle)
            if item["repository"] == "DWP_BACKEND"
        )
    return Path(row["integration_worktree"])


def validate_authorization_sources() -> list[str]:
    errors: list[str] = []
    backend = backend_worktree()
    bundle = backend / "contracts/product-authorization/product-surfaces-v1.bundle-v6.json"
    audit_guard = backend / "dwp-platform-server/src/main/java/com/dwp/services/platform/auditcontrol/AuditAccessGuard.java"
    governance = backend / "dwp-provider-server/src/main/java/com/dwp/services/provider/governance/DataGovernanceController.java"
    for path in (bundle, audit_guard, governance):
        if not path.is_file():
            errors.append(f"pinned authorization source missing: {path}")
    if errors:
        return errors
    bundle_text = bundle.read_text(encoding="utf-8")
    for marker in (
        '"routeContractKey": "route.approvals.work.delegations.page"',
        '"approvals.work.delegation.read"',
        '"approvals.work.delegation.manage"',
        '"routeContractKey": "route.approvals.admin.policies.page"',
        '"approvals.policy.read"',
        '"approvals.oversight.policy.read"',
    ):
        if marker not in bundle_text:
            errors.append(f"baseline authorization bundle missing marker: {marker}")
    if '"ADMIN.AUDIT_VIEW:VIEW"' not in audit_guard.read_text(encoding="utf-8"):
        errors.append("audit-control VIEW permission drift")
    if 'requirePermission("DATA_GOVERNANCE_READ")' not in governance.read_text(
        encoding="utf-8"
    ):
        errors.append("provider data-governance READ permission drift")
    return errors


def validate_transitions(
    rows: list[dict[str, str]], retained_source: str
) -> list[str]:
    errors: list[str] = []
    if len(rows) != 2 or {row["decision_id"] for row in rows} != set(
        EXPECTED_TRANSITIONS
    ):
        errors.append("route transition register must contain exactly decisions 001 and 002")
        return errors
    for row in rows:
        decision_id = row["decision_id"]
        expected = EXPECTED_TRANSITIONS[decision_id]
        for field, value in expected.items():
            if row[field] != value:
                errors.append(f"{decision_id}: {field} drift")
        if (
            row["source_scope"] != "BENSK"
            or row["decision"] != "COEXIST_DISTINCT_PRODUCTS"
            or row["redirect_allowed"] != "NO"
            or row["retirement_gate"] != "SEPARATE_BENSK_PRODUCT_DECISION"
            or row["status"] != "DECIDED_NO_CUTOVER_IN_HRIS_SCOPE"
            or not row["coexistence_rule"].strip()
            or row["owner_role"] != "ROLE.HRIS_HRM_PRODUCT_OWNER"
        ):
            errors.append(f"{decision_id}: BENSK coexistence boundary drift")
        if f"path: '{row['legacy_route']}'" not in retained_source:
            errors.append(f"{decision_id}: retained route not present in pinned frontend")
    if len({row["legacy_route"] for row in rows}) != 2:
        errors.append("route transition legacy routes must be unique")
    if len({row["canonical_target_route"] for row in rows}) != 2:
        errors.append("route transition canonical routes must be unique")
    return errors


def validate_rows(
    rows: list[dict[str, str]],
    expected: list[dict[str, str]],
    transition_rows: list[dict[str, str]],
) -> list[str]:
    errors: list[str] = []
    expected_by_id = {row["ia_node_id"]: row for row in expected}
    actual_by_id = {row.get("ia_node_id", ""): row for row in rows}
    if len(rows) != 98:
        errors.append(f"IA row count drift expected=98 actual={len(rows)}")
    if len(actual_by_id) != len(rows):
        errors.append("duplicate IA node id")
    if set(actual_by_id) != set(expected_by_id):
        errors.append("IA node set differs from pinned base76 + modern22 sources")

    source_counts = Counter(row.get("source_set", "") for row in rows)
    if source_counts != Counter({"BASE76": 76, "MODERN22": 22}):
        errors.append(f"source-set coverage drift: {dict(source_counts)}")
    source_keys = [row.get("source_node_key", "") for row in rows]
    if len(set(source_keys)) != len(source_keys):
        errors.append("source node keys must be globally unique")

    paths = [urlsplit(row.get("canonical_route", "")).path for row in rows]
    if any(not path for path in paths) or len(set(paths)) != len(paths):
        errors.append("canonical target paths must be present and unique across 98 nodes")
    if any(path.startswith("/hr/admin") for path in paths):
        errors.append("forbidden /hr/admin route found; settings SSOT is /hr/settings")

    tfr_ids = {
        row["resolution_id"]
        for row in csv.DictReader(
            (HERE / "target-family-resolution-register.csv").open(
                newline="", encoding="utf-8-sig"
            )
        )
    }
    modern_ids = set(generator.modern_capabilities())
    modern_operations = modern_operation_ids()
    modern_auth = {
        row["canonical_capability_key"]
        for row in csv.DictReader(
            (HERE / "modern-capability-authorization-register.csv").open(
                newline="", encoding="utf-8-sig"
            )
        )
    }
    with (ROOT / "hris-atomic-duty-matrix.csv").open(
        newline="", encoding="utf-8-sig"
    ) as handle:
        duty_auth = {
            row["capability_key"] for row in csv.DictReader(handle)
            if row.get("capability_key")
        }
    with (HERE / "ia-shared-authorization-exception-register.csv").open(
        newline="", encoding="utf-8-sig"
    ) as handle:
        external_auth = {
            row["external_capability"] for row in csv.DictReader(handle)
            if row.get("external_capability")
        }
    pep_auth: set[str] = set()
    with (HERE / "api-pep-binding-register.csv").open(
        newline="", encoding="utf-8-sig"
    ) as handle:
        for row in csv.DictReader(handle):
            pep_auth.update(split_pipe(row["canonical_capability_keys"]))
    allowed_base_auth = pep_auth | duty_auth | external_auth | {
        value
        for refs in generator.AUTH_FALLBACKS.values()
        for value in split_pipe(refs)
    }

    transition_by_id = {row["decision_id"]: row for row in transition_rows}
    for line, row in enumerate(rows, 2):
        node_id = row.get("ia_node_id", f"line-{line}")
        if any(not row.get(field, "").strip() for field in HEADER):
            errors.append(f"{node_id}: blank required IA field")
        expected_row = expected_by_id.get(node_id)
        if expected_row is not None and row != expected_row:
            drift = sorted(
                field for field in HEADER if row.get(field) != expected_row.get(field)
            )
            errors.append(f"{node_id}: generated source binding drift fields={drift}")
        if row.get("owner_session") not in {
            "HRIS-HRM",
            "HRIS-PER",
            "HRIS-TIM",
            "HRIS-PAY",
            "HRIS-SYS",
        }:
            errors.append(f"{node_id}: invalid owner session")
        if row.get("workbench_tab") not in {"summary", "overview"}:
            errors.append(f"{node_id}: workbench tab is not canonical")
        if row.get("production_state") != "NOT_AUTHORIZED_G6":
            errors.append(f"{node_id}: production state is overstated")
        if row.get("implementation_state") not in {
            "NOT_STARTED_G3",
            "NOT_STARTED_G3_TEST_PROVIDER_ONLY",
            "PILOT_CURRENT_RUNTIME_LIMITED_SCOPE",
        }:
            errors.append(f"{node_id}: implementation state is overstated or unknown")

        route = row.get("canonical_route", "")
        path = urlsplit(route).path
        surface = row.get("navigation_surface")
        source_set = row.get("source_set")
        if source_set == "MODERN22":
            required_prefix = {
                "MY_HR": "/hr/me/",
                "OPERATIONS": "/hr/operations/",
                "SETTINGS": "/hr/settings/",
            }.get(surface)
            if required_prefix is None or not path.startswith(required_prefix):
                errors.append(f"{node_id}: modern route/surface prefix drift")
            if set(split_pipe(row.get("source_family_refs", ""))) - modern_ids:
                errors.append(f"{node_id}: unknown modern capability reference")
            if set(split_pipe(row.get("api_contract_refs", ""))) - modern_operations:
                errors.append(f"{node_id}: unknown modern operation reference")
            if set(split_pipe(row.get("authorization_refs", ""))) - (modern_auth | duty_auth):
                errors.append(f"{node_id}: unknown modern authorization capability")
            if row.get("authorization_source_refs") != (
                "ia-node-access-contract-register.csv|hris-permission-group-matrix.csv|"
                "hris-atomic-duty-matrix.csv"
            ):
                errors.append(f"{node_id}: modern authorization source drift")
        elif source_set == "BASE76":
            if set(split_pipe(row.get("source_family_refs", ""))) - tfr_ids:
                errors.append(f"{node_id}: unknown target-family reference")
            if set(split_pipe(row.get("authorization_refs", ""))) - allowed_base_auth:
                errors.append(f"{node_id}: unknown base authorization capability")
            expected_auth_source = (
                "ia-node-access-contract-register.csv|hris-permission-group-matrix.csv|"
                "hris-atomic-duty-matrix.csv"
            )
            if row.get("authorization_source_refs") != expected_auth_source:
                errors.append(f"{node_id}: base authorization source drift")
            if surface == "HOME" and path != "/hr/home":
                errors.append(f"{node_id}: home route drift")
            elif surface == "MY_HR" and not (
                path.startswith("/hr/me/") or path in PILOT_COMPATIBILITY_ROUTES
            ):
                errors.append(f"{node_id}: personal route prefix drift")
            elif surface == "TEAM" and not path.startswith("/hr/team/"):
                errors.append(f"{node_id}: team route prefix drift")
            elif surface == "OPERATIONS" and not path.startswith("/hr/operations/"):
                errors.append(f"{node_id}: operations route prefix drift")
            elif row.get("inventory_group") == "SETTINGS" and not path.startswith(
                "/hr/settings/"
            ):
                errors.append(f"{node_id}: settings route prefix drift")
            elif row.get("inventory_group") == "DWP_CONTROL" and not path.startswith(
                "/admin/"
            ):
                errors.append(f"{node_id}: DWP control route prefix drift")
        else:
            errors.append(f"{node_id}: unknown source set")

        deep_link = row.get("deep_link_template", "")
        if not (deep_link.startswith(route + "?") or deep_link.startswith(route + "&")):
            errors.append(f"{node_id}: deep link does not preserve canonical route")

        decision_id = row.get("compatibility_decision_ref", "")
        if decision_id == "NONE":
            if path in {item["legacy_route"] for item in transition_rows}:
                errors.append(f"{node_id}: canonical IA shadows retained BENSK route")
        else:
            decision = transition_by_id.get(decision_id)
            if decision is None or decision["canonical_target_route"] != route:
                errors.append(f"{node_id}: compatibility decision is missing or mismatched")

    return errors


def closure() -> dict[str, Any]:
    rows, errors = read_csv(REGISTER, HEADER)
    transitions, transition_read_errors = read_csv(TRANSITIONS, TRANSITION_HEADER)
    errors.extend(transition_read_errors)
    try:
        expected = generator.rows()
        retained = (
            generator.frontend_catalog().parent / "hris-retained-route-registry.ts"
        ).read_text(encoding="utf-8")
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as error:
        expected = []
        retained = ""
        errors.append(f"source generation failed closed: {error}")
    errors.extend(validate_transitions(transitions, retained))
    try:
        errors.extend(validate_authorization_sources())
    except (OSError, StopIteration, KeyError) as error:
        errors.append(f"authorization source proof failed closed: {error}")
    if expected:
        errors.extend(validate_rows(rows, expected, transitions))
    checks = {
        "exactSourceMaterialization": not any("generated source binding drift" in e for e in errors),
        "nodeCoverageAndUniqueness": not any(
            marker in e
            for e in errors
            for marker in ("row count", "node set", "duplicate IA", "globally unique")
        ),
        "canonicalRouteAndWorkbenchClosure": not any(
            marker in e
            for e in errors
            for marker in ("route", "path", "workbench", "/hr/admin")
        ),
        "apiAndAuthorizationClosure": not any(
            marker in e for e in errors for marker in ("reference", "authorization")
        ),
        "deepLinkClosure": not any("deep link" in e for e in errors),
        "benskCompatibilityIsolation": not any(
            marker in e
            for e in errors
            for marker in ("BENSK", "compatibility", "shadows retained", "transition")
        ),
        "implementationAndActivationHonesty": not any(
            "state is overstated" in e for e in errors
        ),
    }
    source_counts = Counter(row.get("source_set", "") for row in rows)
    return {
        "schema": "dwp.hris.information-architecture.v1",
        "status": "PASS" if not errors else "FAIL",
        "coverage": {
            "nodeCount": len(rows),
            "baseNodeCount": source_counts.get("BASE76", 0),
            "modernNodeCount": source_counts.get("MODERN22", 0),
            "uniqueCanonicalPathCount": len(
                {urlsplit(row.get("canonical_route", "")).path for row in rows}
            ),
            "sourceFamilyReferenceCount": len(
                {
                    value
                    for row in rows
                    for value in split_pipe(row.get("source_family_refs", ""))
                }
            ),
            "apiContractReferenceCount": len(
                {
                    value
                    for row in rows
                    for value in split_pipe(row.get("api_contract_refs", ""))
                }
            ),
            "authorizationCapabilityCount": len(
                {
                    value
                    for row in rows
                    for value in split_pipe(row.get("authorization_refs", ""))
                }
            ),
            "routeTransitionDecisionCount": len(transitions),
        },
        "checks": checks,
        "blockers": errors,
        "artifactSha256": {
            path.name: digest(path)
            for path in (REGISTER, TRANSITIONS, Path(generator.__file__))
            if path.is_file()
        },
    }


def self_test() -> dict[str, Any]:
    rows, read_errors = read_csv(REGISTER, HEADER)
    transitions, transition_errors = read_csv(TRANSITIONS, TRANSITION_HEADER)
    if read_errors or transition_errors:
        return {
            "schema": "dwp.hris.information-architecture-self-test.v1",
            "status": "FAIL",
            "tamperRejectedCount": 0,
            "tamperCaseCount": 0,
            "blockers": read_errors + transition_errors,
        }
    expected = generator.rows()
    cases: list[tuple[str, list[dict[str, str]], list[dict[str, str]]]] = []

    def mutate_row(name: str, index: int, field: str, value: str) -> None:
        changed = copy.deepcopy(rows)
        changed[index][field] = value
        cases.append((name, changed, copy.deepcopy(transitions)))

    cases.append(("missing-node", copy.deepcopy(rows[:-1]), copy.deepcopy(transitions)))
    mutate_row("duplicate-route", 1, "canonical_route", rows[0]["canonical_route"])
    mutate_row("unknown-api", 1, "api_contract_refs", "UNKNOWN-API")
    mutate_row("unknown-auth", 1, "authorization_refs", "hcm.unknown")
    mutate_row("forbidden-settings-root", 60, "canonical_route", "/hr/admin/time")
    mutate_row("blank-workbench", 1, "workbench_tab", "")
    mutate_row("production-overstatement", 1, "production_state", "AUTHORIZED")
    mutate_row("deep-link-drift", 1, "deep_link_template", "/unrelated")
    mutate_row("bensk-shadow", 1, "canonical_route", "/hr/benefits")
    changed_transition = copy.deepcopy(transitions)
    changed_transition[0]["redirect_allowed"] = "YES"
    cases.append(("bensk-redirect", copy.deepcopy(rows), changed_transition))

    rejected: dict[str, int] = {}
    retained = (
        generator.frontend_catalog().parent / "hris-retained-route-registry.ts"
    ).read_text(encoding="utf-8")
    for name, changed_rows, changed_transitions in cases:
        errors = validate_rows(changed_rows, expected, changed_transitions)
        errors.extend(validate_transitions(changed_transitions, retained))
        rejected[name] = len(errors)
    blockers = [name for name, count in rejected.items() if count == 0]
    return {
        "schema": "dwp.hris.information-architecture-self-test.v1",
        "status": "PASS" if not blockers else "FAIL",
        "tamperRejectedCount": sum(count > 0 for count in rejected.values()),
        "tamperCaseCount": len(cases),
        "rejectedErrorCountByCase": rejected,
        "blockers": blockers,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    payload = self_test() if args.self_test else closure()
    print(
        json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":") if args.compact else None,
            indent=None if args.compact else 2,
        )
    )
    return 0 if payload["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
