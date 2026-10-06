#!/usr/bin/env python3
"""Validate complete Phase-1 People HR API transition to one canonical SoR.

The transition register is a hand-authored semantic oracle. This validator
independently extracts the legacy operation universe from the current frontend
source and never assumes aggregate workspace payloads are URL-compatible with
one canonical endpoint.
"""

from __future__ import annotations

import argparse
import copy
import csv
import json
import re
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REGISTER = HERE / "hris-api-sor-transition-register.csv"
PEP = HERE / "api-pep-binding-register.csv"
SERVICE_PEP = HERE / "service-api-auth-binding-register.csv"
SLICES = HERE / "g3-slice-code-go-register.csv"
IA = HERE / "hris-information-architecture-register.csv"
ALLOCATIONS = HERE / "g3-file-allocation-register.csv"
ROUTE_TRANSITIONS = HERE / "route-transition-register.csv"
WORKTREES = ROOT / "g0/worktree-branch-register.csv"
HR_API = "libs/shared-utils/src/api/hr-api.ts"

HEADER = [
    "transition_id", "legacy_source_refs", "source_variant", "legacy_method",
    "legacy_browser_path", "disposition", "canonical_owner_sessions",
    "canonical_contract_refs", "canonical_ia_node_refs", "canonical_browser_paths",
    "cutover_slice_ids", "transition_adapter_allocation_id", "feature_flag",
    "selection_mode", "initial_selection", "composition_mode",
    "direct_url_switch_allowed", "retirement_gate", "dual_read_allowed",
    "dual_write_allowed", "silent_fallback_allowed", "bensk_state_reuse_allowed",
    "status", "rationale",
]

