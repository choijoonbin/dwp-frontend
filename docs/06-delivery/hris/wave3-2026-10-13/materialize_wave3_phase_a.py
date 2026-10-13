#!/usr/bin/env python3
"""Deterministically materialize the HRIS Wave3 Phase A authority bundle."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from copy import deepcopy
from pathlib import Path
from typing import Any


ISSUED_AT = "2026-10-13T14:30:00+09:00"
BUNDLE_REL = Path("docs/06-delivery/hris/wave3-2026-10-13")
G7_OVERLAY_REL = Path(
    "docs/06-delivery/hris/g7-delegation/2026-10-12/"
    "successor-slice-overlay.v1.csv"
)
G7_OVERLAY_EVIDENCE_REL = Path(
    "docs/06-delivery/hris/g7-delegation/2026-10-12/"
    "successor-slice-overlay.evidence.v1.json"
)
CURRENT_SLICE_REL = Path(
    "docs/06-delivery/hris/current-slice-integration-status.v1.csv"
)
CURRENT_SLICE_EVIDENCE_REL = Path(
    "docs/06-delivery/hris/current-slice-integration-status.v1.evidence.json"
)
G7_ROADMAP_REL = Path(
    "docs/06-delivery/hris/2026-10-12-g7-integration-roadmap-status.md"
)
WORK_PACKET_TEMPLATE_REL = Path(
    "docs/06-delivery/hris/development-agent-work-packet-template.md"
)
WAVE2_START_REL = Path(
    "docs/06-delivery/hris/wave2-2026-10-13/start-manifest.v1.json"
)
WAVE2_RECEIPT_REL = Path(
    "docs/06-delivery/hris/wave2-2026-10-13/shared-wiring-receipt.v1.json"
)
G7_PROMOTION_REL = Path(
    "docs/06-delivery/hris/2026-10-12-g7-sys-hrm-promotion-receipt.v2.json"
)
G7_PER_TIM_PROMOTION_REL = Path(
    "docs/06-delivery/hris/2026-10-12-g7-evidence-promotion-and-delegation-receipt.json"
)
G7_CLOSURE_REL = Path(
    "docs/06-delivery/hris/g7-delegation-successors/2026-10-12/"
    "sys-hrm-r3-result-acceptance/runs/sys-hrm-r3-20261012-r3/"
    "integrated-closure.v3.json"
)
G7_INTEGRATION_AUTH_REL = Path(
    "docs/06-delivery/hris/g7-delegation-successors/2026-10-12/"
    "sys-hrm-r3-result-acceptance/runs/sys-hrm-r3-20261012-r3/"
    "integration-authorization.v3.json"
)
OLD_COMPPLAN_PACKET_REL = Path(
    "docs/06-delivery/hris/g7-delegation-successors/2026-10-12/"
    "mod-per-compplan-r1/packet.v1.json"
)
OLD_COMPPLAN_RESEAL_REL = Path(
    "docs/06-delivery/hris/g7-delegation-successors/2026-10-12/"
    "mod-per-compplan-r1/contract-reseal-authority.v1.json"
)

WAVE3_COLUMNS = [
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

G5_G6_COMPLETE = {
    "BASE-TFR-HRM-004",
    "BASE-TFR-PAY-007",
    "BASE-TFR-PER-005",
    "BASE-TFR-SYS-004",
    "BASE-TFR-TIM-016",
}

G7_COMPLETE: dict[str, dict[str, str]] = {
    "BASE-TFR-PER-006": {
        "result": "FE:8411458fddb21500268ddb5fdd3e1cb451450c7f|BE:36a4bcd6aeaa7cb7e60aa168fb3261d40d4bec11",
        "integration": "FE:f0341e521ef331eab9f7f17fea2ca6b713df7ed0|BE:2152531116731b678c79c3d13db139f18392ecd9",
        "evidence": "G7_PROMOTION_SYS_HRM_R2:CLOSED_PREDECESSOR_TOKEN",
    },
    "BASE-TFR-TIM-006": {
        "result": "FE:6a141852f3704d13065284012a715c3faebb8154|BE:a41aa26828f1e01fe2fa6a0089846444a0d55c45",
        "integration": "FE:f0341e521ef331eab9f7f17fea2ca6b713df7ed0|BE:2152531116731b678c79c3d13db139f18392ecd9",
        "evidence": "G7_PROMOTION_SYS_HRM_R2:CLOSED_PREDECESSOR_TOKEN",
    },
    "BASE-TFR-SYS-007": {
        "result": "FE:bb551d5607a4bff3e2b51be9e1af5483470b1647|BE:124269a8497eafa074199171cafc35adbef615ad",
        "integration": "FE:83b4e500be99f6bffd30f3b985faf67b67a349e2|BE:deb39a02634826d40ae5de5e30f54223c31b5851",
        "evidence": "G7_SYS_HRM_R3_INTEGRATED_CLOSURE",
    },
    "BASE-TFR-HRM-010": {
        "result": "FE:019923260d03a497f8efe7bfbd528ec749e59c08|BE:30bbcbeebb455e2f5a738c80ce1c8b0ef1575e89",
        "integration": "FE:83b4e500be99f6bffd30f3b985faf67b67a349e2|BE:deb39a02634826d40ae5de5e30f54223c31b5851",
        "evidence": "G7_SYS_HRM_R3_INTEGRATED_CLOSURE",
    },
}

WAVE2_COMPLETE: dict[str, dict[str, str]] = {
    "BASE-TFR-HRM-008": {
        "result": "FE:ec3b67116e24f9e5215a705092cf3bc1b31e2010|BE:e166ce6df462da02a4d0eb56f271cea59586b73d",
    },
    "BASE-TFR-TIM-010": {
        "result": "FE:1d4f130354a1ff125c8ce70363c2d6adb4df7332|BE:bfd273378008c827d84b5c61b12ba53322d3f641",
    },
    "BASE-TFR-PAY-006": {
        "result": "FE:054675cb136c4480a52ea78fdcb4254a769c17a2|BE:aae18ae06dfea22dd62a07fcb4bd85f81b361b86",
    },
    "BASE-TFR-PER-016": {
        "result": "FE:NOT_TOUCHED_AT_c2f26f7c270558e490f40c0f0df70e4426edd4b7|BE:48c33e85e40c7ac027175aa59a6077d33cb0e160",
    },
}

RETIRED = {"BASE-TFR-HRM-006", "BASE-TFR-SYS-013"}
PACKET_ID = "HRIS-WAVE3-PACKET-MOD-PER-COMPPLAN-R2-PHASE-A"
LEASE_ID = "HRIS-WAVE3-LEASE-MOD-PER-COMPPLAN-PERFORMANCE-V17-R1"
TOUCH_MANIFEST_ID = "HRIS-WAVE3-TOUCH-MOD-PER-COMPPLAN-R2"
GRANT_RECEIPT_ID = "HRIS-WAVE3-PRESTART-CONTROL-GRANT-MOD-PER-COMPPLAN-R1"

WORKFORCE_SCHEMA_REL = Path(
    "contracts/in-process/hris/workforce-snapshot-query-port.v1.schema.json"
)
WORKFORCE_MAIN_REL = Path(
    "dwp-people-server/src/main/java/com/dwp/services/people/hris/contracts/workforce/v1"
)
WORKFORCE_TEST_REL = Path(
    "dwp-people-server/src/test/java/com/dwp/services/people/hris/contracts/workforce/v1"
)
WORKFORCE_LEGACY_CONTRACT_TEST_REL = (
    WORKFORCE_TEST_REL / "WorkforceSnapshotContractTest.java"
)
COMPENSATION_MARKERS = {
    "queryCompensationPopulation",
    "HRIS_PER_COMPENSATION_POPULATION",
    "COMPENSATION_POPULATION_V1",
}
WORKFORCE_FULFILLMENT_QUALIFICATION = (
    "CONTRACT_ABI_IMPLEMENTED_TESTED_REGISTERED_GRANTED; owner runtime provider "
    "wiring intentionally fail-closed and remains post-result Central integration"
)
COMPPLAN_DOMAIN_TABLES = [
    "prf_cmp_cycles",
    "prf_cmp_budget_ledger",
    "prf_cmp_proposals",
    "prf_cmp_proposal_revisions",
    "prf_cmp_approved_snapshots",
    "prf_cmp_approved_snapshot_lines",
]
WORKFORCE_TEST_ARGV = [
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
WORKFORCE_TEST_REPORTS = [
    {
        "className": "com.dwp.services.people.hris.contracts.workforce.v1.CompensationPopulationContractTest",
        "fileName": "TEST-com.dwp.services.people.hris.contracts.workforce.v1.CompensationPopulationContractTest.xml",
        "bytes": 2346,
        "sha256": "dcd66dd972d9bf8aa6603241cbc573c4ce888f32ae815ddc3b6006301a427fa1",
        "tests": 10,
    },
    {
        "className": "com.dwp.services.people.hris.contracts.workforce.v1.WorkforceSnapshotContractTest",
        "fileName": "TEST-com.dwp.services.people.hris.contracts.workforce.v1.WorkforceSnapshotContractTest.xml",
        "bytes": 2225,
        "sha256": "740fff035c246defb9621a41d349d5059edba7e5399ccd3a1162aae523d5ef6f",
        "tests": 10,
    },
    {
        "className": "com.dwp.services.people.hris.contracts.workforce.v1.WorkforceSnapshotPaginationContractTest",
        "fileName": "TEST-com.dwp.services.people.hris.contracts.workforce.v1.WorkforceSnapshotPaginationContractTest.xml",
        "bytes": 1139,
        "sha256": "f68e47dd8d50bef5296c3259cf5030131a434e0c70a1dd59c8fe69fe11fc663d",
        "tests": 4,
    },
]

OUTPUT_PATHS = {
    "authority": BUNDLE_REL / "authority-refresh.v1.json",
    "overlap": BUNDLE_REL / "narrow-overlap-audit.v1.json",
    "overlay": BUNDLE_REL / "successor-slice-overlay.v2.csv",
    "overlayEvidence": BUNDLE_REL / "successor-slice-overlay.evidence.v2.json",
    "touch": BUNDLE_REL / "mod-per-compplan" / "touch-manifest.v1.json",
    "lease": BUNDLE_REL / "mod-per-compplan" / "migration-lease.v1.json",
    "grant": BUNDLE_REL / "mod-per-compplan" / "prestart-control-grant-receipt.v1.json",
    "testReceipt": BUNDLE_REL / "workforce-compensation-targeted-test-execution-receipt.v1.json",
    "packet": BUNDLE_REL / "mod-per-compplan" / "packet.v2.json",
    "requests": BUNDLE_REL / "control-requests.v1.json",
    "state": BUNDLE_REL / "state" / "phase-a.v1.json",
    "manifest": BUNDLE_REL / "manifest.v1.json",
}


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


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def sealed(value: dict[str, Any]) -> dict[str, Any]:
    result = deepcopy(value)
    result.pop("sealedPayloadSha256", None)
    result["sealedPayloadSha256"] = sha256_bytes(canonical_bytes(result))
    return result


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def file_ref(root: Path, rel: Path) -> dict[str, Any]:
    payload = (root / rel).read_bytes()
    return {
        "path": rel.as_posix(),
        "bytes": len(payload),
        "sha256": sha256_bytes(payload),
    }


def git_pin(
    root: Path,
    repository: str,
    require_clean: bool,
    allow_detached: bool = False,
) -> dict[str, Any]:
    checkout_branch = git(root, "branch", "--show-current")
    if checkout_branch != "dwp-dev" and not (allow_detached and not checkout_branch):
        raise RuntimeError(
            f"{repository}: expected dwp-dev or an allowed detached pin, got {checkout_branch}"
        )
    commit = git(root, "rev-parse", "HEAD")
    tree = git(root, "rev-parse", "HEAD^{tree}")
    upstream = "origin/dwp-dev"
    upstream_commit = git(root, "rev-parse", upstream)
    if commit != upstream_commit:
        raise RuntimeError(f"{repository}: HEAD does not match {upstream}")
    status = git(root, "status", "--porcelain=v1")
    if require_clean and status:
        raise RuntimeError(f"{repository}: worktree is dirty:\n{status}")
    return {
        "repository": repository,
        "branch": "dwp-dev",
        "checkoutMode": (
            "DWP_DEV_BRANCH" if checkout_branch == "dwp-dev" else "DETACHED_AT_ORIGIN_DWP_DEV"
        ),
        "commit": commit,
        "tree": tree,
        "upstream": upstream,
        "upstreamCommit": upstream_commit,
        "upstreamMatches": True,
        "cleanAtMaterialization": not bool(status),
    }


def assert_frontend_scope(frontend: Path) -> None:
    status = git(frontend, "status", "--porcelain=v1")
    for line in status.splitlines():
        path = line[3:]
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        if not path.startswith(BUNDLE_REL.as_posix() + "/"):
            raise RuntimeError(f"frontend has an out-of-bundle change: {line}")


def roots(frontend_arg: str | None, backend_arg: str | None, agent_arg: str | None) -> tuple[Path, Path, Path]:
    frontend = (
        Path(frontend_arg).resolve()
        if frontend_arg
        else Path(run("git", "rev-parse", "--show-toplevel", cwd=Path.cwd())).resolve()
    )
    workspace = frontend.parent
    backend = Path(backend_arg).resolve() if backend_arg else workspace / "dwp-backend"
    agent = Path(agent_arg).resolve() if agent_arg else workspace / "dwp_agent"
    return frontend, backend, agent


def performance_versions(backend: Path) -> list[int]:
    migration_root = backend / "dwp-people-server/src/main/resources/db/performance-migration"
    versions = []
    for path in migration_root.glob("V*__*.sql"):
        match = re.match(r"V(\d+)__", path.name)
        if match:
            versions.append(int(match.group(1)))
    return sorted(versions)


def build_workforce_test_execution_receipt(
    backend: Path,
    pins: dict[str, Any],
) -> dict[str, Any]:
    report_root = Path("dwp-people-server/build/test-results/test")
    reports = []
    totals = {"tests": 0, "failures": 0, "errors": 0, "skipped": 0}
    for expected in WORKFORCE_TEST_REPORTS:
        rel = report_root / expected["fileName"]
        payload = (backend / rel).read_bytes()
        observed_bytes = len(payload)
        observed_sha = sha256_bytes(payload)
        if observed_bytes != expected["bytes"] or observed_sha != expected["sha256"]:
            raise RuntimeError(f"targeted JUnit report drifted: {rel}")
        suite = ET.fromstring(payload)
        if suite.tag != "testsuite" or suite.attrib.get("name") != expected["className"]:
            raise RuntimeError(f"unexpected targeted JUnit suite identity: {rel}")
        counts = {
            key: int(suite.attrib.get(key, "0"))
            for key in ("tests", "failures", "errors", "skipped")
        }
        if counts != {
            "tests": expected["tests"],
            "failures": 0,
            "errors": 0,
            "skipped": 0,
        }:
            raise RuntimeError(f"targeted JUnit suite is not an exact pass: {rel}")
        for key in totals:
            totals[key] += counts[key]
        reports.append({
            "path": rel.as_posix(),
            "className": expected["className"],
            "bytes": observed_bytes,
            "sha256": observed_sha,
            **counts,
        })
    if totals != {"tests": 24, "failures": 0, "errors": 0, "skipped": 0}:
        raise RuntimeError(f"targeted Workforce test total drifted: {totals}")
    return sealed({
        "schema": "dwp.hris.wave3-targeted-test-execution-receipt.v1",
        "receiptId": "HRIS-WAVE3-WORKFORCE-COMPENSATION-TARGETED-TEST-EXECUTION-R1",
        "issuedAt": ISSUED_AT,
        "scope": "WORKFORCE_SNAPSHOT_COMPENSATION_CONTRACT_ABI",
        "backendPin": pins["backend"],
        "execution": {
            "cwd": backend.as_posix(),
            "argv": WORKFORCE_TEST_ARGV,
            "targetedTestClassCount": 3,
            "broadTestExecution": False,
            "processOutcome": "BUILD_SUCCESSFUL",
        },
        "reports": reports,
        "reportCount": len(reports),
        "totals": totals,
        "result": "PASS_24_TESTS_ZERO_FAILURES_ERRORS_SKIPPED",
    })


def g7_authoritative_lineage(frontend: Path) -> dict[str, dict[str, str]]:
    per_tim_promotion = json.loads(
        (frontend / G7_PER_TIM_PROMOTION_REL).read_text(encoding="utf-8")
    )
    sys_hrm_promotion = json.loads(
        (frontend / G7_PROMOTION_REL).read_text(encoding="utf-8")
    )
    closure = json.loads((frontend / G7_CLOSURE_REL).read_text(encoding="utf-8"))
    integration_auth = json.loads(
        (frontend / G7_INTEGRATION_AUTH_REL).read_text(encoding="utf-8")
    )
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
    final_closures = {
        row["sliceId"]: row for row in closure["tokenClosures"]
    }
    authorized_results: dict[str, dict[str, str]] = {}
    for row in integration_auth["authorizedResults"]:
        authorized_results.setdefault(row["sliceId"], {})[row["repo"]] = row["commit"]
    integrated_commits = {
        repo.upper(): value["integrated"]["commit"]
        for repo, value in closure["centralIntegration"]["repositories"].items()
    }

    lineage: dict[str, dict[str, str]] = {}
    for slice_id in ("BASE-TFR-PER-006", "BASE-TFR-TIM-006"):
        delegation = per_tim_delegations[slice_id]
        if predecessor_closures.get(delegation["tokenId"]) != "RESULT_INTEGRATED_CLOSED":
            raise RuntimeError(f"G7 predecessor closure missing for {slice_id}")
        token_rel = Path(delegation["tokenPath"])
        token_ref = file_ref(frontend, token_rel)
        if token_ref["sha256"] != delegation["tokenSha256"]:
            raise RuntimeError(f"G7 promotion token hash drift for {slice_id}")
        token = json.loads((frontend / token_rel).read_text(encoding="utf-8"))
        if token["tokenId"] != delegation["tokenId"]:
            raise RuntimeError(f"G7 promotion token identity drift for {slice_id}")
        lineage[slice_id] = {
            "packetId": delegation["packetId"],
            "tokenId": delegation["tokenId"],
            "dependencyPins": token["dependencyPinsSha256"],
            "migrationAuthority": delegation["migrationLeaseId"],
            "touchPolicyDigest": token["pathPolicySha256"],
            "evidence": "G7_PER_TIM_PROMOTION_RECEIPT|G7_SYS_HRM_FINAL_PROMOTION:CLOSED_PREDECESSOR_TOKEN",
        }

    for slice_id in ("BASE-TFR-SYS-007", "BASE-TFR-HRM-010"):
        delegation = sys_hrm_delegations[slice_id]
        final = final_closures[slice_id]
        if final["tokenId"] != delegation["tokenId"] or final["stateAfterCarrier"] != "RESULT_INTEGRATED_CLOSED":
            raise RuntimeError(f"G7 integrated closure drift for {slice_id}")
        token_rel = Path(delegation["tokenPath"])
        token_ref = file_ref(frontend, token_rel)
        if token_ref["sha256"] != delegation["tokenSha256"]:
            raise RuntimeError(f"G7 promotion token hash drift for {slice_id}")
        token = json.loads((frontend / token_rel).read_text(encoding="utf-8"))
        migration_authority = token.get("migrationLeaseId")
        if slice_id == "BASE-TFR-HRM-010":
            migration_authority = delegation["migrationAuthorityMode"]
            if (
                migration_authority != "CONTROL_BOOTSTRAP_READ_ONLY_PIN"
                or token["authority"]["migrationAuthorityMode"]
                != "CONTROL_BOOTSTRAP_READ_ONLY_PIN"
            ):
                raise RuntimeError("HRM read-only migration authority drifted")
        results = authorized_results[slice_id]
        expected_results = G7_COMPLETE[slice_id]["result"]
        observed_results = f"FE:{results['frontend']}|BE:{results['backend']}"
        observed_integration = (
            f"FE:{integrated_commits['FRONTEND']}|BE:{integrated_commits['BACKEND']}"
        )
        if observed_results != expected_results or observed_integration != G7_COMPLETE[slice_id]["integration"]:
            raise RuntimeError(f"G7 closure commit lineage drifted for {slice_id}")
        lineage[slice_id] = {
            "packetId": delegation["packetId"],
            "tokenId": delegation["tokenId"],
            "dependencyPins": token["dependencyPinsSha256"],
            "migrationAuthority": migration_authority,
            "touchPolicyDigest": token["pathPolicySha256"],
            "evidence": "G7_SYS_HRM_FINAL_PROMOTION_RECEIPT|G7_SYS_HRM_INTEGRATED_CLOSURE",
        }
    return lineage


def compensation_projection_evidence(
    backend: Path,
    test_receipt: dict[str, Any],
) -> dict[str, Any]:
    candidates = [WORKFORCE_SCHEMA_REL]
    for source_root in (WORKFORCE_MAIN_REL, WORKFORCE_TEST_REL):
        candidates.extend(
            path.relative_to(backend)
            for path in sorted((backend / source_root).rglob("*.java"))
        )

    evidence = []
    observed_markers: set[str] = set()
    for rel in candidates:
        text = (backend / rel).read_text(encoding="utf-8")
        markers = sorted(marker for marker in COMPENSATION_MARKERS if marker in text)
        if markers:
            observed_markers.update(markers)
            evidence.append({**file_ref(backend, rel), "markers": markers})

    missing = sorted(COMPENSATION_MARKERS - observed_markers)
    if missing:
        raise RuntimeError(
            "WorkforceSnapshot compensation projection markers are missing: "
            + ", ".join(missing)
        )
    evidence_paths = {row["path"] for row in evidence}
    if WORKFORCE_SCHEMA_REL.as_posix() not in evidence_paths:
        raise RuntimeError("WorkforceSnapshot compensation schema evidence is missing")
    if not any(path.startswith(WORKFORCE_MAIN_REL.as_posix() + "/") for path in evidence_paths):
        raise RuntimeError("WorkforceSnapshot compensation main-code evidence is missing")
    if not any(path.startswith(WORKFORCE_TEST_REL.as_posix() + "/") for path in evidence_paths):
        raise RuntimeError("WorkforceSnapshot compensation test evidence is missing")
    legacy_evidence = []
    for rel in (WORKFORCE_SCHEMA_REL, WORKFORCE_LEGACY_CONTRACT_TEST_REL):
        text = (backend / rel).read_text(encoding="utf-8")
        if "PERFORMANCE_V1" not in text:
            raise RuntimeError(f"legacy PERFORMANCE_V1 evidence is missing from {rel}")
        legacy_evidence.append(file_ref(backend, rel))
    return {
        "state": "IMPLEMENTED_TESTED_REGISTERED_GRANTED",
        "fulfillmentQualification": WORKFORCE_FULFILLMENT_QUALIFICATION,
        "requiredMarkers": sorted(COMPENSATION_MARKERS),
        "observedMarkers": sorted(observed_markers),
        "evidenceFiles": evidence,
        "legacyPerformanceV1Preserved": True,
        "legacyCompatibilityEvidenceFiles": legacy_evidence,
        "targetedTestExecutionReceiptId": test_receipt["receiptId"],
        "targetedTestExecutionReceiptSeal": test_receipt["sealedPayloadSha256"],
        "targetedTestResult": test_receipt["result"],
        "targetedTestTotals": test_receipt["totals"],
    }


def path_policy(frontend: Path) -> dict[str, Any]:
    allowed = [
        {"repo": "frontend", "kind": "PREFIX_GLOB", "selector": "apps/dwp/src/features/hris/performance/compensation-planning/**"},
        {"repo": "backend", "kind": "PREFIX_GLOB", "selector": "dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/compensationplanning/**"},
        {"repo": "backend", "kind": "PREFIX_GLOB", "selector": "dwp-people-server/src/test/java/com/dwp/services/people/hr/performance/compensationplanning/**"},
        {"repo": "backend", "kind": "PREFIX_GLOB", "selector": "dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/typedartifact/**"},
        {"repo": "backend", "kind": "PREFIX_GLOB", "selector": "dwp-people-server/src/test/java/com/dwp/services/people/hr/performance/typedartifact/**"},
        {"repo": "backend", "kind": "EXACT_FILE", "selector": "dwp-people-server/src/test/java/com/dwp/services/people/hris/performance/contracts/xcon/Xcon020ApprovedCompensationPlanSnapshotV1ProviderContractTest.java"},
        {"repo": "backend", "kind": "EXACT_FILE", "selector": "dwp-people-server/src/test/java/com/dwp/services/people/hris/performance/contracts/xcon/Xcon021ApprovedCompensationPlanSnapshotPublishedV2ProviderContractTest.java"},
        {"repo": "backend", "kind": "EXACT_FILE", "selector": "dwp-people-server/src/main/resources/db/performance-migration/V17__per_modern_compensation_planning.sql"},
    ]
    predecessor_packet = json.loads(
        (frontend / OLD_COMPPLAN_PACKET_REL).read_text(encoding="utf-8")
    )
    predecessor_control_only = deepcopy(
        predecessor_packet["pathPolicy"]["commonControlOnlyPaths"]
    )
    wave3_additional_control_only: list[dict[str, str]] = []
    control_only = predecessor_control_only + wave3_additional_control_only
    if len({canonical_bytes(row) for row in control_only}) != len(control_only):
        raise RuntimeError("common Control path policy contains duplicate entries")
    rules = [
        "ONLY_LISTED_MODULE_PATHS_MAY_BE_EDITED_AFTER_A_LATER_START_TOKEN",
        "COMMON_CONTROL_PATHS_REQUIRE_A_SEPARATE_CONTROL_CHANGE",
        "NO_EXISTING_MIGRATION_MAY_BE_EDITED",
        "NO_TOKEN_WORKTREE_PROMOTION_OR_RELEASE_AUTHORITY_IN_PHASE_A",
        "PREDECESSOR_COMMON_CONTROL_CLOSED_SET_IS_PRESERVED_EXACTLY_AND_ONLY_UNION_EXTENDED",
    ]
    digest = sha256_bytes(canonical_bytes({"allowedPaths": allowed, "commonControlOnlyPaths": control_only, "rules": rules}))
    return {
        "allowedPaths": allowed,
        "commonControlOnlyPaths": control_only,
        "predecessorCommonControlOnlyPathCount": len(predecessor_control_only),
        "predecessorCommonControlOnlyPathsSha256": sha256_bytes(
            canonical_bytes(predecessor_control_only)
        ),
        "wave3AdditionalCommonControlOnlyPaths": wave3_additional_control_only,
        "commonControlOnlyPathCount": len(control_only),
        "commonControlOnlyPathInheritance": "EXACT_PREDECESSOR_CLOSED_SET_PLUS_WAVE3_UNION",
        "rules": rules,
        "touchPolicyDigest": digest,
    }


def build_touch(frontend: Path, pins: dict[str, Any]) -> dict[str, Any]:
    policy = path_policy(frontend)
    return sealed({
        "schema": "dwp.hris.wave3-independent-touch-manifest.v1",
        "manifestId": TOUCH_MANIFEST_ID,
        "issuedAt": ISSUED_AT,
        "moduleId": "MOD-PER-COMPPLAN",
        "packetId": PACKET_ID,
        "independentFromPredecessorPacket": True,
        "basePins": pins,
        **policy,
        "typedArtifactBootstrapAllocation": {
            "state": "ALLOCATED_REGISTERED_GRANTED",
            "allocationOwner": "CENTRAL_CONTROL",
            "exclusivePacketOwner": PACKET_ID,
            "sourcePathAllocations": [
                {
                    "repo": "backend",
                    "kind": "PREFIX_GLOB",
                    "selector": "dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/typedartifact/**",
                },
                {
                    "repo": "backend",
                    "kind": "PREFIX_GLOB",
                    "selector": "dwp-people-server/src/test/java/com/dwp/services/people/hr/performance/typedartifact/**",
                },
            ],
            "migrationAllocation": {
                "leaseId": LEASE_ID,
                "file": "dwp-people-server/src/main/resources/db/performance-migration/V17__per_modern_compensation_planning.sql",
                "sharedFoundationTables": ["prf_per_artifact_versions"],
                "sharedFoundationTableCount": 1,
                "domainTables": COMPPLAN_DOMAIN_TABLES,
                "domainTableCount": 6,
                "totalTableCount": 7,
            },
            "implementationTiming": "MODULE_IMPLEMENTS_ONLY_AFTER_FRESH_PHASE_B_START_TOKEN",
        },
        "controlAllocationAuthority": True,
        "moduleMayEditCommonControlPaths": False,
        "sourceChangeAuthority": False,
    })


def build_overlap(
    frontend: Path,
    backend: Path,
    versions: list[int],
    pins: dict[str, Any],
    workforce_evidence: dict[str, Any],
) -> dict[str, Any]:
    config_text = (
        backend
        / "dwp-people-server/src/test/java/com/dwp/services/people/hris/migrationstream/PerformanceMigrationStreamConfigurationTest.java"
    ).read_text(encoding="utf-8")
    checks = [
        {
            "id": "FE_MODULE_ROOT_VACANT",
            "path": "apps/dwp/src/features/hris/performance/compensation-planning",
            "result": "PASS" if not (frontend / "apps/dwp/src/features/hris/performance/compensation-planning").exists() else "FAIL",
        },
        {
            "id": "BE_COMPPLAN_ROOT_VACANT",
            "path": "dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/compensationplanning",
            "result": "PASS" if not (backend / "dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/compensationplanning").exists() else "FAIL",
        },
        {
            "id": "BE_TYPED_ARTIFACT_ROOT_VACANT",
            "path": "dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/typedartifact",
            "result": "PASS" if not (backend / "dwp-people-server/src/main/java/com/dwp/services/people/hr/performance/typedartifact").exists() else "FAIL",
        },
        {
            "id": "PERFORMANCE_V17_VACANT",
            "path": "dwp-people-server/src/main/resources/db/performance-migration/V17__per_modern_compensation_planning.sql",
            "result": "PASS" if 17 not in versions else "FAIL",
        },
        {
            "id": "PERFORMANCE_HIGH_WATER_V16",
            "observedVersions": [f"V{version}" for version in versions],
            "result": "PASS" if versions == [1, 2, 3, 16] else "FAIL",
        },
        {
            "id": "PERFORMANCE_OUT_OF_ORDER_DISABLED",
            "evidencePath": "dwp-people-server/src/test/java/com/dwp/services/people/hris/migrationstream/PerformanceMigrationStreamConfigurationTest.java",
            "result": "PASS" if "out-of-order=false" in config_text else "FAIL",
        },
        {
            "id": "WORKFORCE_COMPENSATION_PROJECTION_IMPLEMENTED_TESTED_REGISTERED_GRANTED",
            "requiredMarkers": workforce_evidence["requiredMarkers"],
            "observedMarkers": workforce_evidence["observedMarkers"],
            "evidenceFiles": workforce_evidence["evidenceFiles"],
            "state": workforce_evidence["state"],
            "fulfillmentQualification": workforce_evidence["fulfillmentQualification"],
            "targetedTestExecutionReceiptId": workforce_evidence["targetedTestExecutionReceiptId"],
            "targetedTestExecutionReceiptSeal": workforce_evidence["targetedTestExecutionReceiptSeal"],
            "targetedTestTotals": workforce_evidence["targetedTestTotals"],
            "result": "PASS",
        },
    ]
    passing = all(row["result"] == "PASS" for row in checks)
    return sealed({
        "schema": "dwp.hris.wave3-narrow-overlap-audit.v1",
        "auditId": "HRIS-WAVE3-MOD-PER-COMPPLAN-OVERLAP-20261013-R1",
        "issuedAt": ISSUED_AT,
        "scope": ["MOD-PER-COMPPLAN", "PERFORMANCE_MIGRATION_STREAM", "TWO_PRESTART_CONTROL_ALLOCATIONS"],
        "basePins": pins,
        "checks": checks,
        "result": "PASS_NO_DIRECT_IMPLEMENTATION_OVERLAP_AND_PRESTART_CONDITIONS_FULFILLED" if passing else "FAIL",
        "broadRepositoryTestsRun": False,
    })


def build_lease(pins: dict[str, Any], versions: list[int]) -> dict[str, Any]:
    return sealed({
        "schema": "dwp.hris.wave3-jit-migration-lease.v1",
        "leaseId": LEASE_ID,
        "issuedAt": ISSUED_AT,
        "expiresAt": "2026-10-20T14:30:00+09:00",
        "moduleId": "MOD-PER-COMPPLAN",
        "packetId": PACKET_ID,
        "repository": "backend",
        "baseCommit": pins["backend"]["commit"],
        "stream": "PERFORMANCE",
        "schemaName": "hris_performance",
        "historyTable": "flyway_performance_schema_history",
        "location": "classpath:db/performance-migration",
        "observedVersions": [f"V{version}" for version in versions],
        "currentHighWater": "V16",
        "outOfOrder": False,
        "reservedVersion": "V17",
        "exactPath": "dwp-people-server/src/main/resources/db/performance-migration/V17__per_modern_compensation_planning.sql",
        "status": "RESERVED_PHASE_A_PRESTART_GRANTED_PENDING_CARRIER_AND_START_TOKEN",
        "admission": False,
        "ownerStartTokenIssued": False,
        "tableAllocation": {
            "domainTables": COMPPLAN_DOMAIN_TABLES,
            "domainTableCount": 6,
            "sharedFoundationTables": ["prf_per_artifact_versions"],
            "sharedFoundationTableCount": 1,
            "totalTableCount": 7,
            "typedArtifactBootstrapState": "ALLOCATED_REGISTERED_GRANTED",
            "implementationState": "NOT_STARTED_TOKEN_WITHHELD",
        },
        "protectedPredecessors": ["V1", "V2", "V3", "V16"],
        "supersededReservation": {
            "lease": "HRIS-G7-MIGRATION-LEASE-DELTA-MOD-PER-COMPPLAN-R1-PREP",
            "version": "V4",
            "reason": "PERFORMANCE_STREAM_ADVANCED_TO_V16_AND_OUT_OF_ORDER_IS_DISABLED",
        },
        "upgradePath": "EMPTY_OR_V16_TO_V17_AFTER_LATER_ADMISSION",
        "rollbackStrategy": "FORWARD_FIX_ONLY_AFTER_ADMISSION; UNUSED_V17_RESERVATION_EXPIRES_WITHOUT_FILE",
        "invalidationConditions": [
            "BACKEND_DWP_DEV_PIN_CHANGES_BEFORE_TOKEN",
            "V17_PATH_BECOMES_OCCUPIED",
            "PERFORMANCE_HIGH_WATER_CHANGES",
            "LEASE_EXPIRES",
        ],
    })


def request_rows() -> list[dict[str, Any]]:
    rows = [
        (
            "TYPED_ARTIFACT_BOOTSTRAP",
            "PRE_START",
            True,
            "ALLOCATED_REGISTERED_GRANTED",
            "exclusively allocate typedartifact main/test roots and prf_per_artifact_versions as the single V17 shared foundation table; module implementation remains token-gated",
        ),
        (
            "WORKFORCE_SNAPSHOT_COMPENSATION_PROJECTION",
            "PRE_START",
            True,
            "IMPLEMENTED_TESTED_REGISTERED_GRANTED",
            "pin verified queryCompensationPopulation with HRIS_PER_COMPENSATION_POPULATION and COMPENSATION_POPULATION_V1 without changing PERFORMANCE_V1",
        ),
        ("AUTH_PEP", "AFTER_PUSHED_MODULE_RESULT", False, "REGISTERED_WITH_FULFILLMENT_AFTER_RESULT", "register MOD-AUTH-025/026/027 and deny-precedence bindings"),
        ("CONTRACT_GATEWAY", "AFTER_PUSHED_MODULE_RESULT", False, "REGISTERED_WITH_FULFILLMENT_AFTER_RESULT", "publish OpenAPI, AsyncAPI, XCON-020/021 and generated Gateway contracts"),
        ("SHELL_ROUTE", "AFTER_PUSHED_MODULE_RESULT", False, "REGISTERED_WITH_FULFILLMENT_AFTER_RESULT", "register route, navigation, product manifest, shell permission and page host"),
        ("SVC_PEP_SECURITY", "AFTER_PUSHED_MODULE_RESULT", False, "REGISTERED_WITH_FULFILLMENT_AFTER_RESULT", "register SVC-PEP-PER-001 workload, tenant, purpose, projection, replay and negative-security bindings"),
        ("INTEGRATION_VERIFY", "AFTER_PUSHED_MODULE_RESULT", False, "REGISTERED_WITH_FULFILLMENT_AFTER_RESULT", "wire and test HRM owner runtime compensation projection before central integration acceptance; then run the single central contract, route, authorization, sync and PAY-withheld verification batch"),
    ]
    return [
        {
            "requestId": f"W3-CR-MOD-PER-COMPPLAN-{category}-R1",
            "moduleId": "MOD-PER-COMPPLAN",
            "category": category,
            "owner": "CENTRAL_CONTROL",
            "phase": phase,
            "requiredBeforeStartToken": prestart,
            "moduleMayImplement": False,
            "registrationState": "REGISTERED_PHASE_A",
            "fulfillmentState": fulfillment_state,
            "scope": scope,
            **(
                {
                    "fulfillmentQualification": WORKFORCE_FULFILLMENT_QUALIFICATION
                }
                if category == "WORKFORCE_SNAPSHOT_COMPENSATION_PROJECTION"
                else {}
            ),
        }
        for category, phase, prestart, fulfillment_state, scope in rows
    ]


def build_requests() -> dict[str, Any]:
    requests = request_rows()
    return sealed({
        "schema": "dwp.hris.wave3-control-request-register.v1",
        "registerId": "HRIS-WAVE3-CONTROL-REQUESTS-20261013-R1",
        "issuedAt": ISSUED_AT,
        "packetId": PACKET_ID,
        "registrationState": "REGISTERED_PHASE_A_TWO_PRESTART_CONDITIONS_FULFILLED",
        "requests": requests,
        "preStartRequestIds": [row["requestId"] for row in requests if row["requiredBeforeStartToken"]],
        "startTokenGate": "PHASE_A_CARRIER_PUSHED_REPINNED_AND_BOTH_FULFILLED_PRESTART_GRANTS_REVALIDATED",
    })


def build_prestart_grant(
    pins: dict[str, Any],
    touch: dict[str, Any],
    lease: dict[str, Any],
    requests: dict[str, Any],
    workforce_evidence: dict[str, Any],
) -> dict[str, Any]:
    return sealed({
        "schema": "dwp.hris.wave3-prestart-control-grant-receipt.v1",
        "receiptId": GRANT_RECEIPT_ID,
        "issuedAt": ISSUED_AT,
        "packetId": PACKET_ID,
        "moduleId": "MOD-PER-COMPPLAN",
        "status": "PASS_TWO_PRESTART_CONDITIONS_FULFILLED",
        "basePins": pins,
        "conditions": [
            {
                "category": "TYPED_ARTIFACT_BOOTSTRAP",
                "requestId": "W3-CR-MOD-PER-COMPPLAN-TYPED_ARTIFACT_BOOTSTRAP-R1",
                "state": "ALLOCATED_REGISTERED_GRANTED",
                "touchManifestId": touch["manifestId"],
                "touchManifestSeal": touch["sealedPayloadSha256"],
                "migrationLeaseId": lease["leaseId"],
                "migrationLeaseSeal": lease["sealedPayloadSha256"],
                "exclusiveSourcePaths": touch["typedArtifactBootstrapAllocation"]["sourcePathAllocations"],
                "sharedFoundationTables": ["prf_per_artifact_versions"],
                "domainTables": COMPPLAN_DOMAIN_TABLES,
                "domainTableCount": 6,
                "sharedFoundationTableCount": 1,
                "implementationState": "NOT_STARTED_TOKEN_WITHHELD",
            },
            {
                "category": "WORKFORCE_SNAPSHOT_COMPENSATION_PROJECTION",
                "requestId": "W3-CR-MOD-PER-COMPPLAN-WORKFORCE_SNAPSHOT_COMPENSATION_PROJECTION-R1",
                **workforce_evidence,
                "backendCommit": pins["backend"]["commit"],
                "backendTree": pins["backend"]["tree"],
            },
        ],
        "requestRegisterId": requests["registerId"],
        "requestRegisterSeal": requests["sealedPayloadSha256"],
        "controlAuthority": {
            "typedArtifactPathAllocationGranted": True,
            "sharedFoundationTableAllocationGranted": True,
            "workforceProjectionAcceptanceGranted": True,
            "sourceChangeAuthority": False,
            "startTokenAuthority": False,
            "worktreeRegistrationAuthority": False,
            "migrationAdmissionAuthority": False,
            "promotionAuthority": False,
            "productionReleaseAuthority": False,
        },
        "phaseBTokenGate": "WITHHELD_UNTIL_PHASE_A_CARRIER_IS_COMMITTED_PUSHED_REPINNED_AND_BOTH_CONDITIONS_REVALIDATE",
    })


def build_packet(
    frontend: Path,
    pins: dict[str, Any],
    touch: dict[str, Any],
    lease: dict[str, Any],
    requests: dict[str, Any],
    grant: dict[str, Any],
) -> dict[str, Any]:
    old_packet = file_ref(frontend, OLD_COMPPLAN_PACKET_REL)
    old_packet_doc = json.loads(
        (frontend / OLD_COMPPLAN_PACKET_REL).read_text(encoding="utf-8")
    )
    reseal = file_ref(frontend, OLD_COMPPLAN_RESEAL_REL)
    ui_work_contract = deepcopy(old_packet_doc["uiWorkContract"])
    predecessor_verification = deepcopy(old_packet_doc["verification"])
    acceptance_invariants = [
        (
            "clean empty-schema or V16-to-V17 upgrade, RLS, and append-only enforcement"
            if invariant
            == "clean V1 through V4 upgrade, RLS, and append-only enforcement"
            else invariant
        )
        for invariant in predecessor_verification["acceptanceInvariants"]
    ]
    named_command_ids = [
        row["commandId"] for row in predecessor_verification["namedCommands"]
    ]
    return sealed({
        "schema": "dwp.hris.wave3-module-work-packet.v1",
        "packetId": PACKET_ID,
        "revision": 2,
        "issuedAt": ISSUED_AT,
        "expiresAt": "2026-10-20T14:30:00+09:00",
        "module": "PER",
        "moduleId": "MOD-PER-COMPPLAN",
        "sessionId": "HRIS-PER",
        "ownership": {
            "ownerAgent": "HRIS-PER",
            "reviewer": "HRIS-INTEGRATION-CONTROL",
            "singleWriter": "HRIS-PER",
        },
        "slice": {"sliceId": "MOD-PER-COMPPLAN", "sourceKind": "MODERN_CAPABILITY"},
        "lifecycleState": "PACKET_PREPARED_START_WITHHELD",
        "startTokenId": None,
        "worktreeBindings": [],
        "basePins": pins,
        "contractPins": {
            "authorizationVersion": 38,
            "authorizationSha256": "a41145d6a2faefd2e6030a2ca9a070769019d4db5513ea214bf542dda31c374a",
            "authorizationBundleFileSha256": "de449058055b5ae9500489735910fdcf593b34a9ab05e927663a7fd74d740667",
            "gatewayOpenApiSha256": "453f3620dca02a5ce82df273be986633fb5d694084ca080859bb47472027d234",
            "predecessorContractReseal": reseal,
            "predecessorPacket": old_packet,
            "predecessorDisposition": "PREPARED_STALE_REISSUE_REQUIRED",
        },
        "dependencies": ["DEP-001", "DEP-002", "DEP-003", "DEP-016", "DEP-019"],
        "producerResultPins": {
            "DEP-019": "SELF_PRODUCER_OBLIGATION_RESULT_ABSENT",
            "payConsumer": "BASE-TFR-PAY-016_REMAINS_WITHHELD",
        },
        "userOutcome": {
            "primaryUser": "compensation planning operations lead",
            "operationalQuestion": "Are budgets, eligible proposals, maker-checker approval, and the payroll-ready immutable snapshot complete and safe to publish?",
            "primaryAction": "create or revise a cycle, allocate or reverse budget, draft and submit proposals, approve, and publish the immutable snapshot",
            "pageArchetype": "studio",
            "route": "/hr/operations/performance/compensation-planning",
        },
        "uiWorkContract": ui_work_contract,
        "acceptanceCriteria": [
            {
                "id": f"AC-{index:02d}",
                "criterion": criterion,
                "verificationCommandIds": named_command_ids,
            }
            for index, criterion in enumerate(acceptance_invariants, start=1)
        ],
        "scope": {
            "included": [
                "governed compensation cycles and HARD_CAP budgets",
                "typed guideline and population artifacts through module-owned projections",
                "maker-checker proposal approval",
                "immutable XCON-020 snapshot and post-commit XCON-021 v2 publication",
            ],
            "excluded": [
                "EXCEPTION_APPROVAL",
                "PAY consumer implementation",
                "shared route, authorization, Gateway or generated-contract edits by the module",
                "customer activation and production release",
            ],
        },
        "pathPolicy": {
            "manifestId": touch["manifestId"],
            "touchPolicyDigest": touch["touchPolicyDigest"],
            "manifestSealedPayloadSha256": touch["sealedPayloadSha256"],
        },
        "migrationLease": {
            "leaseId": lease["leaseId"],
            "reservedVersion": lease["reservedVersion"],
            "exactPath": lease["exactPath"],
            "status": lease["status"],
            "admission": False,
            "sealedPayloadSha256": lease["sealedPayloadSha256"],
        },
        "controlRequests": {
            "registerId": requests["registerId"],
            "preStartRequestIds": requests["preStartRequestIds"],
            "startTokenGate": requests["startTokenGate"],
            "sealedPayloadSha256": requests["sealedPayloadSha256"],
        },
        "preStartControlGrant": {
            "receiptId": grant["receiptId"],
            "status": grant["status"],
            "conditionStates": {
                row["category"]: row["state"] for row in grant["conditions"]
            },
            "sealedPayloadSha256": grant["sealedPayloadSha256"],
        },
        "runtimeSecurityRollout": {
            "systemOfRecord": "dwp-people-server/HRIS Performance",
            "tenantBoundary": "OWNER_AND_REPOSITORY_TENANT_ENFORCED_FAIL_CLOSED",
            "authorization": "VIEW_PROPOSE_APPROVE_WITH_SOD_STEP_UP_AND_DENY_PRECEDENCE",
            "idempotencyVersionAudit": "REQUIRED_FOR_ALL_COMMANDS_WITH_APPEND_ONLY_RECEIPTS_AND_OUTBOX",
            "featureFlag": "OFF_UNTIL_SEPARATE_ACTIVATION",
            "productionAuthorization": False,
        },
        "verificationBindings": {
            "semanticSource": old_packet,
            "executionPolicy": predecessor_verification["executionPolicy"],
            "backendTestsExact": predecessor_verification["backendTests"],
            "frontendTestsExact": predecessor_verification["frontendTestsExact"],
            "platformTestsExact": predecessor_verification["platformTestsExact"],
            "providerTestsExact": predecessor_verification["providerTestsExact"],
            "namedCommands": predecessor_verification["namedCommands"],
            "phaseAApplicationTestsRequired": False,
        },
        "deliverables": [
            "separate frontend and backend result commits on fresh token-bound branches",
            "exact changed-file manifests proving touch-policy compliance",
            "named targeted command results and evidence locators",
            "V17 lease used-or-unused status with clean-upgrade evidence",
            "central control request handoff without module edits to shared paths",
            "wire and test HRM owner runtime compensation projection before central integration acceptance",
        ],
        "releaseConditions": [
            "COMMIT_AND_PUSH_THIS_PHASE_A_BUNDLE_ON_DWP_DEV",
            "REPIN_THE_PHASE_A_CARRIER",
            "REVALIDATE_BOTH_FULFILLED_PRESTART_CONTROL_GRANTS_AT_THE_CARRIER_PIN",
            "RECHECK_BACKEND_DWP_DEV_AND_V17_VACANCY",
            "CREATE_FRESH_FRONTEND_AND_BACKEND_WORKTREES_FROM_CURRENT_DWP_DEV",
            "ISSUE_A_NEW_START_TOKEN_AND_LATER_PROMOTION_RECEIPT",
        ],
        "stopConditions": [
            "ANY_BASE_PIN_OR_UPSTREAM_DIVERGES",
            "V17_BECOMES_OCCUPIED_OR_HIGH_WATER_CHANGES",
            "A_MODULE_EDIT_TO_A_COMMON_CONTROL_PATH_IS_REQUIRED",
            "EITHER_FULFILLED_PRESTART_CONTROL_GRANT_NO_LONGER_REVALIDATES",
            "TENANT_SOR_CONTRACT_LINEAGE_OR_ROLLBACK_IS_AMBIGUOUS",
        ],
        "authority": {
            "sourceChangeAuthority": False,
            "startTokenAuthority": False,
            "worktreeRegistrationAuthority": False,
            "migrationAdmissionAuthority": False,
            "integrationAuthority": False,
            "activationAuthority": False,
            "promotionAuthority": False,
            "productionReleaseAuthority": False,
            "payConsumptionAuthority": False,
        },
    })


def overlay_projection(
    row: dict[str, str],
    touch_digest: str,
    g7_lineage: dict[str, dict[str, str]],
) -> dict[str, str]:
    slice_id = row["slice_id"]
    base = {
        "wave3_classification": "QUEUED_NOT_SELECTED",
        "wave3_completion_state": "NOT_STARTED",
        "wave3_authority": "NO_AUTHORITY",
        "wave3_packet_id": "NONE",
        "wave3_start_token_id": "NONE",
        "wave3_dependency_result_pins": "NONE",
        "wave3_producer_result_pins": "NONE",
        "wave3_migration_lease_id": "NONE",
        "wave3_touch_policy_digest": "NONE",
        "wave3_result_commit_ids": "NONE",
        "wave3_integration_commit_ids": "NONE",
        "wave3_evidence_refs": "NONE",
        "wave3_authority_note": "NO_WAVE3_PACKET_TOKEN_WORKTREE_OR_SOURCE_AUTHORITY",
    }
    if slice_id in G5_G6_COMPLETE:
        base.update(
            wave3_classification="INTEGRATED_COMPLETE_CARRIED_FORWARD",
            wave3_completion_state="COMPLETE_G5_G6_FROZEN",
            wave3_evidence_refs=row["g7_evidence_refs"],
            wave3_authority_note="COMPLETION_CARRIED_FORWARD_NO_NEW_SOURCE_AUTHORITY",
        )
    elif slice_id in G7_COMPLETE:
        evidence = G7_COMPLETE[slice_id]
        lineage = g7_lineage[slice_id]
        base.update(
            wave3_classification="INTEGRATED_COMPLETE_G7",
            wave3_completion_state="RESULT_INTEGRATED_CLOSED",
            wave3_packet_id=lineage["packetId"],
            wave3_start_token_id=lineage["tokenId"],
            wave3_dependency_result_pins=lineage["dependencyPins"],
            wave3_migration_lease_id=lineage["migrationAuthority"],
            wave3_touch_policy_digest=lineage["touchPolicyDigest"],
            wave3_result_commit_ids=evidence["result"],
            wave3_integration_commit_ids=evidence["integration"],
            wave3_evidence_refs=lineage["evidence"],
            wave3_authority_note="PREDECESSOR_TOKEN_CLOSED_WORKTREE_NOT_REUSABLE",
        )
    elif slice_id in WAVE2_COMPLETE:
        base.update(
            wave3_classification="INTEGRATED_COMPLETE_WAVE2",
            wave3_completion_state="RESULT_INTEGRATED_CLOSED",
            wave3_packet_id="HRIS-WAVE2-START-MANIFEST-20261013-R1",
            wave3_start_token_id={
                "BASE-TFR-HRM-008": "W2-20261013-HRM-008-START-R1",
                "BASE-TFR-TIM-010": "W2-20261013-TIM-010-START-R1",
                "BASE-TFR-PAY-006": "W2-20261013-PAY-006-START-R1",
                "BASE-TFR-PER-016": "W2-20261013-PER-016-START-R1",
            }[slice_id],
            wave3_result_commit_ids=WAVE2_COMPLETE[slice_id]["result"],
            wave3_integration_commit_ids="FE:a1c621984886f99049af5be82340dafeac025679|BE:5b35f8a49e5f4743cd00571ed9bd134e15fff94d|SHARED_FE:89af12036735f30f99b77022431d1b4432045c60|SHARED_BE:acda9f55f6e0a337fc6db3f1eee54a9f0439da55",
            wave3_evidence_refs="WAVE2_START_MANIFEST|WAVE2_SHARED_WIRING_RECEIPT",
            wave3_authority_note="WAVE2_TOKEN_CLOSED_WORKTREE_NOT_REUSABLE",
        )
    elif slice_id in RETIRED:
        base.update(
            wave3_classification="RETIRED_UNCHANGED",
            wave3_completion_state="RETIRED",
            wave3_authority_note="RETIRED_NO_AUTHORITY",
        )
    elif slice_id == "MOD-PER-COMPPLAN":
        base.update(
            wave3_classification="PREPARED_STALE_REISSUE_REQUIRED",
            wave3_completion_state="PHASE_A_PACKET_PREPARED_START_WITHHELD",
            wave3_packet_id=PACKET_ID,
            wave3_dependency_result_pins="DEP-001|DEP-002|DEP-003|DEP-016|DEP-019",
            wave3_producer_result_pins="SELF_PRODUCER_RESULT_ABSENT;PAY_CONSUMER_WITHHELD",
            wave3_migration_lease_id=LEASE_ID,
            wave3_touch_policy_digest=touch_digest,
            wave3_evidence_refs="MOD_PER_COMPPLAN_R1_RESEAL|WAVE3_PHASE_A_AUTHORITY_REFRESH|WAVE3_PRESTART_CONTROL_GRANT",
            wave3_authority_note="NO_TOKEN_WORKTREE_SOURCE_MIGRATION_ADMISSION_OR_PROMOTION_AUTHORITY",
        )
    elif slice_id == "BASE-TFR-PAY-016":
        base.update(
            wave3_classification="WITHHELD_MOD_PER_COMPPLAN_RESULT_REQUIRED",
            wave3_completion_state="DEPENDENCY_BLOCKED",
            wave3_producer_result_pins="MOD-PER-COMPPLAN|SVC-PEP-PER-001|XCON-020|XCON-021:ABSENT",
            wave3_authority_note="NO_PACKET_UNTIL_PUSHED_PRODUCER_RESULT_AND_NAMED_TESTS",
        )
    elif slice_id == "BASE-TFR-PAY-011":
        base.update(
            wave3_classification="WITHHELD_COMPPLAN_AND_PAY016_RESULTS_REQUIRED",
            wave3_completion_state="DEPENDENCY_BLOCKED",
            wave3_producer_result_pins="MOD-PER-COMPPLAN|BASE-TFR-PAY-016:ABSENT",
            wave3_authority_note="NO_PACKET_UNTIL_BOTH_PRODUCER_RESULTS_ARE_PINNED",
        )
    elif slice_id == "BASE-TFR-PAY-013":
        base.update(
            wave3_classification="QUEUED_AFTER_PAY011",
            wave3_completion_state="ORDER_BLOCKED",
            wave3_authority_note="NO_PACKET_UNTIL_PAY_CHAIN_PREDECESSORS_COMPLETE",
        )
    elif slice_id == "BASE-TFR-PER-013":
        base.update(
            wave3_classification="QUEUED_AFTER_MOD_PER_COMPPLAN",
            wave3_completion_state="ORDER_BLOCKED",
            wave3_authority_note="FRESH_POST_V17_MIGRATION_LEASE_REQUIRED_IF_SCHEMA_TOUCH",
        )
    elif slice_id == "BASE-TFR-HRM-001":
        base.update(
            wave3_classification="CANDIDATE_EXISTING_IMPLEMENTATION_AUDIT_REQUIRED",
            wave3_completion_state="PACKET_NOT_ISSUED",
            wave3_authority_note="AUDIT_SATISFIED_BY_EXISTING_VS_IMPLEMENT_AGAINST_HRM010_APPROVAL_BRIDGE",
        )
    elif slice_id in {"BASE-TFR-SYS-001", "BASE-TFR-TIM-017"}:
        base.update(
            wave3_classification="CANDIDATE_AFTER_PHASE_A",
            wave3_completion_state="PACKET_NOT_ISSUED",
            wave3_authority_note="FRESH_PACKET_TOUCH_MANIFEST_LEASE_WORKTREE_AND_TOKEN_REQUIRED",
        )
    return base


def build_overlay(
    frontend: Path,
    touch_digest: str,
    g7_lineage: dict[str, dict[str, str]],
) -> tuple[bytes, list[dict[str, str]], list[str]]:
    source = frontend / G7_OVERLAY_REL
    with source.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        source_columns = list(reader.fieldnames or [])
        rows = list(reader)
    if len(source_columns) != 42 or len(rows) != 102:
        raise RuntimeError("sealed G7 overlay shape changed")
    if len({row["slice_id"] for row in rows}) != 102:
        raise RuntimeError("sealed G7 overlay contains duplicate slice IDs")
    output = io.StringIO(newline="")
    columns = source_columns + WAVE3_COLUMNS
    writer = csv.DictWriter(output, fieldnames=columns, lineterminator="\n")
    writer.writeheader()
    projected_rows = []
    for source_row in rows:
        row = dict(source_row)
        row.update(overlay_projection(source_row, touch_digest, g7_lineage))
        writer.writerow(row)
        projected_rows.append(row)
    return output.getvalue().encode("utf-8"), projected_rows, source_columns


def build_overlay_evidence(
    frontend: Path,
    overlay_payload: bytes,
    rows: list[dict[str, str]],
    source_columns: list[str],
) -> dict[str, Any]:
    classification_counts = Counter(row["wave3_classification"] for row in rows)
    completed = sorted(G5_G6_COMPLETE | set(G7_COMPLETE) | set(WAVE2_COMPLETE))
    ordered_ids = [row["slice_id"] for row in rows]
    return sealed({
        "schema": "dwp.hris.wave3-successor-slice-overlay-evidence.v2",
        "issuedAt": ISSUED_AT,
        "predecessor": file_ref(frontend, G7_OVERLAY_REL),
        "predecessorEvidence": file_ref(frontend, G7_OVERLAY_EVIDENCE_REL),
        "g7LineageSources": {
            "perTimPromotion": file_ref(frontend, G7_PER_TIM_PROMOTION_REL),
            "sysHrmPromotion": file_ref(frontend, G7_PROMOTION_REL),
            "sysHrmIntegrationAuthorization": file_ref(frontend, G7_INTEGRATION_AUTH_REL),
            "sysHrmIntegratedClosure": file_ref(frontend, G7_CLOSURE_REL),
        },
        "successor": {
            "path": OUTPUT_PATHS["overlay"].as_posix(),
            "bytes": len(overlay_payload),
            "sha256": sha256_bytes(overlay_payload),
            "rows": len(rows),
            "uniqueSliceIds": len(set(ordered_ids)),
            "sourceColumnCount": len(source_columns),
            "wave3ColumnCount": len(WAVE3_COLUMNS),
            "totalColumnCount": len(source_columns) + len(WAVE3_COLUMNS),
            "orderedSliceIdSha256": sha256_bytes("\n".join(ordered_ids).encode("utf-8")),
            "sortedSliceIdSetSha256": sha256_bytes("\n".join(sorted(ordered_ids)).encode("utf-8")),
            "classificationCounts": dict(sorted(classification_counts.items())),
        },
        "transitionRule": "ALL_42_PREDECESSOR_COLUMNS_AND_ROW_ORDER_ARE_PRESERVED_EXACTLY_AFTER_CSV_PARSING;_ONLY_13_WAVE3_COLUMNS_ARE_APPENDED",
        "completionLedger": {
            "completedCount": len(completed),
            "retiredCount": len(RETIRED),
            "remainingActiveCount": len(rows) - len(completed) - len(RETIRED),
            "g5G6Completed": sorted(G5_G6_COMPLETE),
            "g7Completed": sorted(G7_COMPLETE),
            "wave2Completed": sorted(WAVE2_COMPLETE),
        },
        "invariants": {
            "duplicateSliceIds": [],
            "missingSliceIds": [],
            "newSliceIds": [],
            "predecessorColumnsPreserved": True,
            "productionAuthorization": False,
        },
    })


def build_authority(
    frontend: Path,
    backend: Path,
    pins: dict[str, Any],
    overlay_evidence: dict[str, Any],
    overlap: dict[str, Any],
    grant: dict[str, Any],
) -> dict[str, Any]:
    auth_path = backend / "contracts/product-authorization/product-surfaces-v1.json"
    auth_doc = json.loads(auth_path.read_text(encoding="utf-8"))
    gateway_path = backend / "contracts/openapi/gateway-public.json"
    bundle_path = backend / "contracts/product-authorization/product-surfaces-v1.bundle-v38.json"
    if auth_doc.get("version") != 38 or auth_doc.get("checksum") != "a41145d6a2faefd2e6030a2ca9a070769019d4db5513ea214bf542dda31c374a":
        raise RuntimeError("authorization v38 pin drifted")
    if sha256_bytes(gateway_path.read_bytes()) != "453f3620dca02a5ce82df273be986633fb5d694084ca080859bb47472027d234":
        raise RuntimeError("Gateway OpenAPI pin drifted")
    if sha256_bytes(bundle_path.read_bytes()) != "de449058055b5ae9500489735910fdcf593b34a9ab05e927663a7fd74d740667":
        raise RuntimeError("authorization bundle v38 pin drifted")
    return sealed({
        "schema": "dwp.hris.wave3-authority-refresh.v1",
        "authorityId": "HRIS-WAVE3-AUTHORITY-REFRESH-20261013-R1",
        "issuedAt": ISSUED_AT,
        "status": "PASS_PHASE_A_PRESTART_FULFILLED_PENDING_CARRIER",
        "sourcePins": pins,
        "contractPins": {
            "authorizationVersion": 38,
            "authorizationSha256": auth_doc["checksum"],
            "authorizationBundleFileSha256": sha256_bytes(bundle_path.read_bytes()),
            "gatewayOpenApiSha256": sha256_bytes(gateway_path.read_bytes()),
            "counts": {"capabilities": 242, "accessPolicies": 24, "entitlementExpressions": 17, "predicatePolicies": 59, "routes": 991},
        },
        "predecessorEvidence": {
            "currentSliceStatusV1": file_ref(frontend, CURRENT_SLICE_REL),
            "currentSliceStatusEvidenceV1": file_ref(frontend, CURRENT_SLICE_EVIDENCE_REL),
            "wave2Start": file_ref(frontend, WAVE2_START_REL),
            "wave2SharedWiring": file_ref(frontend, WAVE2_RECEIPT_REL),
            "g7PerTimPromotion": file_ref(frontend, G7_PER_TIM_PROMOTION_REL),
            "g7SysHrmPromotion": file_ref(frontend, G7_PROMOTION_REL),
            "g7SysHrmIntegrationAuthorization": file_ref(frontend, G7_INTEGRATION_AUTH_REL),
            "g7SysHrmClosure": file_ref(frontend, G7_CLOSURE_REL),
            "g7Overlay": file_ref(frontend, G7_OVERLAY_REL),
            "g7RoadmapStatus": file_ref(frontend, G7_ROADMAP_REL),
            "developmentAgentPacketTemplate": file_ref(frontend, WORK_PACKET_TEMPLATE_REL),
        },
        "overlayEvidenceSeal": overlay_evidence["sealedPayloadSha256"],
        "overlapAuditSeal": overlap["sealedPayloadSha256"],
        "preStartControlGrantSeal": grant["sealedPayloadSha256"],
        "decision": {
            "phase": "A_AUTHORITY_REFRESH_ONLY",
            "completedRows": 13,
            "retiredRows": 2,
            "remainingActiveRows": 87,
            "preparedModule": "MOD-PER-COMPPLAN",
            "predecessorPacketDisposition": "PREPARED_STALE_REISSUE_REQUIRED",
            "typedArtifactBootstrapState": "ALLOCATED_REGISTERED_GRANTED",
            "workforceCompensationProjectionState": "IMPLEMENTED_TESTED_REGISTERED_GRANTED",
            "workforceCompensationProjectionQualification": WORKFORCE_FULFILLMENT_QUALIFICATION,
            "bothPreStartConditionsFulfilled": True,
            "startTokenIssued": False,
            "worktreeRegistered": False,
            "promotionReceiptIssued": False,
            "sourceChangeAuthorized": False,
            "migrationAdmissionAuthorized": False,
            "productionAuthorization": False,
        },
        "carrierRule": "A_LATER_COMMITTED_AND_PUSHED_DWP_DEV_CARRIER_MUST_BE_REPINNED_BEFORE_ANY_TOKEN_WORKTREE_OR_SOURCE_CHANGE_AUTHORITY",
    })


def build_state(
    pins: dict[str, Any],
    authority: dict[str, Any],
    packet: dict[str, Any],
    requests: dict[str, Any],
    lease: dict[str, Any],
    grant: dict[str, Any],
) -> dict[str, Any]:
    return sealed({
        "schema": "dwp.hris.wave3-phase-a-state.v1",
        "stateId": "HRIS-WAVE3-PHASE-A-STATE-20261013-R1",
        "asOf": ISSUED_AT,
        "state": "AUTHORITY_REFRESH_PRESTART_FULFILLED_PENDING_CARRIER",
        "basePins": pins,
        "authorityRefreshSeal": authority["sealedPayloadSha256"],
        "preStartControlGrant": {
            "receiptId": grant["receiptId"],
            "status": grant["status"],
            "sealedPayloadSha256": grant["sealedPayloadSha256"],
        },
        "preparedPacket": {
            "packetId": packet["packetId"],
            "moduleId": packet["moduleId"],
            "state": packet["lifecycleState"],
            "sealedPayloadSha256": packet["sealedPayloadSha256"],
        },
        "migrationReservation": {
            "leaseId": lease["leaseId"],
            "version": lease["reservedVersion"],
            "status": lease["status"],
            "admission": False,
        },
        "controlGates": {
            "phaseACarrierCommittedAndPushed": False,
            "phaseACarrierRepinned": False,
            "typedArtifactBootstrapFulfilled": True,
            "workforceCompensationProjectionFulfilled": True,
            "v17VacancyRechecked": False,
            "freshWorktreesRegistered": False,
            "startTokenIssued": False,
            "promotionReceiptIssued": False,
            "sourceChangesAllowed": False,
            "productionReleaseAllowed": False,
        },
        "preStartRequestIds": requests["preStartRequestIds"],
        "activeTokens": [],
        "activeWorktrees": [],
        "promotionReceipts": [],
        "nextRequiredAuthority": "CARRIER_COMMIT_PUSH_REPIN_AND_PRESTART_REVALIDATION_THEN_FRESH_WORKTREE_TOKEN_AND_SEPARATE_PROMOTION",
    })


def build_all(frontend: Path, backend: Path, agent: Path) -> dict[Path, bytes]:
    assert_frontend_scope(frontend)
    pins = {
        "frontend": git_pin(frontend, "repo://dwp-frontend", require_clean=False),
        "backend": git_pin(
            backend,
            "repo://dwp-backend",
            require_clean=True,
            allow_detached=True,
        ),
        "agent": git_pin(agent, "repo://dwp_agent", require_clean=True),
    }
    versions = performance_versions(backend)
    if versions != [1, 2, 3, 16]:
        raise RuntimeError(f"unexpected Performance migration versions: {versions}")

    test_receipt = build_workforce_test_execution_receipt(backend, pins)
    workforce_evidence = compensation_projection_evidence(backend, test_receipt)
    g7_lineage = g7_authoritative_lineage(frontend)
    touch = build_touch(frontend, pins)
    overlap = build_overlap(frontend, backend, versions, pins, workforce_evidence)
    if overlap["result"] == "FAIL":
        raise RuntimeError("narrow overlap audit failed")
    lease = build_lease(pins, versions)
    requests = build_requests()
    grant = build_prestart_grant(
        pins, touch, lease, requests, workforce_evidence
    )
    packet = build_packet(frontend, pins, touch, lease, requests, grant)
    overlay_payload, overlay_rows, source_columns = build_overlay(
        frontend, touch["touchPolicyDigest"], g7_lineage
    )
    overlay_evidence = build_overlay_evidence(frontend, overlay_payload, overlay_rows, source_columns)
    authority = build_authority(
        frontend, backend, pins, overlay_evidence, overlap, grant
    )
    state = build_state(pins, authority, packet, requests, lease, grant)

    outputs: dict[Path, bytes] = {
        OUTPUT_PATHS["touch"]: json_bytes(touch),
        OUTPUT_PATHS["overlap"]: json_bytes(overlap),
        OUTPUT_PATHS["lease"]: json_bytes(lease),
        OUTPUT_PATHS["requests"]: json_bytes(requests),
        OUTPUT_PATHS["grant"]: json_bytes(grant),
        OUTPUT_PATHS["testReceipt"]: json_bytes(test_receipt),
        OUTPUT_PATHS["packet"]: json_bytes(packet),
        OUTPUT_PATHS["overlay"]: overlay_payload,
        OUTPUT_PATHS["overlayEvidence"]: json_bytes(overlay_evidence),
        OUTPUT_PATHS["authority"]: json_bytes(authority),
        OUTPUT_PATHS["state"]: json_bytes(state),
    }

    artifacts = [
        {"path": rel.as_posix(), "bytes": len(payload), "sha256": sha256_bytes(payload)}
        for rel, payload in sorted(outputs.items(), key=lambda item: item[0].as_posix())
    ]
    tool_paths = [
        BUNDLE_REL / "README.md",
        BUNDLE_REL / "materialize_wave3_phase_a.py",
        BUNDLE_REL / "validate_wave3_phase_a.py",
        BUNDLE_REL / "test_wave3_phase_a.py",
    ]
    tool_pins = [file_ref(frontend, rel) for rel in tool_paths]
    manifest = sealed({
        "schema": "dwp.hris.wave3-phase-a-manifest.v1",
        "manifestId": "HRIS-WAVE3-PHASE-A-MANIFEST-20261013-R1",
        "issuedAt": ISSUED_AT,
        "state": "PRESTART_CONDITIONS_FULFILLED_PREPARED_PENDING_CARRIER",
        "sourcePins": pins,
        "artifacts": artifacts,
        "artifactCount": len(artifacts),
        "toolPins": tool_pins,
        "toolCount": len(tool_pins),
        "overlayRows": 102,
        "overlayColumns": 55,
        "completedRows": 13,
        "retiredRows": 2,
        "remainingActiveRows": 87,
        "packetCount": 1,
        "preStartConditionsFulfilled": 2,
        "startTokenCount": 0,
        "worktreeBindingCount": 0,
        "promotionReceiptCount": 0,
        "productionAuthorization": False,
    })
    outputs[OUTPUT_PATHS["manifest"]] = json_bytes(manifest)
    return outputs


def write_outputs(frontend: Path, outputs: dict[Path, bytes]) -> None:
    for rel, payload in outputs.items():
        path = frontend / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)


def check_outputs(frontend: Path, outputs: dict[Path, bytes]) -> None:
    failures = []
    for rel, expected in outputs.items():
        path = frontend / rel
        if not path.exists():
            failures.append(f"missing {rel}")
        elif path.read_bytes() != expected:
            failures.append(f"drift {rel}")
    if failures:
        raise RuntimeError("Phase A generated artifact check failed:\n" + "\n".join(failures))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("prepare", "check"))
    parser.add_argument("--frontend-root")
    parser.add_argument("--backend-root")
    parser.add_argument("--agent-root")
    args = parser.parse_args()
    frontend, backend, agent = roots(args.frontend_root, args.backend_root, args.agent_root)
    outputs = build_all(frontend, backend, agent)
    if args.mode == "prepare":
        write_outputs(frontend, outputs)
        print(f"WAVE3_PHASE_A_PREPARED artifacts={len(outputs)}")
    else:
        check_outputs(frontend, outputs)
        print(f"WAVE3_PHASE_A_GENERATED_CHECK_PASS artifacts={len(outputs)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, subprocess.CalledProcessError, OSError, ValueError) as error:
        print(f"WAVE3_PHASE_A_ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
