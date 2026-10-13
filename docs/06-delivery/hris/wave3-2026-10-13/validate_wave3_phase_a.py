#!/usr/bin/env python3
"""Independent validator for the HRIS Wave3 Phase A authority bundle.

This validator deliberately does not import the materializer or its constants.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path
from typing import Any


BUNDLE_REL = Path("docs/06-delivery/hris/wave3-2026-10-13")
PREDECESSOR_OVERLAY = Path(
    "docs/06-delivery/hris/g7-delegation/2026-10-12/"
    "successor-slice-overlay.v1.csv"
)
PREDECESSOR_PACKET = Path(
    "docs/06-delivery/hris/g7-delegation-successors/2026-10-12/"
    "mod-per-compplan-r1/packet.v1.json"
)
G7_PER_TIM_PROMOTION = Path(
    "docs/06-delivery/hris/2026-10-12-g7-evidence-promotion-and-delegation-receipt.json"
)
G7_SYS_HRM_PROMOTION = Path(
    "docs/06-delivery/hris/2026-10-12-g7-sys-hrm-promotion-receipt.v2.json"
)
G7_SYS_HRM_INTEGRATION_AUTH = Path(
    "docs/06-delivery/hris/g7-delegation-successors/2026-10-12/"
    "sys-hrm-r3-result-acceptance/runs/sys-hrm-r3-20261012-r3/"
    "integration-authorization.v3.json"
)
G7_SYS_HRM_CLOSURE = Path(
    "docs/06-delivery/hris/g7-delegation-successors/2026-10-12/"
    "sys-hrm-r3-result-acceptance/runs/sys-hrm-r3-20261012-r3/"
    "integrated-closure.v3.json"
)
EXPECTED_WORKFORCE_TEST_ARGV = [
    "./gradlew",
    ":dwp-people-server:test",
    "--tests",
    "com.dwp.services.people.hris.contracts.workforce.v1.CompensationPopulationContractTest",
    "--tests",
    "com.dwp.services.people.hris.contracts.workforce.v1.WorkforceSnapshotContractTest",
    "--tests",
    "com.dwp.services.people.hris.contracts.workforce.v1.WorkforceSnapshotPaginationContractTest",
    "--no-daemon",
]
EXPECTED_WORKFORCE_REPORTS = [
    ("com.dwp.services.people.hris.contracts.workforce.v1.CompensationPopulationContractTest", "TEST-com.dwp.services.people.hris.contracts.workforce.v1.CompensationPopulationContractTest.xml", 2346, "dcd66dd972d9bf8aa6603241cbc573c4ce888f32ae815ddc3b6006301a427fa1", 10),
    ("com.dwp.services.people.hris.contracts.workforce.v1.WorkforceSnapshotContractTest", "TEST-com.dwp.services.people.hris.contracts.workforce.v1.WorkforceSnapshotContractTest.xml", 2225, "740fff035c246defb9621a41d349d5059edba7e5399ccd3a1162aae523d5ef6f", 10),
    ("com.dwp.services.people.hris.contracts.workforce.v1.WorkforceSnapshotPaginationContractTest", "TEST-com.dwp.services.people.hris.contracts.workforce.v1.WorkforceSnapshotPaginationContractTest.xml", 1139, "f68e47dd8d50bef5296c3259cf5030131a434e0c70a1dd59c8fe69fe11fc663d", 4),
]
EXPECTED_WAVE3_COLUMNS = [
    "wave3_classification",
    "wave3_completion_state",
    "wave3_authority",
    "wave3_packet_id",
    "wave3_start_token_id",
    "wave3_dependency_result_pins",
    "wave3_producer_result_pins",
    "wave3_migration_lease_id",
    "wave3_touch_policy_digest",
    "wave3_result_commit_ids",
    "wave3_integration_commit_ids",
    "wave3_evidence_refs",
    "wave3_authority_note",
]
EXPECTED_COMPLETE = {
    "BASE-TFR-HRM-004",
    "BASE-TFR-PAY-007",
    "BASE-TFR-PER-005",
    "BASE-TFR-SYS-004",
    "BASE-TFR-TIM-016",
    "BASE-TFR-PER-006",
    "BASE-TFR-TIM-006",
    "BASE-TFR-SYS-007",
    "BASE-TFR-HRM-010",
    "BASE-TFR-HRM-008",
    "BASE-TFR-TIM-010",
    "BASE-TFR-PAY-006",
    "BASE-TFR-PER-016",
}
EXPECTED_RETIRED = {"BASE-TFR-HRM-006", "BASE-TFR-SYS-013"}
EXPECTED_COMPPLAN_DOMAIN_TABLES = [
    "prf_cmp_cycles",
    "prf_cmp_budget_ledger",
    "prf_cmp_proposals",
    "prf_cmp_proposal_revisions",
    "prf_cmp_approved_snapshots",
    "prf_cmp_approved_snapshot_lines",
]
EXPECTED_WORKFORCE_QUALIFICATION = (
    "CONTRACT_ABI_IMPLEMENTED_TESTED_REGISTERED_GRANTED; owner runtime provider "
    "wiring intentionally fail-closed and remains post-result Central integration"
)
JSON_ARTIFACTS = [
    "authority-refresh.v1.json",
    "narrow-overlap-audit.v1.json",
    "successor-slice-overlay.evidence.v2.json",
    "mod-per-compplan/touch-manifest.v1.json",
    "mod-per-compplan/migration-lease.v1.json",
    "mod-per-compplan/prestart-control-grant-receipt.v1.json",
    "workforce-compensation-targeted-test-execution-receipt.v1.json",
    "mod-per-compplan/packet.v2.json",
    "control-requests.v1.json",
    "state/phase-a.v1.json",
    "manifest.v1.json",
]


def run(*argv: str, cwd: Path) -> str:
    result = subprocess.run(
        argv,
        cwd=cwd,
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return result.stdout.strip()


def git(root: Path, *args: str) -> str:
    return run("git", *args, cwd=root)


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def canonical_sha256(value: dict[str, Any]) -> str:
    payload = dict(value)
    payload.pop("sealedPayloadSha256", None)
    encoded = json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return sha256_bytes(encoded)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    require(isinstance(value, dict), f"{path}: expected JSON object")
    return value


def validate_seal(value: dict[str, Any], label: str) -> None:
    require(
        value.get("sealedPayloadSha256") == canonical_sha256(value),
        f"{label}: invalid sealedPayloadSha256",
    )


def resolve_roots(args: argparse.Namespace) -> tuple[Path, Path, Path]:
    frontend = (
        Path(args.frontend_root).resolve()
        if args.frontend_root
        else Path(run("git", "rev-parse", "--show-toplevel", cwd=Path.cwd())).resolve()
    )
    workspace = frontend.parent
    backend = Path(args.backend_root).resolve() if args.backend_root else workspace / "dwp-backend"
    agent = Path(args.agent_root).resolve() if args.agent_root else workspace / "dwp_agent"
    return frontend, backend, agent


def validate_pin(pin: dict[str, Any], root: Path, label: str, require_clean: bool) -> None:
    head = git(root, "rev-parse", "HEAD")
    tree = git(root, "rev-parse", "HEAD^{tree}")
    upstream = git(root, "rev-parse", "origin/dwp-dev")
    require(pin["branch"] == "dwp-dev", f"{label}: branch pin is not dwp-dev")
    require(pin["commit"] == head == upstream, f"{label}: commit/upstream pin mismatch")
    require(pin["tree"] == tree, f"{label}: tree pin mismatch")
    require(pin["upstream"] == "origin/dwp-dev", f"{label}: upstream ref mismatch")
    if require_clean:
        require(not git(root, "status", "--porcelain=v1"), f"{label}: pin worktree is dirty")


def validate_frontend_pin(
    pin: dict[str, Any],
    root: Path,
    manifest: dict[str, Any],
    allow_phase_a_carrier: bool,
) -> None:
    require(pin["branch"] == "dwp-dev", "frontend: branch pin is not dwp-dev")
    require(pin["upstream"] == "origin/dwp-dev", "frontend: upstream ref mismatch")
    head = git(root, "rev-parse", "HEAD")
    upstream = git(root, "rev-parse", "origin/dwp-dev")
    if not allow_phase_a_carrier:
        require(pin["commit"] == head == upstream, "frontend: commit/upstream pin mismatch")
        require(pin["tree"] == git(root, "rev-parse", "HEAD^{tree}"), "frontend: tree pin mismatch")
        return

    require(head == upstream, "frontend carrier: HEAD must equal origin/dwp-dev")
    require(git(root, "rev-parse", "HEAD^") == pin["commit"], "frontend carrier: HEAD parent is not the pinned pre-carrier commit")
    require(git(root, "rev-parse", f"{pin['commit']}^{{tree}}") == pin["tree"], "frontend carrier: pinned parent tree mismatch")
    expected_paths = {
        row["path"] for row in manifest["artifacts"]
    } | {
        row["path"] for row in manifest["toolPins"]
    } | {str(BUNDLE_REL / "manifest.v1.json")}
    status_rows = git(
        root,
        "diff-tree",
        "--no-commit-id",
        "--name-status",
        "-r",
        "--find-renames",
        "HEAD",
    ).splitlines()
    observed_paths: set[str] = set()
    for line in status_rows:
        columns = line.split("\t")
        require(len(columns) == 2 and columns[0] == "A", f"frontend carrier: non-additive change {line}")
        observed_paths.add(columns[1])
    require(observed_paths == expected_paths, "frontend carrier: commit diff is not exactly the sealed Phase-A bundle")
    require(not git(root, "status", "--porcelain=v1"), "frontend carrier: worktree must be clean")


def validate_manifest(frontend: Path, bundle: Path, manifest: dict[str, Any]) -> None:
    validate_seal(manifest, "manifest")
    require(manifest["artifactCount"] == 11, "manifest: artifactCount must be 11")
    require(manifest["toolCount"] == 4, "manifest: toolCount must be 4")
    require(manifest["startTokenCount"] == 0, "manifest: token count must be zero")
    require(manifest["worktreeBindingCount"] == 0, "manifest: worktree count must be zero")
    require(manifest["promotionReceiptCount"] == 0, "manifest: promotion count must be zero")
    require(manifest["productionAuthorization"] is False, "manifest: production authorization must be false")
    for row in manifest["artifacts"]:
        path = frontend / row["path"]
        payload = path.read_bytes()
        require(len(payload) == row["bytes"], f"manifest: byte drift {row['path']}")
        require(sha256_bytes(payload) == row["sha256"], f"manifest: hash drift {row['path']}")
    for row in manifest["toolPins"]:
        path = frontend / row["path"]
        payload = path.read_bytes()
        require(len(payload) == row["bytes"], f"manifest: tool byte drift {row['path']}")
        require(sha256_bytes(payload) == row["sha256"], f"manifest: tool hash drift {row['path']}")
    forbidden_names = [
        path.relative_to(bundle).as_posix()
        for path in bundle.rglob("*")
        if path.is_file()
        and any(term in path.name.lower() for term in ("start-token", "worktree-register", "promotion-receipt"))
    ]
    require(not forbidden_names, f"Phase A contains forbidden authority artifacts: {forbidden_names}")


def validate_file_ref(frontend: Path, ref: dict[str, Any], label: str) -> None:
    payload = (frontend / ref["path"]).read_bytes()
    require(len(payload) == ref["bytes"], f"{label}: byte drift {ref['path']}")
    require(sha256_bytes(payload) == ref["sha256"], f"{label}: hash drift {ref['path']}")


def validate_g7_lineage(
    frontend: Path,
    by_id: dict[str, dict[str, str]],
    evidence: dict[str, Any],
) -> None:
    source_refs = evidence["g7LineageSources"]
    require(
        set(source_refs)
        == {
            "perTimPromotion",
            "sysHrmPromotion",
            "sysHrmIntegrationAuthorization",
            "sysHrmIntegratedClosure",
        },
        "overlay: G7 lineage source closed set mismatch",
    )
    expected_paths = {
        "perTimPromotion": G7_PER_TIM_PROMOTION,
        "sysHrmPromotion": G7_SYS_HRM_PROMOTION,
        "sysHrmIntegrationAuthorization": G7_SYS_HRM_INTEGRATION_AUTH,
        "sysHrmIntegratedClosure": G7_SYS_HRM_CLOSURE,
    }
    for key, rel in expected_paths.items():
        require(source_refs[key]["path"] == rel.as_posix(), f"overlay: {key} path drift")
        validate_file_ref(frontend, source_refs[key], f"overlay {key}")

    per_tim_promotion = load_json(frontend / G7_PER_TIM_PROMOTION)
    sys_hrm_promotion = load_json(frontend / G7_SYS_HRM_PROMOTION)
    integration_auth = load_json(frontend / G7_SYS_HRM_INTEGRATION_AUTH)
    closure = load_json(frontend / G7_SYS_HRM_CLOSURE)
    per_tim_delegations = {
        row["sliceId"]: row for row in per_tim_promotion["delegations"]
    }
    sys_hrm_delegations = {
        row["sliceId"]: row for row in sys_hrm_promotion["delegations"]
    }
    predecessor_closures = {
        row["tokenId"]: row["state"]
        for row in sys_hrm_promotion["closedPredecessorTokens"]
    }
    final_closures = {row["sliceId"]: row for row in closure["tokenClosures"]}
    authorized_results: dict[str, dict[str, str]] = {}
    for row in integration_auth["authorizedResults"]:
        authorized_results.setdefault(row["sliceId"], {})[row["repo"]] = row["commit"]
    integrated = closure["centralIntegration"]["repositories"]
    integration_commits = (
        f"FE:{integrated['frontend']['integrated']['commit']}|"
        f"BE:{integrated['backend']['integrated']['commit']}"
    )

    exact_authority = {
        "BASE-TFR-PER-006": (
            "G7-START-PER-BASE-TFR-PER-006-R1",
            "G7-LEASE-PER-PERFORMANCE-V2-R1",
        ),
        "BASE-TFR-TIM-006": (
            "G7-START-TIM-BASE-TFR-TIM-006-R1",
            "G7-LEASE-TIM-TIME-V8-R1",
        ),
        "BASE-TFR-SYS-007": (
            "G7-START-SYS-BASE-TFR-SYS-007-R2",
            "G7-LEASE-SYS-PLATFORM-V325-R2",
        ),
        "BASE-TFR-HRM-010": (
            "G7-START-HRM-BASE-TFR-HRM-010-R2",
            "CONTROL_BOOTSTRAP_READ_ONLY_PIN",
        ),
    }
    for slice_id in ("BASE-TFR-PER-006", "BASE-TFR-TIM-006"):
        delegation = per_tim_delegations[slice_id]
        token_id, migration_authority = exact_authority[slice_id]
        require(delegation["tokenId"] == token_id, f"overlay: {slice_id} promotion token drift")
        require(
            predecessor_closures.get(token_id) == "RESULT_INTEGRATED_CLOSED",
            f"overlay: {slice_id} final promotion closure missing",
        )
        token_path = frontend / delegation["tokenPath"]
        token_payload = token_path.read_bytes()
        require(sha256_bytes(token_payload) == delegation["tokenSha256"], f"overlay: {slice_id} token hash drift")
        token = json.loads(token_payload)
        require(token["tokenId"] == token_id, f"overlay: {slice_id} token identity drift")
        require(token["migrationLeaseId"] == migration_authority, f"overlay: {slice_id} lease drift")
        row = by_id[slice_id]
        require(row["wave3_packet_id"] == delegation["packetId"] == token["packetId"], f"overlay: {slice_id} packet lineage drift")
        require(row["wave3_start_token_id"] == token_id, f"overlay: {slice_id} token lineage drift")
        require(row["wave3_dependency_result_pins"] == token["dependencyPinsSha256"], f"overlay: {slice_id} dependency lineage drift")
        require(row["wave3_migration_lease_id"] == migration_authority, f"overlay: {slice_id} migration lineage drift")
        require(row["wave3_touch_policy_digest"] == token["pathPolicySha256"], f"overlay: {slice_id} touch lineage drift")

    for slice_id in ("BASE-TFR-SYS-007", "BASE-TFR-HRM-010"):
        delegation = sys_hrm_delegations[slice_id]
        token_id, migration_authority = exact_authority[slice_id]
        require(delegation["tokenId"] == token_id, f"overlay: {slice_id} promotion token drift")
        closure_row = final_closures[slice_id]
        require(
            closure_row["tokenId"] == token_id
            and closure_row["stateAfterCarrier"] == "RESULT_INTEGRATED_CLOSED",
            f"overlay: {slice_id} integrated closure drift",
        )
        token_path = frontend / delegation["tokenPath"]
        token_payload = token_path.read_bytes()
        require(sha256_bytes(token_payload) == delegation["tokenSha256"], f"overlay: {slice_id} token hash drift")
        token = json.loads(token_payload)
        require(token["tokenId"] == token_id, f"overlay: {slice_id} token identity drift")
        if slice_id == "BASE-TFR-SYS-007":
            require(delegation["migrationLeaseId"] == migration_authority, "overlay: SYS promotion lease drift")
            require(token["migrationLeaseId"] == migration_authority, "overlay: SYS token lease drift")
        else:
            require(delegation["migrationAuthorityMode"] == migration_authority, "overlay: HRM promotion authority drift")
            require(token["authority"]["migrationAuthorityMode"] == migration_authority, "overlay: HRM token authority drift")
        result_commits = (
            f"FE:{authorized_results[slice_id]['frontend']}|"
            f"BE:{authorized_results[slice_id]['backend']}"
        )
        row = by_id[slice_id]
        require(row["wave3_packet_id"] == delegation["packetId"] == token["packetId"], f"overlay: {slice_id} packet lineage drift")
        require(row["wave3_start_token_id"] == token_id, f"overlay: {slice_id} token lineage drift")
        require(row["wave3_dependency_result_pins"] == token["dependencyPinsSha256"], f"overlay: {slice_id} dependency lineage drift")
        require(row["wave3_migration_lease_id"] == migration_authority, f"overlay: {slice_id} migration lineage drift")
        require(row["wave3_touch_policy_digest"] == token["pathPolicySha256"], f"overlay: {slice_id} touch lineage drift")
        require(row["wave3_result_commit_ids"] == result_commits, f"overlay: {slice_id} result commit lineage drift")
        require(row["wave3_integration_commit_ids"] == integration_commits, f"overlay: {slice_id} integration commit lineage drift")


def validate_overlay(frontend: Path, bundle: Path, evidence: dict[str, Any]) -> None:
    predecessor_path = frontend / PREDECESSOR_OVERLAY
    successor_path = bundle / "successor-slice-overlay.v2.csv"
    with predecessor_path.open(newline="", encoding="utf-8") as handle:
        predecessor_reader = csv.DictReader(handle)
        predecessor_columns = list(predecessor_reader.fieldnames or [])
        predecessor_rows = list(predecessor_reader)
    with successor_path.open(newline="", encoding="utf-8") as handle:
        successor_reader = csv.DictReader(handle)
        successor_columns = list(successor_reader.fieldnames or [])
        successor_rows = list(successor_reader)
    require(len(predecessor_columns) == 42, "overlay: predecessor column count drift")
    require(successor_columns == predecessor_columns + EXPECTED_WAVE3_COLUMNS, "overlay: appended columns differ")
    require(len(predecessor_rows) == len(successor_rows) == 102, "overlay: expected 102 rows")
    require(len({row["slice_id"] for row in successor_rows}) == 102, "overlay: duplicate slice ID")
    for before, after in zip(predecessor_rows, successor_rows):
        require(before["slice_id"] == after["slice_id"], "overlay: row order changed")
        for column in predecessor_columns:
            require(before[column] == after[column], f"overlay: predecessor value changed at {before['slice_id']}:{column}")
    complete = {
        row["slice_id"]
        for row in successor_rows
        if row["wave3_classification"].startswith("INTEGRATED_COMPLETE")
    }
    retired = {
        row["slice_id"]
        for row in successor_rows
        if row["wave3_classification"] == "RETIRED_UNCHANGED"
    }
    require(complete == EXPECTED_COMPLETE, "overlay: exact completed closed set mismatch")
    require(retired == EXPECTED_RETIRED, "overlay: exact retired closed set mismatch")
    require(len(successor_rows) - len(complete) - len(retired) == 87, "overlay: remaining active count mismatch")
    by_id = {row["slice_id"]: row for row in successor_rows}
    compplan = by_id["MOD-PER-COMPPLAN"]
    require(compplan["wave3_classification"] == "PREPARED_STALE_REISSUE_REQUIRED", "overlay: compplan stale classification missing")
    require(compplan["wave3_start_token_id"] == "NONE", "overlay: compplan token must be absent")
    require("V17" in compplan["wave3_migration_lease_id"], "overlay: compplan V17 lease missing")
    require(by_id["BASE-TFR-PAY-016"]["wave3_completion_state"] == "DEPENDENCY_BLOCKED", "overlay: PAY-016 must remain blocked")
    validate_seal(evidence, "overlay evidence")
    validate_g7_lineage(frontend, by_id, evidence)
    payload = successor_path.read_bytes()
    require(evidence["successor"]["sha256"] == sha256_bytes(payload), "overlay evidence: successor hash drift")
    require(evidence["successor"]["classificationCounts"] == dict(sorted(Counter(row["wave3_classification"] for row in successor_rows).items())), "overlay evidence: classification counts drift")


def validate_packet_and_gates(
    frontend: Path,
    bundle: Path,
    docs: dict[str, dict[str, Any]],
) -> None:
    packet = docs["mod-per-compplan/packet.v2.json"]
    lease = docs["mod-per-compplan/migration-lease.v1.json"]
    touch = docs["mod-per-compplan/touch-manifest.v1.json"]
    requests = docs["control-requests.v1.json"]
    grant = docs["mod-per-compplan/prestart-control-grant-receipt.v1.json"]
    state = docs["state/phase-a.v1.json"]
    overlap = docs["narrow-overlap-audit.v1.json"]
    authority = docs["authority-refresh.v1.json"]

    for name, value in docs.items():
        validate_seal(value, name)
    require(packet["lifecycleState"] == "PACKET_PREPARED_START_WITHHELD", "packet: wrong lifecycle")
    require(packet["startTokenId"] is None and packet["worktreeBindings"] == [], "packet: token/worktree must be absent")
    require(packet["contractPins"]["predecessorDisposition"] == "PREPARED_STALE_REISSUE_REQUIRED", "packet: stale predecessor disposition missing")
    require(packet["contractPins"]["authorizationBundleFileSha256"] == "de449058055b5ae9500489735910fdcf593b34a9ab05e927663a7fd74d740667", "packet: authorization bundle file pin mismatch")
    require(all(value is False for value in packet["authority"].values()), "packet: Phase A authority must all be false")
    require(lease["currentHighWater"] == "V16", "lease: high-water must be V16")
    require(lease["reservedVersion"] == "V17", "lease: must reserve V17")
    require(lease["outOfOrder"] is False and lease["admission"] is False, "lease: outOfOrder/admission invariant failed")
    require(lease["exactPath"].endswith("/V17__per_modern_compensation_planning.sql"), "lease: exact path mismatch")
    require(lease["tableAllocation"]["domainTableCount"] == 6, "lease: expected six domain tables")
    require(lease["tableAllocation"]["domainTables"] == EXPECTED_COMPPLAN_DOMAIN_TABLES, "lease: domain table closed set mismatch")
    require(lease["tableAllocation"]["sharedFoundationTables"] == ["prf_per_artifact_versions"], "lease: shared foundation table mismatch")
    require(lease["tableAllocation"]["totalTableCount"] == 7, "lease: total table count must be seven")
    require(touch["moduleMayEditCommonControlPaths"] is False and touch["sourceChangeAuthority"] is False, "touch: authority leak")
    predecessor = load_json(frontend / PREDECESSOR_PACKET)
    predecessor_control_only = predecessor["pathPolicy"]["commonControlOnlyPaths"]
    predecessor_payload = json.dumps(
        predecessor_control_only,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    additional_control_only = touch["wave3AdditionalCommonControlOnlyPaths"]
    require(additional_control_only == [], "touch: unreviewed Wave3 common-Control additions")
    require(touch["commonControlOnlyPaths"] == predecessor_control_only + additional_control_only, "touch: predecessor common-Control closed set was omitted, reordered, narrowed, or replaced")
    require(touch["predecessorCommonControlOnlyPathCount"] == len(predecessor_control_only) == 68, "touch: predecessor common-Control count mismatch")
    require(touch["predecessorCommonControlOnlyPathsSha256"] == sha256_bytes(predecessor_payload), "touch: predecessor common-Control digest mismatch")
    require(touch["commonControlOnlyPathCount"] == len(touch["commonControlOnlyPaths"]), "touch: common-Control total count mismatch")
    require(touch["commonControlOnlyPathInheritance"] == "EXACT_PREDECESSOR_CLOSED_SET_PLUS_WAVE3_UNION", "touch: common-Control inheritance rule mismatch")
    control_selectors = {row["selector"] for row in touch["commonControlOnlyPaths"]}
    required_control_selectors = {
        "contracts/hris/**",
        "contracts/in-process/hris/workforce-snapshot-query-port.v1.schema.json",
        "dwp-platform-contracts/src/main/java/com/dwp/contracts/hris/xcon/v1/**",
        "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/generated/**",
        "dwp-people-server/src/main/java/com/dwp/services/people/hris/contracts/workforce/v1/**",
        "dwp-people-server/src/test/java/com/dwp/services/people/hris/contracts/workforce/v1/**",
    }
    require(required_control_selectors <= control_selectors, "touch: critical common-Control boundary is missing")
    require("dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/**" not in control_selectors, "touch: abbreviated platform-contract path must not replace exact XCON/generated roots")
    require(packet["ownership"] == {
        "ownerAgent": "HRIS-PER",
        "reviewer": "HRIS-INTEGRATION-CONTROL",
        "singleWriter": "HRIS-PER",
    }, "packet: owner/reviewer/single-writer binding mismatch")
    require(packet["uiWorkContract"] == predecessor["uiWorkContract"], "packet: predecessor UI work contract semantic drift")
    predecessor_verification = predecessor["verification"]
    expected_criteria = [
        (
            "clean empty-schema or V16-to-V17 upgrade, RLS, and append-only enforcement"
            if invariant
            == "clean V1 through V4 upgrade, RLS, and append-only enforcement"
            else invariant
        )
        for invariant in predecessor_verification["acceptanceInvariants"]
    ]
    criteria = packet["acceptanceCriteria"]
    require(len(criteria) == len(expected_criteria) > 0, "packet: acceptance criteria count mismatch")
    require([row["criterion"] for row in criteria] == expected_criteria, "packet: acceptance criteria semantic drift")
    require(all(row["id"] and row["verificationCommandIds"] for row in criteria), "packet: empty acceptance criterion binding")
    require(not any("V4" in row["criterion"] for row in criteria), "packet: stale V4 acceptance wording")
    require("clean empty-schema or V16-to-V17 upgrade, RLS, and append-only enforcement" in [row["criterion"] for row in criteria], "packet: exact V16-to-V17 upgrade acceptance is missing")
    verification = packet["verificationBindings"]
    require(verification["executionPolicy"] == predecessor_verification["executionPolicy"], "packet: verification execution policy drift")
    require(verification["backendTestsExact"] == predecessor_verification["backendTests"], "packet: backend test closed set drift")
    require(verification["frontendTestsExact"] == predecessor_verification["frontendTestsExact"], "packet: frontend test closed set drift")
    require(verification["platformTestsExact"] == predecessor_verification["platformTestsExact"], "packet: platform test closed set drift")
    require(verification["providerTestsExact"] == predecessor_verification["providerTestsExact"], "packet: provider test closed set drift")
    require(verification["namedCommands"] == predecessor_verification["namedCommands"], "packet: named command argv drift")
    require(len(verification["namedCommands"]) == 3, "packet: exactly three named verification commands required")
    command_ids = {row["commandId"] for row in verification["namedCommands"]}
    require(command_ids == {"PER_COMPPLAN_BACKEND_CLOSED", "PER_COMPPLAN_PLATFORM_XCON021_CLOSED", "PER_COMPPLAN_FRONTEND_CLOSED"}, "packet: named command closed set mismatch")
    require(all(row.get("cwd") in {"frontend", "backend"} and isinstance(row.get("argv"), list) and len(row["argv"]) >= 3 and all(isinstance(arg, str) and arg for arg in row["argv"]) for row in verification["namedCommands"]), "packet: named command is empty or label-only")
    require(all(set(row["verificationCommandIds"]) == command_ids for row in criteria), "packet: acceptance criterion command binding mismatch")
    allocation = touch["typedArtifactBootstrapAllocation"]
    require(allocation["state"] == "ALLOCATED_REGISTERED_GRANTED", "touch: typed-artifact allocation is not granted")
    require(allocation["migrationAllocation"]["sharedFoundationTables"] == ["prf_per_artifact_versions"], "touch: shared foundation allocation mismatch")
    require(allocation["migrationAllocation"]["domainTables"] == EXPECTED_COMPPLAN_DOMAIN_TABLES, "touch: domain table closed set mismatch")
    prestart = [row for row in requests["requests"] if row["requiredBeforeStartToken"]]
    require(len(prestart) == 2, "requests: exactly two pre-start requests required")
    require({row["category"] for row in prestart} == {"TYPED_ARTIFACT_BOOTSTRAP", "WORKFORCE_SNAPSHOT_COMPENSATION_PROJECTION"}, "requests: pre-start closed set mismatch")
    prestart_states = {row["category"]: row["fulfillmentState"] for row in prestart}
    require(prestart_states == {
        "TYPED_ARTIFACT_BOOTSTRAP": "ALLOCATED_REGISTERED_GRANTED",
        "WORKFORCE_SNAPSHOT_COMPENSATION_PROJECTION": "IMPLEMENTED_TESTED_REGISTERED_GRANTED",
    }, "requests: fulfilled pre-start state mismatch")
    workforce_request = next(row for row in prestart if row["category"] == "WORKFORCE_SNAPSHOT_COMPENSATION_PROJECTION")
    require(workforce_request["fulfillmentQualification"] == EXPECTED_WORKFORCE_QUALIFICATION, "requests: workforce fulfillment is over- or under-claimed")
    post_result = [row for row in requests["requests"] if not row["requiredBeforeStartToken"]]
    require(len(post_result) == 5, "requests: exactly five post-result requests required")
    require(all(row["fulfillmentState"] == "REGISTERED_WITH_FULFILLMENT_AFTER_RESULT" for row in post_result), "requests: post-result state mismatch")
    integration_request = next(row for row in post_result if row["category"] == "INTEGRATION_VERIFY")
    owner_wiring_obligation = "wire and test HRM owner runtime compensation projection before central integration acceptance"
    require(owner_wiring_obligation in integration_request["scope"], "requests: post-result HRM owner runtime wiring obligation missing")
    require(owner_wiring_obligation in packet["deliverables"], "packet: post-result HRM owner runtime wiring deliverable missing")
    require(grant["status"] == "PASS_TWO_PRESTART_CONDITIONS_FULFILLED", "grant: two-condition pass missing")
    grant_states = {row["category"]: row["state"] for row in grant["conditions"]}
    require(grant_states == prestart_states, "grant: condition states do not match request register")
    typed_grant = next(row for row in grant["conditions"] if row["category"] == "TYPED_ARTIFACT_BOOTSTRAP")
    require(typed_grant["domainTables"] == EXPECTED_COMPPLAN_DOMAIN_TABLES, "grant: domain table closed set mismatch")
    require(typed_grant["sharedFoundationTables"] == ["prf_per_artifact_versions"], "grant: shared foundation table mismatch")
    require(packet["preStartControlGrant"]["sealedPayloadSha256"] == grant["sealedPayloadSha256"], "packet: grant seal mismatch")
    require(grant["controlAuthority"]["typedArtifactPathAllocationGranted"] is True, "grant: typed-artifact allocation missing")
    require(grant["controlAuthority"]["sharedFoundationTableAllocationGranted"] is True, "grant: table allocation missing")
    require(grant["controlAuthority"]["workforceProjectionAcceptanceGranted"] is True, "grant: workforce acceptance missing")
    forbidden_grant_authority = {
        key: value
        for key, value in grant["controlAuthority"].items()
        if key not in {
            "typedArtifactPathAllocationGranted",
            "sharedFoundationTableAllocationGranted",
            "workforceProjectionAcceptanceGranted",
        }
    }
    require(all(value is False for value in forbidden_grant_authority.values()), "grant: execution authority leak")
    require(state["activeTokens"] == [] and state["activeWorktrees"] == [] and state["promotionReceipts"] == [], "state: forbidden issued authority")
    true_gates = {key for key, value in state["controlGates"].items() if value}
    require(true_gates == {"typedArtifactBootstrapFulfilled", "workforceCompensationProjectionFulfilled"}, "state: only two pre-start gates may be true")
    require(overlap["result"] == "PASS_NO_DIRECT_IMPLEMENTATION_OVERLAP_AND_PRESTART_CONDITIONS_FULFILLED", "overlap: result is not pass")
    require(authority["decision"]["bothPreStartConditionsFulfilled"] is True, "authority: pre-start fulfillment missing")
    require(authority["decision"]["startTokenIssued"] is False, "authority: token issued")
    require(authority["decision"]["worktreeRegistered"] is False, "authority: worktree registered")
    require(authority["decision"]["promotionReceiptIssued"] is False, "authority: promotion issued")
    require(authority["decision"]["productionAuthorization"] is False, "authority: production authorized")


def validate_targeted_test_receipt(
    backend: Path,
    docs: dict[str, dict[str, Any]],
) -> None:
    receipt = docs["workforce-compensation-targeted-test-execution-receipt.v1.json"]
    grant = docs["mod-per-compplan/prestart-control-grant-receipt.v1.json"]
    overlap = docs["narrow-overlap-audit.v1.json"]
    authority = docs["authority-refresh.v1.json"]
    require(
        receipt["receiptId"]
        == "HRIS-WAVE3-WORKFORCE-COMPENSATION-TARGETED-TEST-EXECUTION-R1",
        "targeted tests: receipt identity mismatch",
    )
    require(receipt["scope"] == "WORKFORCE_SNAPSHOT_COMPENSATION_CONTRACT_ABI", "targeted tests: scope drift")
    require(receipt["backendPin"] == authority["sourcePins"]["backend"], "targeted tests: backend pin drift")
    require(receipt["backendPin"]["commit"] == "3565c3e61b6c37a6b8088cc5250791fce32a0d9f", "targeted tests: backend commit drift")
    execution = receipt["execution"]
    require(execution["cwd"] == backend.resolve().as_posix(), "targeted tests: execution cwd drift")
    require(execution["argv"] == EXPECTED_WORKFORCE_TEST_ARGV, "targeted tests: exact argv drift")
    require(execution["targetedTestClassCount"] == 3, "targeted tests: target count drift")
    require(execution["broadTestExecution"] is False, "targeted tests: broad execution is forbidden")
    require(execution["processOutcome"] == "BUILD_SUCCESSFUL", "targeted tests: process did not succeed")
    require(receipt["reportCount"] == len(EXPECTED_WORKFORCE_REPORTS) == 3, "targeted tests: report count drift")

    expected_totals = {"tests": 24, "failures": 0, "errors": 0, "skipped": 0}
    observed_totals = {key: 0 for key in expected_totals}
    expected_paths: list[str] = []
    require(len(receipt["reports"]) == 3, "targeted tests: report closed set drift")
    for row, (class_name, file_name, byte_count, digest, test_count) in zip(
        receipt["reports"], EXPECTED_WORKFORCE_REPORTS
    ):
        rel = Path("dwp-people-server/build/test-results/test") / file_name
        expected_paths.append(rel.as_posix())
        require(row["path"] == rel.as_posix(), f"targeted tests: report path drift {file_name}")
        require(row["className"] == class_name, f"targeted tests: class drift {file_name}")
        payload = (backend / rel).read_bytes()
        require(len(payload) == byte_count == row["bytes"], f"targeted tests: byte drift {file_name}")
        require(sha256_bytes(payload) == digest == row["sha256"], f"targeted tests: hash drift {file_name}")
        suite = ET.fromstring(payload)
        require(suite.tag == "testsuite" and suite.attrib.get("name") == class_name, f"targeted tests: suite identity drift {file_name}")
        counts = {
            key: int(suite.attrib.get(key, "0"))
            for key in ("tests", "failures", "errors", "skipped")
        }
        require(counts == {"tests": test_count, "failures": 0, "errors": 0, "skipped": 0}, f"targeted tests: non-pass report {file_name}")
        require(all(row[key] == value for key, value in counts.items()), f"targeted tests: sealed counts drift {file_name}")
        for key, value in counts.items():
            observed_totals[key] += value
    require(
        [row["path"] for row in receipt["reports"]] == expected_paths,
        "targeted tests: report order/closed set drift",
    )
    require(observed_totals == receipt["totals"] == expected_totals, "targeted tests: total must be exact 24 PASS")
    require(receipt["result"] == "PASS_24_TESTS_ZERO_FAILURES_ERRORS_SKIPPED", "targeted tests: result drift")

    workforce_condition = next(
        row
        for row in grant["conditions"]
        if row["category"] == "WORKFORCE_SNAPSHOT_COMPENSATION_PROJECTION"
    )
    require(workforce_condition["state"] == "IMPLEMENTED_TESTED_REGISTERED_GRANTED", "targeted tests: tested grant missing")
    require(workforce_condition["targetedTestExecutionReceiptId"] == receipt["receiptId"], "targeted tests: grant receipt ID drift")
    require(workforce_condition["targetedTestExecutionReceiptSeal"] == receipt["sealedPayloadSha256"], "targeted tests: grant receipt seal drift")
    require(workforce_condition["targetedTestResult"] == receipt["result"], "targeted tests: grant result drift")
    require(workforce_condition["targetedTestTotals"] == expected_totals, "targeted tests: grant totals drift")
    overlap_check = next(
        row
        for row in overlap["checks"]
        if row["id"] == "WORKFORCE_COMPENSATION_PROJECTION_IMPLEMENTED_TESTED_REGISTERED_GRANTED"
    )
    require(overlap_check["targetedTestExecutionReceiptId"] == receipt["receiptId"], "targeted tests: overlap receipt ID drift")
    require(overlap_check["targetedTestExecutionReceiptSeal"] == receipt["sealedPayloadSha256"], "targeted tests: overlap receipt seal drift")
    require(overlap_check["targetedTestTotals"] == expected_totals, "targeted tests: overlap totals drift")


def validate_runtime_state(
    frontend: Path,
    backend: Path,
    agent: Path,
    authority: dict[str, Any],
    grant: dict[str, Any],
    manifest: dict[str, Any],
    allow_phase_a_carrier: bool,
) -> None:
    pins = authority["sourcePins"]
    validate_frontend_pin(
        pins["frontend"], frontend, manifest, allow_phase_a_carrier
    )
    validate_pin(pins["backend"], backend, "backend", require_clean=True)
    validate_pin(pins["agent"], agent, "agent", require_clean=True)
    frontend_status = git(frontend, "status", "--porcelain=v1")
    if allow_phase_a_carrier:
        require(not frontend_status, "frontend carrier: worktree must be clean")
    else:
        for line in frontend_status.splitlines():
            path = line[3:]
            if " -> " in path:
                path = path.split(" -> ", 1)[1]
            require(path.startswith(BUNDLE_REL.as_posix() + "/"), f"frontend: out-of-bundle change {line}")

    expected_predecessor_keys = {
        "currentSliceStatusV1",
        "currentSliceStatusEvidenceV1",
        "wave2Start",
        "wave2SharedWiring",
        "g7PerTimPromotion",
        "g7SysHrmPromotion",
        "g7SysHrmIntegrationAuthorization",
        "g7SysHrmClosure",
        "g7Overlay",
        "g7RoadmapStatus",
        "developmentAgentPacketTemplate",
    }
    require(set(authority["predecessorEvidence"]) == expected_predecessor_keys, "frontend: predecessor evidence closed set mismatch")
    for ref in authority["predecessorEvidence"].values():
        payload = (frontend / ref["path"]).read_bytes()
        require(len(payload) == ref["bytes"], f"frontend: predecessor byte drift {ref['path']}")
        require(sha256_bytes(payload) == ref["sha256"], f"frontend: predecessor hash drift {ref['path']}")

    versions = []
    migration_root = backend / "dwp-people-server/src/main/resources/db/performance-migration"
    for path in migration_root.glob("V*__*.sql"):
        match = re.match(r"V(\d+)__", path.name)
        if match:
            versions.append(int(match.group(1)))
    require(sorted(versions) == [1, 2, 3, 16], f"backend: Performance versions changed: {sorted(versions)}")
    require(not (migration_root / "V17__per_modern_compensation_planning.sql").exists(), "backend: V17 is no longer vacant")
    workforce = (backend / "contracts/in-process/hris/workforce-snapshot-query-port.v1.schema.json").read_text(encoding="utf-8")
    require("HRIS_PER_COMPENSATION_POPULATION" in workforce, "backend: compensation projection permission is missing")
    require("COMPENSATION_POPULATION_V1" in workforce, "backend: compensation projection version is missing")
    workforce_condition = next(
        row
        for row in grant["conditions"]
        if row["category"] == "WORKFORCE_SNAPSHOT_COMPENSATION_PROJECTION"
    )
    require(workforce_condition["state"] == "IMPLEMENTED_TESTED_REGISTERED_GRANTED", "backend: workforce grant state mismatch")
    require(workforce_condition["fulfillmentQualification"] == EXPECTED_WORKFORCE_QUALIFICATION, "backend: workforce fulfillment qualification mismatch")
    observed_markers: set[str] = set()
    evidence_paths: set[str] = set()
    for ref in workforce_condition["evidenceFiles"]:
        path = backend / ref["path"]
        payload = path.read_bytes()
        require(len(payload) == ref["bytes"], f"backend: workforce evidence byte drift {ref['path']}")
        require(sha256_bytes(payload) == ref["sha256"], f"backend: workforce evidence hash drift {ref['path']}")
        text = payload.decode("utf-8")
        require(all(marker in text for marker in ref["markers"]), f"backend: workforce marker drift {ref['path']}")
        observed_markers.update(ref["markers"])
        evidence_paths.add(ref["path"])
    require(observed_markers == {"queryCompensationPopulation", "HRIS_PER_COMPENSATION_POPULATION", "COMPENSATION_POPULATION_V1"}, "backend: workforce marker closed set mismatch")
    require("contracts/in-process/hris/workforce-snapshot-query-port.v1.schema.json" in evidence_paths, "backend: workforce schema evidence missing")
    require(any("/src/main/" in path for path in evidence_paths), "backend: workforce main-code evidence missing")
    require(any("/src/test/" in path for path in evidence_paths), "backend: workforce test evidence missing")
    require(workforce_condition["legacyPerformanceV1Preserved"] is True, "backend: legacy PERFORMANCE_V1 preservation is not recorded")
    for ref in workforce_condition["legacyCompatibilityEvidenceFiles"]:
        path = backend / ref["path"]
        payload = path.read_bytes()
        require(len(payload) == ref["bytes"], f"backend: legacy evidence byte drift {ref['path']}")
        require(sha256_bytes(payload) == ref["sha256"], f"backend: legacy evidence hash drift {ref['path']}")
        require("PERFORMANCE_V1" in payload.decode("utf-8"), f"backend: legacy PERFORMANCE_V1 marker missing {ref['path']}")
    auth = load_json(backend / "contracts/product-authorization/product-surfaces-v1.json")
    require(auth.get("version") == 38, "backend: authorization version is not 38")
    require(auth.get("checksum") == "a41145d6a2faefd2e6030a2ca9a070769019d4db5513ea214bf542dda31c374a", "backend: authorization checksum drift")
    require(sha256_bytes((backend / "contracts/openapi/gateway-public.json").read_bytes()) == "453f3620dca02a5ce82df273be986633fb5d694084ca080859bb47472027d234", "backend: Gateway OpenAPI drift")


def validate(
    frontend: Path,
    backend: Path,
    agent: Path,
    allow_phase_a_carrier: bool,
) -> None:
    bundle = frontend / BUNDLE_REL
    require(bundle.is_dir(), "Phase A bundle directory is missing")
    docs = {rel: load_json(bundle / rel) for rel in JSON_ARTIFACTS}
    manifest = docs["manifest.v1.json"]
    validate_manifest(frontend, bundle, manifest)
    validate_overlay(frontend, bundle, docs["successor-slice-overlay.evidence.v2.json"])
    validate_packet_and_gates(frontend, bundle, docs)
    validate_targeted_test_receipt(backend, docs)
    validate_runtime_state(
        frontend,
        backend,
        agent,
        docs["authority-refresh.v1.json"],
        docs["mod-per-compplan/prestart-control-grant-receipt.v1.json"],
        manifest,
        allow_phase_a_carrier,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--frontend-root")
    parser.add_argument("--backend-root")
    parser.add_argument("--agent-root")
    parser.add_argument(
        "--allow-phase-a-carrier",
        action="store_true",
        help="accept a clean pushed direct-child carrier whose exact diff is this sealed bundle",
    )
    args = parser.parse_args()
    frontend, backend, agent = resolve_roots(args)
    validate(frontend, backend, agent, args.allow_phase_a_carrier)
    print("WAVE3_PHASE_A_INDEPENDENT_VALIDATION_PASS rows=102 completed=13 retired=2 remaining=87")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, subprocess.CalledProcessError, OSError, ValueError, KeyError) as error:
        print(f"WAVE3_PHASE_A_VALIDATION_ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