# Independent semantic decisions. Generator output is never used as the oracle.
# Fields: method, legacy path, disposition, variant, source refs, contracts,
# IA nodes, UI routes, flag, composition mode, retirement gate.
EXPECTED: dict[str, tuple[str, ...]] = {
    "API-SOR-READ-001": ("GET", "/api/people/v1/hr/home", "RETIRE_SYS_COMPOSITION", "ALL", "libs/shared-utils/src/api/hr-api.ts#getHrHome", "PEP-SYS-028|SVC-PEP-HRM-006|SVC-PEP-PAY-001|SVC-PEP-PER-002|SVC-PEP-TIM-002", "BASE:my-hr-home", "/hr/home", "hris.api.sor.home", "RETIRE_AGGREGATOR_COMPOSE_CANONICAL", "SYS_HOME_COMPOSITION_AND_ALL_CONTRIBUTORS_VERIFIED"),
    "API-SOR-READ-002": ("GET", "/api/people/v1/hr/time", "CUTOVER_TIM", "ALL", "libs/shared-utils/src/api/hr-api.ts#getHrTime|apps/dwp/src/features/hris/time/hris-time-data-source.ts#readHrisTimeWorkspace", "PEP-TIM-001|PEP-TIM-011", "BASE:my-time", "/hr/time", "hris.api.sor.tim.time", "RETIRE_AGGREGATOR_COMPOSE_CANONICAL", "CANONICAL_COMPOSITION_CONTRACT_AND_ALL_TARGET_SLICES_VERIFIED"),
    "API-SOR-READ-003": ("GET", "/api/people/v1/hr/absence", "CUTOVER_TIM", "ALL", "libs/shared-utils/src/api/hr-api.ts#getHrAbsence", "PEP-TIM-018", "BASE:my-leave", "/hr/me/leave", "hris.api.sor.tim.leave", "RETIRE_AGGREGATOR_COMPOSE_CANONICAL", "CANONICAL_COMPOSITION_CONTRACT_AND_ALL_TARGET_SLICES_VERIFIED"),
    "API-SOR-READ-004": ("GET", "/api/people/v1/hr/team", "RETAIN_HRM_COMPOSE", "ALL", "libs/shared-utils/src/api/hr-api.ts#getHrTeam", "PEP-HRM-001|PEP-HRM-002|PEP-HRM-016|PEP-PAY-001|PEP-PER-001|PEP-SYS-028|PEP-TIM-001", "BASE:team-home|BASE:team-members", "/hr/team/home|/hr/team/members", "hris.api.sor.team", "RETIRE_AGGREGATOR_COMPOSE_CANONICAL", "TEAM_HOME_COMPOSITION_AND_HRM_MEMBER_QUERY_VERIFIED"),
    "API-SOR-READ-005": ("GET", "/api/people/v1/hr/team/time", "CUTOVER_TIM", "ALL", "libs/shared-utils/src/api/hr-api.ts#getHrTeamTime", "PEP-TIM-002|PEP-TIM-011", "BASE:team-time", "/hr/team/time", "hris.api.sor.tim.team-time", "RETIRE_AGGREGATOR_COMPOSE_CANONICAL", "CANONICAL_COMPOSITION_CONTRACT_AND_ALL_TARGET_SLICES_VERIFIED"),
    "API-SOR-READ-006": ("GET", "/api/people/v1/hr/team/absence", "CUTOVER_TIM", "ALL", "libs/shared-utils/src/api/hr-api.ts#getHrTeamAbsence", "PEP-TIM-018", "BASE:team-leave", "/hr/team/leave", "hris.api.sor.tim.team-leave", "RETIRE_AGGREGATOR_COMPOSE_CANONICAL", "CANONICAL_COMPOSITION_CONTRACT_AND_ALL_TARGET_SLICES_VERIFIED"),
    "API-SOR-READ-007": ("GET", "/api/people/v1/hr/benefits", "RETAIN_HRM_BENEFITS_SEPARATE_BENSK", "ALL", "libs/shared-utils/src/api/hr-api.ts#getHrBenefits", "modern.benefits.self.plans.query", "MODERN:hcm.personal.benefits", "/hr/me/benefits", "hris.api.sor.hrm.benefits", "REBUILD_CANONICAL_COMPOSITION", "HRM_BENEFITS_SLICE_AND_BENSK_SEPARATION_VERIFIED"),
    "API-SOR-READ-008": ("GET", "/api/people/v1/hr/pay", "CUTOVER_PAY", "ALL", "libs/shared-utils/src/api/hr-api.ts#getHrPay|apps/dwp/src/features/hris/payroll/payroll-api.ts#getHrisPayrollWorkspace", "PEP-PAY-001|PEP-PAY-026", "BASE:my-pay-tax", "/hr/pay", "hris.api.sor.pay", "RETIRE_AGGREGATOR_COMPOSE_CANONICAL", "CANONICAL_COMPOSITION_CONTRACT_AND_ALL_TARGET_SLICES_VERIFIED"),
    "API-SOR-READ-009": ("GET", "/api/people/v1/hr/talent", "CUTOVER_PER", "ALL", "libs/shared-utils/src/api/hr-api.ts#getHrTalent|apps/dwp/src/features/hris/performance/performance-talent-api.ts#getScopedPerformanceTalent", "PEP-PER-001", "BASE:my-goals-performance", "/hr/talent", "hris.api.sor.per", "RETIRE_AGGREGATOR_COMPOSE_CANONICAL", "CANONICAL_COMPOSITION_CONTRACT_AND_ALL_TARGET_SLICES_VERIFIED"),
    "API-SOR-READ-010": ("GET", "/api/people/v1/hr/operations/TIME", "CUTOVER_TIM", "TIME", "libs/shared-utils/src/api/hr-api.ts#getHrDomainOperations:TIME", "PEP-TIM-001|PEP-TIM-011", "BASE:time-command-center", "/hr/operations/time/command-center", "hris.api.sor.tim.operations", "RETIRE_AGGREGATOR_COMPOSE_CANONICAL", "CANONICAL_COMPOSITION_CONTRACT_AND_ALL_TARGET_SLICES_VERIFIED"),
    "API-SOR-READ-011": ("GET", "/api/people/v1/hr/operations/ABSENCE", "CUTOVER_TIM", "ABSENCE", "libs/shared-utils/src/api/hr-api.ts#getHrDomainOperations:ABSENCE", "PEP-TIM-018", "BASE:time-leave-operations", "/hr/operations/time/leave-operations", "hris.api.sor.tim.leave-operations", "RETIRE_AGGREGATOR_COMPOSE_CANONICAL", "CANONICAL_COMPOSITION_CONTRACT_AND_ALL_TARGET_SLICES_VERIFIED"),
    "API-SOR-READ-012": ("GET", "/api/people/v1/hr/operations/BENEFITS", "RETAIN_HRM_BENEFITS_SEPARATE_BENSK", "BENEFITS", "libs/shared-utils/src/api/hr-api.ts#getHrDomainOperations:BENEFITS", "modern.benefits.self.plans.query", "MODERN:hcm.operations.benefits", "/hr/operations/employee-services/benefits", "hris.api.sor.hrm.benefits-operations", "REBUILD_CANONICAL_COMPOSITION", "HRM_BENEFITS_SLICE_AND_BENSK_SEPARATION_VERIFIED"),
    "API-SOR-READ-013": ("GET", "/api/people/v1/hr/operations/PAY", "CUTOVER_PAY", "PAY", "libs/shared-utils/src/api/hr-api.ts#getHrDomainOperations:PAY", "PEP-PAY-001|PEP-PAY-013|PEP-PAY-014", "BASE:pay-command-center", "/hr/operations/payroll/command-center", "hris.api.sor.pay.operations", "RETIRE_AGGREGATOR_COMPOSE_CANONICAL", "CANONICAL_COMPOSITION_CONTRACT_AND_ALL_TARGET_SLICES_VERIFIED"),
    "API-SOR-READ-014": ("GET", "/api/people/v1/hr/operations/TALENT", "CUTOVER_PER", "TALENT", "libs/shared-utils/src/api/hr-api.ts#getHrDomainOperations:TALENT", "PEP-PER-001|PEP-PER-021", "BASE:performance-command-center", "/hr/operations/performance/command-center", "hris.api.sor.per.operations", "RETIRE_AGGREGATOR_COMPOSE_CANONICAL", "CANONICAL_COMPOSITION_CONTRACT_AND_ALL_TARGET_SLICES_VERIFIED"),
    "API-SOR-MUT-001": ("PUT", "/api/people/v1/hr/time/{cardId}/entries/{workDate}", "CUTOVER_TIM", "ALL", "libs/shared-utils/src/api/hr-api.ts#saveHrTimeEntry", "PEP-TIM-012", "BASE:my-time", "/hr/time", "hris.api.sor.tim.time", "REBUILD_CANONICAL_COMMAND", "CANONICAL_COMMAND_ADAPTER_AND_TARGET_SLICE_VERIFIED"),
    "API-SOR-MUT-002": ("POST", "/api/people/v1/hr/time/{cardId}/submit", "CUTOVER_TIM", "ALL", "libs/shared-utils/src/api/hr-api.ts#submitHrTimeCard", "PEP-TIM-013", "BASE:my-time", "/hr/time", "hris.api.sor.tim.time", "REBUILD_CANONICAL_COMMAND", "CANONICAL_COMMAND_ADAPTER_AND_TARGET_SLICE_VERIFIED"),
    "API-SOR-MUT-003": ("POST", "/api/people/v1/hr/absence/requests", "CUTOVER_TIM", "ALL", "libs/shared-utils/src/api/hr-api.ts#createHrLeaveRequest", "PEP-TIM-019", "BASE:my-leave", "/hr/me/leave", "hris.api.sor.tim.leave", "REBUILD_CANONICAL_COMMAND", "CANONICAL_COMMAND_ADAPTER_AND_TARGET_SLICE_VERIFIED"),
    "API-SOR-MUT-004": ("POST", "/api/people/v1/hr/absence/requests/{requestId}/withdraw", "CUTOVER_TIM", "ALL", "libs/shared-utils/src/api/hr-api.ts#withdrawHrLeaveRequest", "PEP-TIM-021", "BASE:my-leave", "/hr/me/leave", "hris.api.sor.tim.leave", "REBUILD_CANONICAL_COMMAND", "CANONICAL_COMMAND_ADAPTER_AND_TARGET_SLICE_VERIFIED"),
    "API-SOR-MUT-005": ("POST", "/api/people/v1/hr/time/{cardId}/decision", "CUTOVER_TIM", "TIME", "libs/shared-utils/src/api/hr-api.ts#decideHrRequest:time", "PEP-TIM-014", "BASE:time-command-center", "/hr/operations/time/command-center", "hris.api.sor.tim.operations", "REBUILD_CANONICAL_COMMAND", "CANONICAL_COMMAND_ADAPTER_AND_TARGET_SLICE_VERIFIED"),
    "API-SOR-MUT-006": ("POST", "/api/people/v1/hr/absence/requests/{requestId}/decision", "CUTOVER_TIM", "ABSENCE", "libs/shared-utils/src/api/hr-api.ts#decideHrRequest:absence", "PEP-TIM-020", "BASE:time-leave-operations", "/hr/operations/time/leave-operations", "hris.api.sor.tim.leave-operations", "REBUILD_CANONICAL_COMMAND", "CANONICAL_COMMAND_ADAPTER_AND_TARGET_SLICE_VERIFIED"),
    "API-SOR-MUT-007": ("POST", "/api/people/v1/hr/team/time/{cardId}/decision", "CUTOVER_TIM", "TIME", "libs/shared-utils/src/api/hr-api.ts#decideHrTeamRequest:time", "PEP-TIM-014", "BASE:team-time", "/hr/team/time", "hris.api.sor.tim.team-time", "REBUILD_CANONICAL_COMMAND", "CANONICAL_COMMAND_ADAPTER_AND_TARGET_SLICE_VERIFIED"),
    "API-SOR-MUT-008": ("POST", "/api/people/v1/hr/team/absence/{requestId}/decision", "CUTOVER_TIM", "ABSENCE", "libs/shared-utils/src/api/hr-api.ts#decideHrTeamRequest:absence", "PEP-TIM-020", "BASE:team-leave", "/hr/team/leave", "hris.api.sor.tim.team-leave", "REBUILD_CANONICAL_COMMAND", "CANONICAL_COMMAND_ADAPTER_AND_TARGET_SLICE_VERIFIED"),
    "API-SOR-MUT-009": ("PUT", "/api/people/v1/hr/talent/goals/{goalId}", "CUTOVER_PER", "ALL", "libs/shared-utils/src/api/hr-api.ts#updateHrGoal", "PEP-PER-010", "BASE:my-goals-performance", "/hr/talent", "hris.api.sor.per", "REBUILD_CANONICAL_COMMAND", "CANONICAL_COMMAND_ADAPTER_AND_TARGET_SLICE_VERIFIED"),
}


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def split_refs(value: str) -> set[str]:
    return {item for item in value.split("|") if item}


def configured_frontend_root(worktree_rows: list[dict[str, str]]) -> Path:
    matches = [Path(row.get("worktree_path", "")) for row in worktree_rows if row.get("session_id") == "CONTROL" and row.get("repository") == "DWP_FRONTEND"]
    if len(matches) != 1:
        raise ValueError("worktree register must name exactly one Control frontend root")
    return matches[0]


def extract_source_snapshot(frontend_root: Path) -> dict[str, Any]:
    text = (frontend_root / HR_API).read_text(encoding="utf-8")
    base_match = re.search(r"const\s+BASE\s*=\s*['\"](/api/people/v1/hr)['\"]", text)
    if not base_match:
        raise ValueError("hr-api.ts canonical legacy BASE declaration is missing")
    base = base_match.group(1)
    operations: set[tuple[str, str]] = set()
    symbols: set[str] = set()
    export_starts = list(re.finditer(r"\bexport\s+(?:const|async\s+function)\s+([A-Za-z0-9_]+)", text))
    bodies: dict[str, str] = {}
    for index, match in enumerate(export_starts):
        end = export_starts[index + 1].start() if index + 1 < len(export_starts) else len(text)
        bodies[match.group(1)] = text[match.start():end]
    getters = {name for name in bodies if name.startswith("getHr") and name != "getHrWorkforceOperationsOverview"}
    required_getters = {"getHrHome", "getHrTime", "getHrAbsence", "getHrTeam", "getHrTeamTime", "getHrTeamAbsence", "getHrBenefits", "getHrPay", "getHrTalent", "getHrDomainOperations"}
    if getters != required_getters:
        raise ValueError(f"legacy HR getter export drift: {sorted(getters ^ required_getters)}")
    for name in sorted(getters - {"getHrDomainOperations"}):
        route = re.search(r"\bget<[^>]+>\(\s*['\"](/[^'\"]+)['\"]", bodies[name], re.DOTALL)
        if not route:
            raise ValueError(f"{name}: legacy GET route is not statically extractable")
        operations.add(("GET", base + route.group(1)))
        symbols.add(f"{HR_API}#{name}")
    domain_type = re.search(r"export type HrDomainOperations\s*=\s*\{(?P<body>.*?)\n\};", text, re.DOTALL)
    domain_line = re.search(r"\bdomain:\s*([^;]+);", domain_type.group("body") if domain_type else "")
    domains = re.findall(r"'([A-Z]+)'", domain_line.group(1) if domain_line else "")
    if not domains or "`/operations/${encodeURIComponent(domain)}`" not in bodies.get("getHrDomainOperations", ""):
        raise ValueError("getHrDomainOperations must use its closed typed domain route")
    for domain in domains:
        operations.add(("GET", f"{base}/operations/{domain}"))
        symbols.add(f"{HR_API}#getHrDomainOperations:{domain}")
    mutation_block = re.search(r"export const HCM_HR_MUTATION_API_CONTRACTS\s*=\s*\[(?P<body>.*?)\]\s+as const;", text, re.DOTALL)
    if not mutation_block:
        raise ValueError("HCM_HR_MUTATION_API_CONTRACTS is missing")
    pattern = re.compile(r"apiFunction:\s*'(?P<symbol>[^']+)'.*?method:\s*'(?P<method>[A-Z]+)'.*?path:\s*'(?P<path>/api/people/v1/hr[^']+)'", re.DOTALL)
    mutations = list(pattern.finditer(mutation_block.group("body")))
    if len(mutations) != 9:
        raise ValueError(f"legacy HR mutation registry must expose exactly 9 operations; got {len(mutations)}")
    for match in mutations:
        operations.add((match.group("method"), match.group("path")))
        symbols.add(f"{HR_API}#{match.group('symbol')}")
    source_files = {HR_API, "apps/dwp/src/features/hris/time/hris-time-data-source.ts", "apps/dwp/src/features/hris/payroll/payroll-api.ts", "apps/dwp/src/features/hris/performance/performance-talent-api.ts"}
    texts = {path: (frontend_root / path).read_text(encoding="utf-8") for path in source_files}
    full_literals: set[str] = set()
    all_expected_refs = split_refs("|".join(expected[4] for expected in EXPECTED.values()))
    for path, source in texts.items():
        full_literals |= {literal for literal in re.findall(r"['\"](/api/people/v1/hr[^'\"]*)['\"]", source) if literal != base}
        for ref in all_expected_refs:
            ref_path, symbol = ref.split("#", 1)
            if ref_path == path and re.search(rf"\b{re.escape(symbol.split(':', 1)[0])}\b", source):
                symbols.add(ref)
    return {"root": str(frontend_root), "operations": operations, "symbols": symbols, "full_literals": full_literals}


def primary_contract_owners(slice_rows: list[dict[str, str]]) -> dict[str, list[tuple[str, str]]]:
    result: dict[str, list[tuple[str, str]]] = {}
    for row in slice_rows:
        if row.get("implementation_state", "").startswith("RETIRED"):
            continue
        for ref in split_refs(row.get("primary_contract_refs", "")):
            result.setdefault(ref, []).append((row.get("slice_id", ""), row.get("session_id", "")))
    return result


def validate_data(transitions: list[dict[str, str]], pep_rows: list[dict[str, str]], service_pep_rows: list[dict[str, str]], slice_rows: list[dict[str, str]], ia_rows: list[dict[str, str]], allocation_rows: list[dict[str, str]], compatibility_rows: list[dict[str, str]], source: dict[str, Any], header: list[str] | None = None) -> list[str]:
    errors: list[str] = []
    if header is not None and header != HEADER:
        errors.append("transition register header must match the exact v2 schema")
    by_id = {row.get("transition_id", ""): row for row in transitions}
    if len(transitions) != 23 or len(by_id) != len(transitions) or set(by_id) != set(EXPECTED):
        errors.append("transition register must contain the exact 14 read variants and 9 mutations")
    pep_by_id = {row.get("binding_id", ""): row for row in pep_rows}
    service_pep_by_id = {row.get("binding_id", ""): row for row in service_pep_rows}
    primary = primary_contract_owners(slice_rows)
    ia_by_id = {row.get("ia_node_id", ""): row for row in ia_rows}
    allocation_by_id = {row.get("allocation_id", ""): row for row in allocation_rows}
    legacy_pairs: list[tuple[str, str]] = []
    all_source_refs: set[str] = set()
    for transition_id, expected in EXPECTED.items():
        row = by_id.get(transition_id, {})
        observed = (row.get("legacy_method"), row.get("legacy_browser_path"), row.get("disposition"), row.get("source_variant"), row.get("legacy_source_refs"), row.get("canonical_contract_refs"), row.get("canonical_ia_node_refs"), row.get("canonical_browser_paths"), row.get("feature_flag"), row.get("composition_mode"), row.get("retirement_gate"))
        if observed != expected:
            errors.append(f"{transition_id}: exact source/disposition/composition decision drift")
        legacy_pairs.append((row.get("legacy_method", ""), row.get("legacy_browser_path", "")))
        source_refs = split_refs(row.get("legacy_source_refs", ""))
        if not source_refs or not source_refs <= set(source.get("symbols", set())):
            errors.append(f"{transition_id}: one or more exact source symbols are missing from current frontend")
        if all_source_refs & source_refs:
            errors.append(f"{transition_id}: legacy source reference assigned to more than one transition")
        all_source_refs |= source_refs
        contracts = split_refs(row.get("canonical_contract_refs", ""))
        contract_owners: set[str] = set()
        contract_slices: set[str] = set()
        aliases: dict[str, set[str]] = {}
        for ref in contracts:
            if ref.startswith("PEP-"):
                binding = pep_by_id.get(ref, {})
                if binding.get("state") != "G3_BINDING_SPECIFIED_NOT_IMPLEMENTED":
                    errors.append(f"{transition_id}: {ref} is not a READY canonical PEP binding")
                aliases[ref] = {ref, binding.get("source_operation_id", "")}
            elif ref.startswith("SVC-PEP-"):
                binding = service_pep_by_id.get(ref, {})
                if binding.get("state") != "G3_BINDING_SPECIFIED_NOT_IMPLEMENTED":
                    errors.append(f"{transition_id}: {ref} is not a READY internal service binding")
                aliases[ref] = {ref}
            else:
                aliases[ref] = {ref, f"MODOP:{ref}"}
            owners = primary.get(ref, [])
            if len(owners) != 1:
                errors.append(f"{transition_id}: {ref} must have exactly one active primary slice")
                continue
            contract_slices.add(owners[0][0])
            contract_owners.add(owners[0][1])
        if split_refs(row.get("cutover_slice_ids", "")) != contract_slices:
            errors.append(f"{transition_id}: cutover slices differ from primary contract ownership")
        if split_refs(row.get("canonical_owner_sessions", "")) != contract_owners:
            errors.append(f"{transition_id}: canonical owner sessions differ from primary contract ownership")
        ia_refs = split_refs(row.get("canonical_ia_node_refs", ""))
        ia_contracts: set[str] = set()
        ia_routes: set[str] = set()
        ia_owners: set[str] = set()
        for ia_ref in ia_refs:
            ia_row = ia_by_id.get(ia_ref)
            if not ia_row:
                errors.append(f"{transition_id}: canonical IA node {ia_ref} is missing")
                continue
            ia_contracts |= split_refs(ia_row.get("api_contract_refs", ""))
            ia_routes.add(ia_row.get("canonical_route", ""))
            ia_owners.add(ia_row.get("owner_session", ""))
        if ia_routes != split_refs(row.get("canonical_browser_paths", "")):
            errors.append(f"{transition_id}: canonical UI routes differ from IA source of truth")
        for ref, candidates in aliases.items():
            if not (candidates - {""}) & ia_contracts:
                errors.append(f"{transition_id}: canonical contract {ref} is absent from target IA nodes")
        if not ia_owners <= contract_owners:
            errors.append(f"{transition_id}: every target IA composition owner must own an exact contract and slice")
        allocation = allocation_by_id.get(row.get("transition_adapter_allocation_id", ""), {})
        if row.get("transition_adapter_allocation_id") != "G3-CTL-FE-HRIS-API-TRANSITION" or allocation.get("session_id") != "CONTROL" or allocation.get("repository") != "DWP_FRONTEND" or allocation.get("artifact_class") != "CENTRAL_ROUTE_TRANSITION" or allocation.get("state") != "ALLOCATED_G3_NOT_IMPLEMENTED":
            errors.append(f"{transition_id}: Control transition adapter allocation drift")
        if row.get("selection_mode") != "EXACTLY_ONE_LEGACY_OR_CANONICAL" or row.get("initial_selection") != "LEGACY_PHASE1" or row.get("direct_url_switch_allowed") != "NO" or any(row.get(field) != "NO" for field in ("dual_read_allowed", "dual_write_allowed", "silent_fallback_allowed", "bensk_state_reuse_allowed")) or row.get("status") != "CONTRACT_DEFINED_G3_BLOCKED_NOT_CUT_OVER" or not row.get("rationale", "").strip():
            errors.append(f"{transition_id}: fail-closed single-SoR policy drift")
        if row.get("legacy_browser_path") in split_refs(row.get("canonical_browser_paths", "")):
            errors.append(f"{transition_id}: aggregate endpoint cannot be treated as a direct URL switch")
        if transition_id.startswith("API-SOR-READ-") and row.get("composition_mode") not in {"RETIRE_AGGREGATOR_COMPOSE_CANONICAL", "REBUILD_CANONICAL_COMPOSITION"}:
            errors.append(f"{transition_id}: aggregate read must name an explicit composition contract")
        if transition_id.startswith("API-SOR-MUT-") and row.get("composition_mode") != "REBUILD_CANONICAL_COMMAND":
            errors.append(f"{transition_id}: mutation must be rebuilt as a canonical command")
    source_operations = set(source.get("operations", set()))
    if set(legacy_pairs) != source_operations or len(legacy_pairs) != len(set(legacy_pairs)):
        errors.append("source-extracted legacy operation universe does not exactly match transition rows")
    unregistered_literals = set(source.get("full_literals", set())) - {path for _, path in legacy_pairs}
    if unregistered_literals:
        errors.append(f"unregistered literal People HR routes: {sorted(unregistered_literals)}")
    absence_mutations = {"/api/people/v1/hr/absence/requests", "/api/people/v1/hr/absence/requests/{requestId}/withdraw", "/api/people/v1/hr/absence/requests/{requestId}/decision", "/api/people/v1/hr/team/absence/{requestId}/decision"}
    if {path for method, path in legacy_pairs if method != "GET" and "absence" in path} != absence_mutations:
        errors.append("all four absence mutations must have exact transition decisions")
    if {row.get("source_variant") for row in transitions if "#getHrDomainOperations:" in row.get("legacy_source_refs", "")} != {"TIME", "ABSENCE", "BENEFITS", "PAY", "TALENT"}:
        errors.append("operations aggregate must be split across its exact five typed domains")
    benefits = [row for row in transitions if "benefits" in row.get("legacy_browser_path", "").lower()]
    if len(benefits) != 2 or any(row.get("disposition") != "RETAIN_HRM_BENEFITS_SEPARATE_BENSK" for row in benefits):
        errors.append("both generic benefits reads must retain HRM ownership and stay separate from BENSK")
    if any("/hr/benefits" in split_refs(row.get("canonical_browser_paths", "")) or "/hr/operations/benefits" in split_refs(row.get("canonical_browser_paths", "")) for row in benefits):
        errors.append("generic HRIS benefits may not reuse either retained BENSK route")
    compatibility = {row.get("decision_id", ""): row for row in compatibility_rows}
    for decision_id in ("ROUTE-DEC-001", "ROUTE-DEC-002"):
        decision = compatibility.get(decision_id, {})
        if decision.get("decision") != "COEXIST_DISTINCT_PRODUCTS" or decision.get("redirect_allowed") != "NO":
            errors.append(f"{decision_id}: BENSK compatibility boundary is not fail closed")
    return errors


def self_test(base: tuple[Any, ...]) -> dict[str, object]:
    cases: dict[str, bool] = {"source-extracted-transition-contract-valid": not validate_data(*base)}
    def rejected(name: str, index: int, field: str, value: str) -> None:
        mutated = tuple(copy.deepcopy(part) for part in base)
        mutated[0][index][field] = value
        cases[name] = bool(validate_data(*mutated))
    rejected("missing-read-surface-rejected", 0, "transition_id", "API-SOR-READ-MISSING")
    rejected("missing-absence-mutation-rejected", 16, "transition_id", "API-SOR-MUT-MISSING")
    rejected("canonical-owner-rehome-rejected", 1, "canonical_owner_sessions", "HRIS-HRM")
    rejected("canonical-contract-rehome-rejected", 1, "canonical_contract_refs", "PEP-HRM-001")
    rejected("wrong-ia-composition-rejected", 2, "canonical_ia_node_refs", "BASE:my-time")
    rejected("wrong-primary-slice-rejected", 3, "cutover_slice_ids", "BASE-TFR-HRM-004")
    rejected("dual-read-rejected", 4, "dual_read_allowed", "YES")
    rejected("dual-write-rejected", 14, "dual_write_allowed", "YES")
    rejected("silent-fallback-rejected", 15, "silent_fallback_allowed", "YES")
    rejected("schema-blind-direct-url-switch-rejected", 7, "direct_url_switch_allowed", "YES")
    rejected("missing-response-composition-rejected", 5, "composition_mode", "DIRECT_URL_SWITCH")
    rejected("bensk-state-reuse-rejected", 6, "bensk_state_reuse_allowed", "YES")
    rejected("bensk-route-alias-rejected", 6, "canonical_browser_paths", "/hr/benefits")
    rejected("feature-direct-source-omission-rejected", 1, "legacy_source_refs", f"{HR_API}#getHrTime")
    rejected("operations-domain-collapse-rejected", 9, "source_variant", "ALL")
    mutated = tuple(copy.deepcopy(part) for part in base)
    mutated[7]["operations"].add(("GET", "/api/people/v1/hr/new-unclassified-surface"))
    cases["new-source-operation-without-decision-rejected"] = bool(validate_data(*mutated))
    mutated = tuple(copy.deepcopy(part) for part in base)
    mutated[7]["full_literals"].add("/api/people/v1/hr/new-direct-call")
    cases["new-direct-legacy-callsite-rejected"] = bool(validate_data(*mutated))
    return {"schema": "dwp.hris.api-sor-transition-self-test.v2", "status": "PASS" if all(cases.values()) else "FAIL", "caseCount": len(cases), "passedCount": sum(cases.values()), "cases": cases}


def load_base() -> tuple[Any, ...]:
    header, transitions = read_csv(REGISTER)
    _, pep_rows = read_csv(PEP)
    _, service_pep_rows = read_csv(SERVICE_PEP)
    _, slice_rows = read_csv(SLICES)
    _, ia_rows = read_csv(IA)
    _, allocation_rows = read_csv(ALLOCATIONS)
    _, compatibility_rows = read_csv(ROUTE_TRANSITIONS)
    _, worktree_rows = read_csv(WORKTREES)
    source = extract_source_snapshot(configured_frontend_root(worktree_rows))
    return transitions, pep_rows, service_pep_rows, slice_rows, ia_rows, allocation_rows, compatibility_rows, source, header


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    try:
        base = load_base()
        if args.self_test:
            payload = self_test(base)
        else:
            errors = validate_data(*base)
            payload = {"schema": "dwp.hris.api-sor-transition.v2", "status": "PASS" if not errors else "FAIL", "transitionCount": len(base[0]), "readVariantCount": sum(row.get("transition_id", "").startswith("API-SOR-READ-") for row in base[0]), "mutationCount": sum(row.get("transition_id", "").startswith("API-SOR-MUT-") for row in base[0]), "sourceOperationCount": len(base[7]["operations"]), "errors": errors}
    except (OSError, csv.Error, ValueError) as error:
        payload = {"schema": "dwp.hris.api-sor-transition.v2", "status": "FAIL", "errors": [str(error)]}
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":") if args.compact else None, indent=None if args.compact else 2))
    return 0 if payload.get("status") == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
