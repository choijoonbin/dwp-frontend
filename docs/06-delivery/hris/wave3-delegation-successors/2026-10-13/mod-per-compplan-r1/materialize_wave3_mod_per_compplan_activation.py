#!/usr/bin/env python3
"""Materialize the append-only Wave3 MOD-PER-COMPPLAN Phase B/C carriers.

The Phase A carrier, clean pushed module worktrees, and exact V17 vacancy are
inputs.  Phase B seals the pending bundle.  Only after that exact bundle is
committed and pushed may this already-sealed tool emit the single Phase C
promotion receipt.  It never creates worktrees, changes module branches, or
runs application tests.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import subprocess
import xml.etree.ElementTree as ET
from copy import deepcopy
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
DEFAULT_FRONTEND = HERE.parents[5]
WORKSPACE = DEFAULT_FRONTEND.parent
DEFAULT_BACKEND = (
    WORKSPACE / ".codex-worktrees/hris/wave3-20261013/control-backend-pin"
)
DEFAULT_AGENT = WORKSPACE / "dwp_agent"
DEFAULT_WORKTREE_ROOT = (
    WORKSPACE / ".codex-worktrees/hris/wave3-20261013/mod-per-compplan"
)

HRIS_REL = Path("docs/06-delivery/hris")
PHASE_A_REL = HRIS_REL / "wave3-2026-10-13"
SUCCESSOR_REL = (
    HRIS_REL
    / "wave3-delegation-successors/2026-10-13/mod-per-compplan-r1"
)
PROMOTION_REL = (
    HRIS_REL
    / "2026-10-13-wave3-mod-per-compplan-promotion-receipt.v1.json"
)

PHASE_A_COMMIT = "1f187a7903d2792b696a6f8ca2b207ebb79b33e1"
PHASE_A_TREE = "17da7a80fed75c137ca76ea23081dae05155b19b"
PHASE_A_PARENT = "388ad0fb2e50689cdc2a00186ffc6ca07f237e57"
PHASE_A_MANIFEST_SHA256 = (
    "dd370dacbce5240f87ddcf77fa1fd21d478faa1a8fd372acd6ff73c5ceda6a82"
)
BACKEND_COMMIT = "3565c3e61b6c37a6b8088cc5250791fce32a0d9f"
BACKEND_TREE = "af973ef11d003edcf266673330300c612ffe247b"
AGENT_COMMIT = "1d46fc4ab49c604efb7464574c49d13ee453e059"
AGENT_TREE = "0b9a8dbfd828478ee825452e5aca8688c83e37ab"

ISSUED_AT = "2026-10-13T14:30:00+09:00"
EXPIRES_AT = "2026-10-20T14:30:00+09:00"
TOKEN_ID = "HRIS-WAVE3-START-MOD-PER-COMPPLAN-R1"
LEASE_ID = "HRIS-WAVE3-LEASE-MOD-PER-COMPPLAN-PERFORMANCE-V17-R2"
PROMOTION_ID = "HRIS-WAVE3-MOD-PER-COMPPLAN-PROMOTION-20261013-R1"
PACKET_ID = "HRIS-WAVE3-PACKET-MOD-PER-COMPPLAN-R2-PHASE-A"
MODULE_ID = "MOD-PER-COMPPLAN"
EMPTY_SHA256 = hashlib.sha256(b"").hexdigest()

PACKET_REL = PHASE_A_REL / "mod-per-compplan/packet.v2.json"
GRANT_REL = (
    PHASE_A_REL / "mod-per-compplan/prestart-control-grant-receipt.v1.json"
)
TOUCH_REL = PHASE_A_REL / "mod-per-compplan/touch-manifest.v1.json"
RESERVATION_REL = PHASE_A_REL / "mod-per-compplan/migration-lease.v1.json"
TEST_RECEIPT_REL = (
    PHASE_A_REL / "workforce-compensation-targeted-test-execution-receipt.v1.json"
)
PHASE_A_MANIFEST_REL = PHASE_A_REL / "manifest.v1.json"
AUTHORITY_REL = PHASE_A_REL / "authority-refresh.v1.json"
CONTROL_REQUESTS_REL = PHASE_A_REL / "control-requests.v1.json"

LEASE_OUTPUT = Path("migration-lease-admission.v1.json")
REGISTER_OUTPUT = Path("registers/module-worktrees.active.v1.csv")
TOKEN_OUTPUT = Path("tokens/mod-per-compplan.start-token.v1.json")
STATE_OUTPUT = Path("state/activation-pending-promotion.v1.json")
MANIFEST_OUTPUT = Path("manifest.v1.json")

CSV_FIELDS = [
    "module",
    "slice_id",
    "token_id",
    "repo",
    "absolute_path",
    "branch",
    "upstream",
    "head",
    "tree",
    "state_sha256",
    "clean",
    "ahead",
    "behind",
    "state",
]

WORKTREE_SPECS = {
    "frontend": {
        "path": "frontend",
        "branch": "codex/hris-wave3-per-compplan-frontend-20261013-r1",
        "head": PHASE_A_COMMIT,
        "tree": PHASE_A_TREE,
    },
    "backend": {
        "path": "backend",
        "branch": "codex/hris-wave3-per-compplan-backend-20261013-r1",
        "head": BACKEND_COMMIT,
        "tree": BACKEND_TREE,
    },
}

DOMAIN_TABLES = [
    "prf_cmp_cycles",
    "prf_cmp_budget_ledger",
    "prf_cmp_proposals",
    "prf_cmp_proposal_revisions",
    "prf_cmp_approved_snapshots",
    "prf_cmp_approved_snapshot_lines",
]
SHARED_TABLES = ["prf_per_artifact_versions"]
V17_PATH = (
    "dwp-people-server/src/main/resources/db/performance-migration/"
    "V17__per_modern_compensation_planning.sql"
)

SCHEMA_FILES = [
    "contracts/wave3-activation-manifest.schema.v1.json",
    "contracts/wave3-activation-state.schema.v1.json",
    "contracts/wave3-migration-lease-admission.schema.v1.json",
    "contracts/wave3-promotion-receipt.schema.v1.json",
    "contracts/wave3-start-token.schema.v1.json",
]
TOOL_FILES = [
    "README.md",
    "materialize_wave3_mod_per_compplan_activation.py",
    "validate_wave3_mod_per_compplan_activation.py",
    "test_wave3_mod_per_compplan_activation.py",
    *SCHEMA_FILES,
]
ARTIFACT_FILES = [
    LEASE_OUTPUT.as_posix(),
    REGISTER_OUTPUT.as_posix(),
    TOKEN_OUTPUT.as_posix(),
    STATE_OUTPUT.as_posix(),
]
BUNDLE_FILES = TOOL_FILES + ARTIFACT_FILES + [MANIFEST_OUTPUT.as_posix()]
BUNDLE_REPOSITORY_PATHS = {
    str(SUCCESSOR_REL / relative) for relative in BUNDLE_FILES
}
PROMOTION_SELF_REFERENCE_RULE = (
    "The promotion receipt is carried by a later direct-child commit and "
    "pins the immutable Wave3 MOD-PER-COMPPLAN Phase B bundle commit."
)


class PhaseBBlocked(RuntimeError):
    """Raised when an authority prerequisite is not exact."""


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


def git_bytes(root: Path, *args: str) -> bytes:
    result = subprocess.run(
        ("git", *args),
        cwd=root,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return result.stdout


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def json_bytes(value: Any) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=False) + "\n"
    ).encode("utf-8")


def sealed(value: dict[str, Any]) -> dict[str, Any]:
    result = deepcopy(value)
    result.pop("sealedPayloadSha256", None)
    result["sealedPayloadSha256"] = sha256_bytes(canonical_bytes(result))
    return result


def verify_seal(value: dict[str, Any], label: str) -> None:
    actual = value.get("sealedPayloadSha256")
    candidate = deepcopy(value)
    candidate.pop("sealedPayloadSha256", None)
    expected = sha256_bytes(canonical_bytes(candidate))
    if actual != expected:
        raise PhaseBBlocked(f"{label} seal mismatch")


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PhaseBBlocked(f"cannot read JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise PhaseBBlocked(f"JSON object required: {path}")
    return value


def file_ref(root: Path, relative: Path) -> dict[str, Any]:
    payload = (root / relative).read_bytes()
    return {
        "path": relative.as_posix(),
        "bytes": len(payload),
        "sha256": sha256_bytes(payload),
    }


def require(condition: bool, message: str) -> None:
    if not condition:
        raise PhaseBBlocked(message)


def require_full_oid(value: str, label: str) -> None:
    require(
        re.fullmatch(r"[0-9a-f]{40}", value) is not None,
        f"{label} must be a full lowercase Git object ID",
    )


def require_configured_upstream(actual: str, expected: str, label: str) -> None:
    require(
        actual == expected,
        f"{label} configured upstream drift: expected {expected}, found {actual}",
    )


def configured_upstream(root: Path) -> str:
    return git(root, "rev-parse", "--abbrev-ref", "@{upstream}")


def validate_frontend_boundary(frontend: Path) -> None:
    require(git(frontend, "branch", "--show-current") == "dwp-dev", "frontend branch is not dwp-dev")
    require_configured_upstream(
        configured_upstream(frontend), "origin/dwp-dev", "frontend"
    )
    require(git(frontend, "rev-parse", "HEAD") == PHASE_A_COMMIT, "frontend HEAD is not Phase A carrier")
    require(git(frontend, "rev-parse", "HEAD^{tree}") == PHASE_A_TREE, "Phase A carrier tree drift")
    require(git(frontend, "rev-parse", "HEAD^") == PHASE_A_PARENT, "Phase A carrier parent drift")
    require(git(frontend, "rev-parse", "origin/dwp-dev") == PHASE_A_COMMIT, "frontend origin/dwp-dev is not Phase A carrier")

    status = git(frontend, "status", "--porcelain=v1", "--untracked-files=all")
    for line in status.splitlines():
        path = line[3:]
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        require(
            path.startswith(SUCCESSOR_REL.as_posix() + "/"),
            f"frontend change outside Phase B successor root: {line}",
        )

    phase_a_manifest = load_json(frontend / PHASE_A_MANIFEST_REL)
    verify_seal(phase_a_manifest, "Phase A manifest")
    require(
        sha256_bytes((frontend / PHASE_A_MANIFEST_REL).read_bytes())
        == PHASE_A_MANIFEST_SHA256,
        "Phase A manifest file hash drift",
    )
    expected_paths = {
        row["path"]
        for row in phase_a_manifest["artifacts"] + phase_a_manifest["toolPins"]
    } | {PHASE_A_MANIFEST_REL.as_posix()}
    changes = git(
        frontend,
        "diff",
        "--name-status",
        PHASE_A_PARENT,
        PHASE_A_COMMIT,
    ).splitlines()
    observed: set[str] = set()
    for line in changes:
        columns = line.split("\t")
        require(len(columns) == 2 and columns[0] == "A", f"Phase A carrier is not additive: {line}")
        observed.add(columns[1])
    require(observed == expected_paths, "Phase A carrier closed-set diff mismatch")
    for row in phase_a_manifest["artifacts"] + phase_a_manifest["toolPins"]:
        payload = (frontend / row["path"]).read_bytes()
        require(len(payload) == row["bytes"], f"Phase A byte drift: {row['path']}")
        require(sha256_bytes(payload) == row["sha256"], f"Phase A hash drift: {row['path']}")


def validate_repository_pin(
    root: Path,
    commit: str,
    tree: str,
    label: str,
    *,
    expected_upstream: str | None = None,
) -> None:
    require(root.is_dir(), f"{label} checkout missing: {root}")
    require(git(root, "rev-parse", "HEAD") == commit, f"{label} commit drift")
    require(git(root, "rev-parse", "HEAD^{tree}") == tree, f"{label} tree drift")
    require(git(root, "rev-parse", "origin/dwp-dev") == commit, f"{label} origin/dwp-dev drift")
    if expected_upstream is not None:
        require_configured_upstream(
            configured_upstream(root), expected_upstream, label
        )
    require(not git(root, "status", "--porcelain=v1"), f"{label} checkout is dirty")


def inspect_worktree(root: Path, repo: str) -> dict[str, str]:
    spec = WORKTREE_SPECS[repo]
    path = root / spec["path"]
    branch = spec["branch"]
    upstream = f"origin/{branch}"
    require(path.is_dir(), f"{repo} module worktree missing")
    require(git(path, "branch", "--show-current") == branch, f"{repo} worktree branch drift")
    require_configured_upstream(
        configured_upstream(path), upstream, f"{repo} module worktree"
    )
    require(git(path, "rev-parse", "@{upstream}") == spec["head"], f"{repo} worktree upstream commit drift")
    counts = git(path, "rev-list", "--left-right", "--count", "HEAD...@{upstream}").split()
    require(counts == ["0", "0"], f"{repo} worktree is not exactly pushed: {counts}")
    status = git(path, "status", "--porcelain=v1")
    require(not status, f"{repo} module worktree is dirty")
    require(git(path, "rev-parse", "HEAD") == spec["head"], f"{repo} worktree HEAD drift")
    require(git(path, "rev-parse", "HEAD^{tree}") == spec["tree"], f"{repo} worktree tree drift")
    return {
        "module": "PER",
        "slice_id": MODULE_ID,
        "token_id": TOKEN_ID,
        "repo": repo,
        "absolute_path": str(path.resolve()),
        "branch": branch,
        "upstream": upstream,
        "head": spec["head"],
        "tree": spec["tree"],
        "state_sha256": sha256_bytes(status.encode("utf-8")),
        "clean": "true",
        "ahead": "0",
        "behind": "0",
        "state": "CREATED_PUSHED_CLEAN",
    }


def performance_versions(backend: Path) -> list[int]:
    root = backend / "dwp-people-server/src/main/resources/db/performance-migration"
    versions: list[int] = []
    for path in root.glob("V*__*.sql"):
        match = re.match(r"V(\d+)__", path.name)
        if match:
            versions.append(int(match.group(1)))
    versions.sort()
    require(versions == [1, 2, 3, 16], f"Performance stream drift: {versions}")
    require(not (backend / V17_PATH).exists(), "V17 exact path is occupied")
    return versions


def validate_phase_a_inputs(frontend: Path, backend: Path) -> dict[str, dict[str, Any]]:
    docs = {
        "manifest": load_json(frontend / PHASE_A_MANIFEST_REL),
        "packet": load_json(frontend / PACKET_REL),
        "grant": load_json(frontend / GRANT_REL),
        "touch": load_json(frontend / TOUCH_REL),
        "reservation": load_json(frontend / RESERVATION_REL),
        "testReceipt": load_json(frontend / TEST_RECEIPT_REL),
        "authority": load_json(frontend / AUTHORITY_REL),
        "controlRequests": load_json(frontend / CONTROL_REQUESTS_REL),
    }
    for label, value in docs.items():
        verify_seal(value, f"Phase A {label}")

    packet = docs["packet"]
    grant = docs["grant"]
    touch = docs["touch"]
    reservation = docs["reservation"]
    receipt = docs["testReceipt"]
    authority = docs["authority"]
    requests = docs["controlRequests"]
    require(packet["packetId"] == PACKET_ID, "Phase A packet identity drift")
    require(packet["lifecycleState"] == "PACKET_PREPARED_START_WITHHELD", "Phase A packet state drift")
    require(packet["startTokenId"] is None, "Phase A packet unexpectedly has a token")
    require(not any(packet["authority"].values()), "Phase A packet already grants authority")
    require(grant["status"] == "PASS_TWO_PRESTART_CONDITIONS_FULFILLED", "prestart grant status drift")
    states = {row["category"]: row["state"] for row in grant["conditions"]}
    require(states == {
        "TYPED_ARTIFACT_BOOTSTRAP": "ALLOCATED_REGISTERED_GRANTED",
        "WORKFORCE_SNAPSHOT_COMPENSATION_PROJECTION": "IMPLEMENTED_TESTED_REGISTERED_GRANTED",
    }, "prestart condition closed set drift")
    require(len(touch["allowedPaths"]) == 8, "allowed path count drift")
    require(touch["commonControlOnlyPathCount"] == 68, "protected path count drift")
    require(len(touch["commonControlOnlyPaths"]) == 68, "protected path closed set drift")
    require(
        sha256_bytes(canonical_bytes(touch["allowedPaths"]))
        == "491b1ab54a53daa2fd34a356f89eaa74c2438364bb1cc7d14f19c426028a4de3",
        "allowed path closed-set digest drift",
    )
    require(
        sha256_bytes(canonical_bytes(touch["commonControlOnlyPaths"]))
        == "b2cdd49b6627fb4dd75843740431390947e8dd5206dc954220b1c3ae91d14c89",
        "common-Control closed-set digest drift",
    )
    require(touch["moduleMayEditCommonControlPaths"] is False, "common-Control edit authority drift")
    require(reservation["leaseId"].endswith("V17-R1"), "Phase A reservation identity drift")
    require(reservation["status"] == "RESERVED_PHASE_A_PRESTART_GRANTED_PENDING_CARRIER_AND_START_TOKEN", "Phase A reservation state drift")
    require(reservation["admission"] is False, "Phase A reservation was already admitted")
    require(reservation["observedVersions"] == ["V1", "V2", "V3", "V16"], "Phase A observed versions drift")
    require(reservation["currentHighWater"] == "V16", "Phase A high-water drift")
    require(reservation["outOfOrder"] is False, "Phase A outOfOrder drift")
    require(reservation["exactPath"] == V17_PATH, "Phase A V17 path drift")
    require(reservation["expiresAt"] == EXPIRES_AT, "Phase A lease expiry drift")
    require(authority["sealedPayloadSha256"] == "2f294eef78f203ffd278e01a995ec02cbaa07f45e058a5b5ecfb2e3b297918b2", "Phase A authority seal drift")
    require(authority["decision"]["bothPreStartConditionsFulfilled"] is True, "Phase A authority did not fulfill both prestart conditions")
    require(authority["decision"]["startTokenIssued"] is False, "Phase A authority already issued a token")
    require(authority["decision"]["sourceChangeAuthorized"] is False, "Phase A authority already authorized source changes")
    require(requests["sealedPayloadSha256"] == "7d5a3712cdb782b2a28810da02fa9227252762287f29210ed1de799b0410cb26", "Phase A control request seal drift")
    prestart = [row for row in requests["requests"] if row["phase"] == "PRE_START"]
    postresult = [row for row in requests["requests"] if row["phase"] == "AFTER_PUSHED_MODULE_RESULT"]
    require(len(prestart) == 2, "prestart control obligation count drift")
    require(len(postresult) == 5, "post-result control obligation count drift")
    require(all(row["moduleMayImplement"] is False for row in requests["requests"]), "module received a Central control obligation")

    require(receipt["backendPin"]["commit"] == BACKEND_COMMIT, "test receipt backend commit drift")
    require(receipt["backendPin"]["tree"] == BACKEND_TREE, "test receipt backend tree drift")
    require(receipt["result"] == "PASS_24_TESTS_ZERO_FAILURES_ERRORS_SKIPPED", "test receipt result drift")
    require(receipt["totals"] == {"tests": 24, "failures": 0, "errors": 0, "skipped": 0}, "test receipt totals drift")
    require(receipt["reportCount"] == 3, "test receipt report count drift")
    for report in receipt["reports"]:
        path = backend / report["path"]
        payload = path.read_bytes()
        require(len(payload) == report["bytes"], f"targeted XML byte drift: {report['path']}")
        require(sha256_bytes(payload) == report["sha256"], f"targeted XML hash drift: {report['path']}")
        suite = ET.fromstring(payload)
        require(int(suite.attrib["tests"]) == report["tests"], f"targeted XML test count drift: {report['path']}")
        require(int(suite.attrib["failures"]) == 0, f"targeted XML failure drift: {report['path']}")
        require(int(suite.attrib["errors"]) == 0, f"targeted XML error drift: {report['path']}")
        require(int(suite.attrib["skipped"]) == 0, f"targeted XML skipped drift: {report['path']}")

    workforce = next(row for row in grant["conditions"] if row["category"] == "WORKFORCE_SNAPSHOT_COMPENSATION_PROJECTION")
    require(workforce["targetedTestExecutionReceiptSeal"] == receipt["sealedPayloadSha256"], "grant/test receipt seal mismatch")
    for ref in workforce["evidenceFiles"] + workforce["legacyCompatibilityEvidenceFiles"]:
        payload = (backend / ref["path"]).read_bytes()
        require(len(payload) == ref["bytes"], f"prestart evidence byte drift: {ref['path']}")
        require(sha256_bytes(payload) == ref["sha256"], f"prestart evidence hash drift: {ref['path']}")
    return docs


def execution_base_pins() -> dict[str, Any]:
    return {
        "frontend": {
            "repository": "repo://dwp-frontend",
            "branch": "dwp-dev",
            "upstream": "origin/dwp-dev",
            "commit": PHASE_A_COMMIT,
            "tree": PHASE_A_TREE,
            "clean": True,
            "upstreamMatched": True,
        },
        "backend": {
            "repository": "repo://dwp-backend",
            "branch": "dwp-dev",
            "upstream": "origin/dwp-dev",
            "commit": BACKEND_COMMIT,
            "tree": BACKEND_TREE,
            "cleanVerificationCheckout": True,
            "upstreamMatched": True,
        },
        "agent": {
            "repository": "repo://dwp_agent",
            "branch": "dwp-dev",
            "upstream": "origin/dwp-dev",
            "commit": AGENT_COMMIT,
            "tree": AGENT_TREE,
            "clean": True,
            "upstreamMatched": True,
            "hrisModuleSliceAuthority": False,
        },
    }


def predecessor_pins(frontend: Path, docs: dict[str, dict[str, Any]]) -> dict[str, Any]:
    return {
        "phaseACarrier": {
            "commit": PHASE_A_COMMIT,
            "tree": PHASE_A_TREE,
            "parent": PHASE_A_PARENT,
            "branch": "dwp-dev",
            "upstream": "origin/dwp-dev",
        },
        "phaseAManifest": {
            **file_ref(frontend, PHASE_A_MANIFEST_REL),
            "sealedPayloadSha256": docs["manifest"]["sealedPayloadSha256"],
        },
        "packet": {
            **file_ref(frontend, PACKET_REL),
            "packetId": PACKET_ID,
            "sealedPayloadSha256": docs["packet"]["sealedPayloadSha256"],
        },
        "preStartControlGrant": {
            **file_ref(frontend, GRANT_REL),
            "receiptId": docs["grant"]["receiptId"],
            "sealedPayloadSha256": docs["grant"]["sealedPayloadSha256"],
        },
        "touchPolicy": {
            **file_ref(frontend, TOUCH_REL),
            "manifestId": docs["touch"]["manifestId"],
            "touchPolicyDigest": docs["touch"]["touchPolicyDigest"],
            "sealedPayloadSha256": docs["touch"]["sealedPayloadSha256"],
        },
        "migrationReservation": {
            **file_ref(frontend, RESERVATION_REL),
            "leaseId": docs["reservation"]["leaseId"],
            "sealedPayloadSha256": docs["reservation"]["sealedPayloadSha256"],
        },
        "targetedTestExecutionReceipt": {
            **file_ref(frontend, TEST_RECEIPT_REL),
            "receiptId": docs["testReceipt"]["receiptId"],
            "sealedPayloadSha256": docs["testReceipt"]["sealedPayloadSha256"],
        },
        "authorityRefresh": {
            **file_ref(frontend, AUTHORITY_REL),
            "sealedPayloadSha256": docs["authority"]["sealedPayloadSha256"],
        },
        "controlRequests": {
            **file_ref(frontend, CONTROL_REQUESTS_REL),
            "registerId": docs["controlRequests"]["registerId"],
            "sealedPayloadSha256": docs["controlRequests"]["sealedPayloadSha256"],
        },
    }


def register_bytes(rows: list[dict[str, str]]) -> bytes:
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=CSV_FIELDS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue().encode("utf-8")


def build_lease(
    frontend: Path,
    docs: dict[str, dict[str, Any]],
    backend_row: dict[str, str],
) -> dict[str, Any]:
    reservation = docs["reservation"]
    return sealed({
        "schema": "dwp.hris.wave3-migration-lease-admission.v1",
        "leaseId": LEASE_ID,
        "issuedAt": ISSUED_AT,
        "expiresAt": EXPIRES_AT,
        "module": "PER",
        "moduleId": MODULE_ID,
        "sliceId": MODULE_ID,
        "packetId": PACKET_ID,
        "ownerTokenId": TOKEN_ID,
        "predecessorReservation": {
            **file_ref(frontend, RESERVATION_REL),
            "leaseId": reservation["leaseId"],
            "status": reservation["status"],
            "sealedPayloadSha256": reservation["sealedPayloadSha256"],
            "disposition": "SUPERSEDED_BY_EXACT_V17_ADMISSION",
        },
        "repository": "backend",
        "executionBasePin": execution_base_pins()["backend"],
        "stream": "PERFORMANCE",
        "schemaName": "hris_performance",
        "historyTable": "flyway_performance_schema_history",
        "location": "classpath:db/performance-migration",
        "observedVersions": ["V1", "V2", "V3", "V16"],
        "currentHighWater": "V16",
        "outOfOrder": False,
        "version": "V17",
        "exactRelativePath": V17_PATH,
        "worktreeBinding": backend_row,
        "tableAllocation": {
            "domainTables": DOMAIN_TABLES,
            "domainTableCount": 6,
            "sharedFoundationTables": SHARED_TABLES,
            "sharedFoundationTableCount": 1,
            "totalTableCount": 7,
            "typedArtifactBootstrapState": "ALLOCATED_REGISTERED_GRANTED",
            "implementationState": "AUTHORIZED_AFTER_PROMOTION_ONLY",
        },
        "status": "ADMITTED_DOMAIN_AUTHORING",
        "migrationAdmissionAuthorized": True,
        "effectiveAfterPromotionOnly": True,
        "upgradePath": "EMPTY_OR_V16_TO_V17",
        "rollbackStrategy": "FORWARD_FIX_ONLY_AFTER_PROMOTION; UNUSED_ADMISSION_EXPIRES_WITHOUT_FILE",
        "invalidationConditions": [
            "promotion receipt does not list the exact owner token in the active closed set",
            "backend dwp-dev commit or tree changes",
            "the Performance migration high-water changes",
            "V17 or the exact path is claimed by another migration",
            "the owner token expires, is revoked, or changes scope",
        ],
    })


def build_dependency_binding(
    frontend: Path, docs: dict[str, dict[str, Any]], predecessors: dict[str, Any]
) -> dict[str, Any]:
    packet = docs["packet"]
    return {
        "phaseACarrier": predecessors["phaseACarrier"],
        "phaseAManifestSha256": predecessors["phaseAManifest"]["sha256"],
        "packetFileSha256": predecessors["packet"]["sha256"],
        "packetSealedPayloadSha256": packet["sealedPayloadSha256"],
        "preStartControlGrantFileSha256": predecessors["preStartControlGrant"]["sha256"],
        "preStartControlGrantSealedPayloadSha256": docs["grant"]["sealedPayloadSha256"],
        "targetedTestReceiptFileSha256": predecessors["targetedTestExecutionReceipt"]["sha256"],
        "targetedTestReceiptSealedPayloadSha256": docs["testReceipt"]["sealedPayloadSha256"],
        "dependencies": packet["dependencies"],
        "producerResultPins": packet["producerResultPins"],
        "contractPins": packet["contractPins"],
    }


def build_token(
    frontend: Path,
    docs: dict[str, dict[str, Any]],
    predecessors: dict[str, Any],
    rows: list[dict[str, str]],
    lease: dict[str, Any],
    lease_raw: bytes,
) -> dict[str, Any]:
    touch = docs["touch"]
    grant = docs["grant"]
    binding = build_dependency_binding(frontend, docs, predecessors)
    return sealed({
        "schema": "dwp.hris.wave3-module-start-token.v1",
        "tokenId": TOKEN_ID,
        "packetId": PACKET_ID,
        "packetPath": PACKET_REL.as_posix(),
        "packetFileSha256": predecessors["packet"]["sha256"],
        "module": "PER",
        "moduleId": MODULE_ID,
        "sliceId": MODULE_ID,
        "sessionId": "HRIS-PER",
        "issuedAt": ISSUED_AT,
        "issuedBy": "SYS_COMMON_INTEGRATION_CONTROL",
        "expiresAt": EXPIRES_AT,
        "activationReceiptId": PROMOTION_ID,
        "state": "ISSUED_PENDING_PROMOTION_RECEIPT",
        "predecessorAuthority": {
            "phaseACarrier": predecessors["phaseACarrier"],
            "phaseAManifest": predecessors["phaseAManifest"],
            "packetLifecycleState": "PACKET_PREPARED_START_WITHHELD",
            "effectiveLifecycleStateAfterPromotion": "PACKET_AUTHORIZED_DOMAIN_AUTHORING",
            "overriddenFields": [
                "lifecycleState",
                "startTokenId",
                "worktreeBindings",
                "migrationLease",
                "authority.sourceChangeAuthority",
                "authority.startTokenAuthority",
                "authority.worktreeRegistrationAuthority",
                "authority.migrationAdmissionAuthority",
            ],
        },
        "executionBasePins": execution_base_pins(),
        "worktreeBindings": rows,
        "pathPolicy": {
            **predecessors["touchPolicy"],
            "allowedPathCount": 8,
            "protectedPathCount": 68,
            "allowedPathsSha256": sha256_bytes(canonical_bytes(touch["allowedPaths"])),
            "protectedPathsSha256": sha256_bytes(canonical_bytes(touch["commonControlOnlyPaths"])),
        },
        "effectiveAllowedPaths": touch["allowedPaths"],
        "protectedPaths": touch["commonControlOnlyPaths"],
        "dependencyBinding": binding,
        "dependencyPinsSha256": sha256_bytes(canonical_bytes(binding)),
        "controlObligations": {
            **predecessors["controlRequests"],
            "preStart": [
                deepcopy(row)
                for row in docs["controlRequests"]["requests"]
                if row["phase"] == "PRE_START"
            ],
            "afterPushedModuleResult": [
                deepcopy(row)
                for row in docs["controlRequests"]["requests"]
                if row["phase"] == "AFTER_PUSHED_MODULE_RESULT"
            ],
        },
        "preStartControlGrant": {
            **predecessors["preStartControlGrant"],
            "status": grant["status"],
            "conditionStates": {
                row["category"]: row["state"] for row in grant["conditions"]
            },
            "revalidatedAtPhaseACarrier": True,
        },
        "migrationLease": {
            "leaseId": LEASE_ID,
            "path": str(SUCCESSOR_REL / LEASE_OUTPUT),
            "bytes": len(lease_raw),
            "sha256": sha256_bytes(lease_raw),
            "sealedPayloadSha256": lease["sealedPayloadSha256"],
            "exactRelativePath": V17_PATH,
            "status": "ADMITTED_DOMAIN_AUTHORING",
            "effectiveAfterPromotionOnly": True,
        },
        "permittedAction": "START_DOMAIN_MODULE_IMPLEMENTATION_AFTER_PROMOTION",
        "invalidationConditions": [
            "promotion receipt does not list this exact token in the active closed set",
            "Phase A carrier, packet, grant, touch policy, or test receipt pin changes",
            "token, worktree, dependency, or migration lease digest changes",
            "a worktree is dirty, unpublished, ahead, behind, or on another branch",
            "an allowed-path or inherited common-Control boundary is crossed",
            "the Performance migration boundary changes or V17 is occupied",
            "the token expires or is revoked",
        ],
        "authority": {
            "domainAuthoringOnly": True,
            "sourceChangeAuthorized": True,
            "effectiveAfterPromotionOnly": True,
            "currentlyEffective": False,
            "exactWorktreesOnly": True,
            "exactAllowedPathsOnly": True,
            "migrationAuthorityMode": "ADMITTED_EXACT_LEASE",
            "migrationEditAuthorized": True,
            "commitAndPushTokenBranchesAuthorized": True,
            "sharedControlPathChangeAuthorized": False,
            "integrationMergeAuthorized": False,
            "payConsumptionAuthorized": False,
            "customerDataAuthorized": False,
            "customerActivationAuthorized": False,
            "productionReleaseAuthorized": False,
        },
    })


def build_state(
    predecessors: dict[str, Any],
    rows: list[dict[str, str]],
    register_raw: bytes,
    token: dict[str, Any],
    token_raw: bytes,
    lease: dict[str, Any],
    lease_raw: bytes,
) -> dict[str, Any]:
    return sealed({
        "schema": "dwp.hris.wave3-mod-per-compplan-activation-state.v1",
        "stateId": "HRIS-WAVE3-MOD-PER-COMPPLAN-ACTIVATION-STATE-20261013-R1",
        "issuedAt": ISSUED_AT,
        "state": "BUNDLE_SEALED_PENDING_PROMOTION_RECEIPT",
        "activationReceiptId": PROMOTION_ID,
        "predecessor": {
            "phaseACarrier": predecessors["phaseACarrier"],
            "phaseAManifest": predecessors["phaseAManifest"],
        },
        "effectiveDelegationAfterPromotion": {
            "module": "PER",
            "moduleId": MODULE_ID,
            "sliceId": MODULE_ID,
            "sessionId": "HRIS-PER",
            "packetId": PACKET_ID,
            "effectivePacketState": "PACKET_AUTHORIZED_DOMAIN_AUTHORING",
            "tokenId": TOKEN_ID,
            "tokenPath": str(SUCCESSOR_REL / TOKEN_OUTPUT),
            "tokenSha256": sha256_bytes(token_raw),
            "tokenSealedPayloadSha256": token["sealedPayloadSha256"],
            "migrationAuthorityMode": "ADMITTED_EXACT_LEASE",
            "migrationLeaseId": LEASE_ID,
            "migrationLeasePath": str(SUCCESSOR_REL / LEASE_OUTPUT),
            "migrationLeaseSha256": sha256_bytes(lease_raw),
            "migrationLeaseSeal": lease["sealedPayloadSha256"],
            "authority": "DOMAIN_AUTHORING_ONLY",
        },
        "currentActiveTokenClosedSet": [],
        "activeTokenClosedSetAfterPromotion": [TOKEN_ID],
        "worktreeRegister": {
            "path": str(SUCCESSOR_REL / REGISTER_OUTPUT),
            "bytes": len(register_raw),
            "sha256": sha256_bytes(register_raw),
            "rows": 2,
            "bindings": rows,
        },
        "authority": {
            "promotionReceiptIssued": False,
            "currentModuleAuthoringAuthorized": False,
            "moduleAuthoringAuthorizedAfterPromotion": True,
            "authorizedModulesAfterPromotion": ["PER"],
            "authorizedSlicesAfterPromotion": [MODULE_ID],
            "migrationAdmissionAuthorizedAfterPromotion": [LEASE_ID],
            "sharedControlPathChangeAuthorizedForModule": False,
            "integrationMergeAuthorized": False,
            "payConsumptionAuthorized": False,
            "customerDataAuthorized": False,
            "customerActivationAuthorized": False,
            "productionReleaseAuthorized": False,
        },
    })


def build_all(
    frontend: Path,
    backend: Path,
    agent: Path,
    worktree_root: Path,
) -> dict[Path, bytes]:
    validate_frontend_boundary(frontend)
    validate_repository_pin(backend, BACKEND_COMMIT, BACKEND_TREE, "backend control pin")
    validate_repository_pin(
        agent,
        AGENT_COMMIT,
        AGENT_TREE,
        "agent pin",
        expected_upstream="origin/dwp-dev",
    )
    performance_versions(backend)
    docs = validate_phase_a_inputs(frontend, backend)
    rows = [inspect_worktree(worktree_root, repo) for repo in ("frontend", "backend")]
    performance_versions(worktree_root / "backend")
    predecessors = predecessor_pins(frontend, docs)
    register_raw = register_bytes(rows)
    lease = build_lease(frontend, docs, rows[1])
    lease_raw = json_bytes(lease)
    token = build_token(frontend, docs, predecessors, rows, lease, lease_raw)
    token_raw = json_bytes(token)
    state = build_state(
        predecessors, rows, register_raw, token, token_raw, lease, lease_raw
    )
    state_raw = json_bytes(state)

    outputs: dict[Path, bytes] = {
        LEASE_OUTPUT: lease_raw,
        REGISTER_OUTPUT: register_raw,
        TOKEN_OUTPUT: token_raw,
        STATE_OUTPUT: state_raw,
    }
    artifacts = [
        {
            "path": str(SUCCESSOR_REL / relative),
            "bytes": len(payload),
            "sha256": sha256_bytes(payload),
        }
        for relative, payload in sorted(outputs.items(), key=lambda item: item[0].as_posix())
    ]
    tool_pins = [file_ref(frontend, SUCCESSOR_REL / path) for path in TOOL_FILES]
    manifest = sealed({
        "schema": "dwp.hris.wave3-mod-per-compplan-activation-manifest.v1",
        "manifestId": "HRIS-WAVE3-MOD-PER-COMPPLAN-ACTIVATION-MANIFEST-20261013-R1",
        "issuedAt": ISSUED_AT,
        "state": "BUNDLE_SEALED_PENDING_PROMOTION_RECEIPT",
        "predecessorPins": predecessors,
        "executionBasePins": execution_base_pins(),
        "activeTokenClosedSetAfterPromotion": [TOKEN_ID],
        "artifacts": artifacts,
        "artifactCount": 4,
        "toolPins": tool_pins,
        "toolCount": len(tool_pins),
        "startTokenCount": 1,
        "worktreeBindingCount": 2,
        "migrationAdmissionCount": 1,
        "promotionReceiptCount": 0,
        "productionAuthorization": False,
    })
    outputs[MANIFEST_OUTPUT] = json_bytes(manifest)
    return outputs


def load_register(path: Path) -> tuple[list[dict[str, str]], bytes]:
    raw = path.read_bytes()
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
        require(reader.fieldnames == CSV_FIELDS, "worktree register header drift")
    require(len(rows) == 2, "worktree register row count drift")
    require(
        [row.get("repo") for row in rows] == ["frontend", "backend"],
        "worktree register order drift",
    )
    return rows, raw


def validate_bundle_commit_objects(
    frontend: Path,
    bundle_commit: str,
    bundle_tree: str,
) -> dict[str, Any]:
    """Validate the immutable Phase B carrier without trusting its manifest."""

    require_full_oid(bundle_commit, "bundle commit")
    require_full_oid(bundle_tree, "bundle tree")
    require(
        git(frontend, "rev-parse", f"{bundle_commit}^{{commit}}") == bundle_commit,
        "bundle commit does not resolve exactly",
    )
    require(
        git(frontend, "rev-parse", f"{bundle_commit}^{{tree}}") == bundle_tree,
        "bundle tree pin mismatch",
    )
    require(
        git(frontend, "rev-parse", f"{bundle_commit}^") == PHASE_A_COMMIT,
        "Phase B is not a direct child of Phase A",
    )
    require(
        not git(
            frontend,
            "ls-tree",
            "-r",
            "--name-only",
            bundle_commit,
            "--",
            PROMOTION_REL.as_posix(),
        ),
        "Phase B already contains the Phase C promotion receipt",
    )

    changes = git(
        frontend, "diff", "--name-status", PHASE_A_COMMIT, bundle_commit
    ).splitlines()
    observed: set[str] = set()
    for line in changes:
        columns = line.split("\t")
        require(
            len(columns) == 2 and columns[0] == "A",
            f"Phase B carrier is not append-only: {line}",
        )
        observed.add(columns[1])
    require(observed == BUNDLE_REPOSITORY_PATHS, "Phase B carrier closed-set diff mismatch")

    root = frontend / SUCCESSOR_REL
    actual = {
        path.relative_to(root).as_posix()
        for path in root.rglob("*")
        if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc"
    }
    require(actual == set(BUNDLE_FILES), "Phase B successor inventory drift")

    committed: dict[str, bytes] = {}
    for relative in BUNDLE_FILES:
        repository_path = str(SUCCESSOR_REL / relative)
        raw = git_bytes(frontend, "show", f"{bundle_commit}:{repository_path}")
        committed[relative] = raw
        require(
            (root / relative).read_bytes() == raw,
            f"working tree differs from immutable Phase B blob: {repository_path}",
        )

    manifest_raw = committed[MANIFEST_OUTPUT.as_posix()]
    manifest = json.loads(manifest_raw)
    require(isinstance(manifest, dict), "Phase B manifest object required")
    verify_seal(manifest, "Phase B manifest")
    require(manifest.get("state") == "BUNDLE_SEALED_PENDING_PROMOTION_RECEIPT", "Phase B manifest state drift")
    require(manifest.get("promotionReceiptCount") == 0, "Phase B manifest already counts a promotion")
    require(manifest.get("activeTokenClosedSetAfterPromotion") == [TOKEN_ID], "Phase B future active-token closed set drift")
    require(manifest.get("artifactCount") == 4, "Phase B artifact count drift")
    require(manifest.get("toolCount") == len(TOOL_FILES), "Phase B tool count drift")

    artifact_pins = {
        row.get("path"): row for row in manifest.get("artifacts", [])
    }
    tool_pins = {row.get("path"): row for row in manifest.get("toolPins", [])}
    require(
        set(artifact_pins)
        == {str(SUCCESSOR_REL / relative) for relative in ARTIFACT_FILES},
        "Phase B manifest artifact closed set drift",
    )
    require(
        set(tool_pins)
        == {str(SUCCESSOR_REL / relative) for relative in TOOL_FILES},
        "Phase B manifest tool closed set drift",
    )
    for relative in ARTIFACT_FILES + TOOL_FILES:
        repository_path = str(SUCCESSOR_REL / relative)
        pin = (artifact_pins | tool_pins)[repository_path]
        raw = committed[relative]
        require(pin == {
            "path": repository_path,
            "bytes": len(raw),
            "sha256": sha256_bytes(raw),
        }, f"Phase B manifest pin drift: {repository_path}")

    lease_raw = committed[LEASE_OUTPUT.as_posix()]
    token_raw = committed[TOKEN_OUTPUT.as_posix()]
    state_raw = committed[STATE_OUTPUT.as_posix()]
    lease = json.loads(lease_raw)
    token = json.loads(token_raw)
    state = json.loads(state_raw)
    for label, value in (("lease", lease), ("token", token), ("state", state)):
        require(isinstance(value, dict), f"Phase B {label} object required")
        verify_seal(value, f"Phase B {label}")

    rows, register_raw = load_register(root / REGISTER_OUTPUT)
    require(register_raw == committed[REGISTER_OUTPUT.as_posix()], "Phase B register blob drift")
    require(token.get("worktreeBindings") == rows, "Phase B token/register binding drift")
    require(token.get("state") == "ISSUED_PENDING_PROMOTION_RECEIPT", "Phase B token state drift")
    require(token.get("activationReceiptId") == PROMOTION_ID, "Phase B token promotion ID drift")
    require(token.get("authority", {}).get("currentlyEffective") is False, "Phase B token is already effective")
    require(token.get("authority", {}).get("effectiveAfterPromotionOnly") is True, "Phase B token promotion gate drift")
    require(state.get("currentActiveTokenClosedSet") == [], "Phase B already has an active token")
    require(state.get("activeTokenClosedSetAfterPromotion") == [TOKEN_ID], "Phase B state future active-token closed set drift")
    require(state.get("authority", {}).get("promotionReceiptIssued") is False, "Phase B state already records promotion")
    require(lease.get("ownerTokenId") == TOKEN_ID, "Phase B lease owner drift")
    require(lease.get("version") == "V17", "Phase B lease version drift")
    require(lease.get("exactRelativePath") == V17_PATH, "Phase B lease path drift")
    require(lease.get("effectiveAfterPromotionOnly") is True, "Phase B lease promotion gate drift")
    require(lease.get("expiresAt") == EXPIRES_AT, "Phase B lease expiry drift")
    obligations = token.get("controlObligations", {})
    require(len(obligations.get("preStart", [])) == 2, "Phase B prestart obligation count drift")
    require(len(obligations.get("afterPushedModuleResult", [])) == 5, "Phase B post-result obligation count drift")

    return {
        "manifest": manifest,
        "manifestRaw": manifest_raw,
        "lease": lease,
        "leaseRaw": lease_raw,
        "token": token,
        "tokenRaw": token_raw,
        "state": state,
        "stateRaw": state_raw,
        "registerRows": rows,
        "registerRaw": register_raw,
    }


def validate_promotion_prepare_boundary(
    frontend: Path,
    bundle_commit: str,
    bundle_tree: str,
) -> dict[str, Any]:
    require(git(frontend, "branch", "--show-current") == "dwp-dev", "frontend branch is not dwp-dev")
    require_configured_upstream(configured_upstream(frontend), "origin/dwp-dev", "frontend")
    require(git(frontend, "rev-parse", "HEAD") == bundle_commit, "promotion must start at the exact Phase B HEAD")
    require(git(frontend, "rev-parse", "origin/dwp-dev") == bundle_commit, "Phase B is not pushed to origin/dwp-dev")
    require(
        git(frontend, "rev-list", "--left-right", "--count", "HEAD...@{upstream}").split()
        == ["0", "0"],
        "Phase B is not exactly 0/0 with configured upstream",
    )
    require(not git(frontend, "status", "--porcelain=v1", "--untracked-files=all"), "Phase B checkout must be clean before promotion")
    require(not (frontend / PROMOTION_REL).exists(), "promotion receipt already exists before Phase C")
    return validate_bundle_commit_objects(frontend, bundle_commit, bundle_tree)


def validate_promotion_carrier_boundary(
    frontend: Path,
    bundle_commit: str,
    bundle_tree: str,
) -> dict[str, Any]:
    require(git(frontend, "branch", "--show-current") == "dwp-dev", "frontend branch is not dwp-dev")
    require_configured_upstream(configured_upstream(frontend), "origin/dwp-dev", "frontend")
    head = git(frontend, "rev-parse", "HEAD")
    require(head != bundle_commit, "Phase C validation requires a later carrier commit")
    require(git(frontend, "rev-parse", "HEAD^") == bundle_commit, "Phase C is not a direct child of Phase B")
    require(git(frontend, "rev-parse", "origin/dwp-dev") == head, "Phase C is not pushed to origin/dwp-dev")
    require(
        git(frontend, "rev-list", "--left-right", "--count", "HEAD...@{upstream}").split()
        == ["0", "0"],
        "Phase C is not exactly 0/0 with configured upstream",
    )
    require(not git(frontend, "status", "--porcelain=v1", "--untracked-files=all"), "Phase C checkout is dirty")
    require((frontend / PROMOTION_REL).is_file(), "Phase C promotion receipt is missing")
    require(
        git(frontend, "diff", "--name-status", bundle_commit, head)
        == f"A\t{PROMOTION_REL.as_posix()}",
        "Phase C diff is not the exact single added promotion receipt",
    )
    context = validate_bundle_commit_objects(frontend, bundle_commit, bundle_tree)
    committed_receipt = git_bytes(frontend, "show", f"{head}:{PROMOTION_REL.as_posix()}")
    require(
        committed_receipt == (frontend / PROMOTION_REL).read_bytes(),
        "Phase C committed receipt differs from working tree",
    )
    return context


def build_promotion_receipt(
    frontend: Path,
    bundle_commit: str,
    bundle_tree: str,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build only the receipt bytes that become effective in Phase C."""

    require_full_oid(bundle_commit, "bundle commit")
    require_full_oid(bundle_tree, "bundle tree")
    root = frontend / SUCCESSOR_REL
    if context is None:
        manifest_raw = (root / MANIFEST_OUTPUT).read_bytes()
        lease_raw = (root / LEASE_OUTPUT).read_bytes()
        token_raw = (root / TOKEN_OUTPUT).read_bytes()
        state_raw = (root / STATE_OUTPUT).read_bytes()
        token = load_json(root / TOKEN_OUTPUT)
        lease = load_json(root / LEASE_OUTPUT)
        state = load_json(root / STATE_OUTPUT)
        rows, _register_raw = load_register(root / REGISTER_OUTPUT)
    else:
        manifest_raw = context["manifestRaw"]
        lease_raw = context["leaseRaw"]
        token_raw = context["tokenRaw"]
        state_raw = context["stateRaw"]
        token = context["token"]
        lease = context["lease"]
        state = context["state"]
        rows = context["registerRows"]

    return sealed({
        "schema": "dwp.hris.wave3-mod-per-compplan-promotion-receipt.v1",
        "receiptId": PROMOTION_ID,
        "issuedAt": ISSUED_AT,
        "issuedBy": "SYS_COMMON_INTEGRATION_CONTROL",
        "status": "PASS_SCOPED_DELEGATION",
        "decision": "MOD_PER_COMPPLAN_DOMAIN_AUTHORING_AUTHORIZED",
        "predecessor": {
            "phaseACarrier": token["predecessorAuthority"]["phaseACarrier"],
            "phaseAManifest": token["predecessorAuthority"]["phaseAManifest"],
            "activationState": {
                "path": str(SUCCESSOR_REL / STATE_OUTPUT),
                "bytes": len(state_raw),
                "sha256": sha256_bytes(state_raw),
                "sealedPayloadSha256": state["sealedPayloadSha256"],
            },
        },
        "bundleCommit": {
            "commit": bundle_commit,
            "tree": bundle_tree,
            "manifestPath": str(SUCCESSOR_REL / MANIFEST_OUTPUT),
            "manifestSha256": sha256_bytes(manifest_raw),
            "selfReferenceRule": PROMOTION_SELF_REFERENCE_RULE,
        },
        "delegation": {
            "module": "PER",
            "moduleId": MODULE_ID,
            "sliceId": MODULE_ID,
            "sessionId": "HRIS-PER",
            "packetId": PACKET_ID,
            "packetPath": token["packetPath"],
            "packetSha256": token["packetFileSha256"],
            "packetSealedPayloadSha256": token["dependencyBinding"]["packetSealedPayloadSha256"],
            "tokenId": TOKEN_ID,
            "tokenPath": str(SUCCESSOR_REL / TOKEN_OUTPUT),
            "tokenSha256": sha256_bytes(token_raw),
            "tokenSealedPayloadSha256": token["sealedPayloadSha256"],
            "migrationAuthorityMode": "ADMITTED_EXACT_LEASE",
            "migrationLeaseId": LEASE_ID,
            "migrationLeasePath": str(SUCCESSOR_REL / LEASE_OUTPUT),
            "migrationLeaseSha256": sha256_bytes(lease_raw),
            "migrationLeaseSealedPayloadSha256": lease["sealedPayloadSha256"],
            "migrationExactRelativePath": V17_PATH,
            "worktrees": rows,
            "effectivePacketState": "PACKET_AUTHORIZED_DOMAIN_AUTHORING",
            "authority": "DOMAIN_AUTHORING_ONLY",
            "controlObligations": deepcopy(token["controlObligations"]),
        },
        "activeTokenClosedSet": [TOKEN_ID],
        "authority": {
            "moduleParallelDevelopmentAuthorized": True,
            "authorizedModules": ["PER"],
            "authorizedSlices": [MODULE_ID],
            "startTokensIssued": [TOKEN_ID],
            "migrationAdmissionAuthorized": [LEASE_ID],
            "sharedControlPathChangeAuthorizedForModule": False,
            "integrationMergeAuthorized": False,
            "payConsumptionAuthorized": False,
            "customerDataAuthorized": False,
            "customerActivationAuthorized": False,
            "productionReleaseAuthorized": False,
        },
    })


def validate_live_promotion_inputs(
    frontend: Path,
    backend: Path,
    agent: Path,
    worktree_root: Path,
    context: dict[str, Any],
) -> None:
    validate_repository_pin(backend, BACKEND_COMMIT, BACKEND_TREE, "backend control pin")
    validate_repository_pin(
        agent,
        AGENT_COMMIT,
        AGENT_TREE,
        "agent pin",
        expected_upstream="origin/dwp-dev",
    )
    performance_versions(backend)
    docs = validate_phase_a_inputs(frontend, backend)
    rows = [inspect_worktree(worktree_root, repo) for repo in ("frontend", "backend")]
    require(rows == context["registerRows"], "live module worktrees drifted from Phase B register")
    performance_versions(worktree_root / "backend")
    obligations = context["token"]["controlObligations"]
    requests = docs["controlRequests"]["requests"]
    require(
        obligations["preStart"]
        == [row for row in requests if row["phase"] == "PRE_START"],
        "promotion prestart obligations drifted from Phase A",
    )
    require(
        obligations["afterPushedModuleResult"]
        == [row for row in requests if row["phase"] == "AFTER_PUSHED_MODULE_RESULT"],
        "promotion post-result obligations drifted from Phase A",
    )


def write_promotion_receipt(
    frontend: Path,
    payload: bytes,
    *,
    check_only: bool,
) -> None:
    path = frontend / PROMOTION_REL
    if check_only:
        require(path.is_file(), "Phase C promotion receipt is missing")
        require(path.read_bytes() == payload, "Phase C promotion receipt drift")
        return
    require(not path.exists(), "promotion receipt already exists; append-only boundary violated")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def validate_inventory(frontend: Path, expect_outputs: bool) -> None:
    root = frontend / SUCCESSOR_REL
    actual = {
        path.relative_to(root).as_posix()
        for path in root.rglob("*")
        if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc"
    }
    expected = set(TOOL_FILES)
    if expect_outputs:
        expected |= set(ARTIFACT_FILES) | {MANIFEST_OUTPUT.as_posix()}
    unexpected = sorted(actual - expected)
    missing = sorted(expected - actual)
    require(not unexpected and not missing, f"Phase B inventory mismatch; missing={missing}, unexpected={unexpected}")
    require(not (frontend / PROMOTION_REL).exists(), "Phase C promotion receipt is forbidden in Phase B")


def write_outputs(frontend: Path, outputs: dict[Path, bytes]) -> None:
    root = frontend / SUCCESSOR_REL
    for relative, payload in outputs.items():
        path = root / relative
        if path.exists():
            require(path.is_file() and path.read_bytes() == payload, f"append-only drift: {path}")
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)


def check_outputs(frontend: Path, outputs: dict[Path, bytes]) -> None:
    root = frontend / SUCCESSOR_REL
    failures = []
    for relative, payload in outputs.items():
        path = root / relative
        if not path.is_file():
            failures.append(f"missing {relative}")
        elif path.read_bytes() != payload:
            failures.append(f"drift {relative}")
    require(not failures, "Phase B generated artifact check failed: " + "; ".join(failures))


def main() -> int:
    parser = argparse.ArgumentParser(description="Materialize Wave3 MOD-PER-COMPPLAN Phase B/C")
    parser.add_argument(
        "mode",
        choices=("prepare", "check", "prepare-promotion", "check-promotion"),
    )
    parser.add_argument("--frontend-root", type=Path, default=DEFAULT_FRONTEND)
    parser.add_argument("--backend-root", type=Path, default=DEFAULT_BACKEND)
    parser.add_argument("--agent-root", type=Path, default=DEFAULT_AGENT)
    parser.add_argument("--worktree-root", type=Path, default=DEFAULT_WORKTREE_ROOT)
    parser.add_argument("--bundle-commit")
    parser.add_argument("--bundle-tree")
    args = parser.parse_args()
    frontend = args.frontend_root.resolve()
    backend = args.backend_root.resolve()
    agent = args.agent_root.resolve()
    worktree_root = args.worktree_root.resolve()
    if args.mode in {"prepare", "check"}:
        require(
            args.bundle_commit is None and args.bundle_tree is None,
            "bundle commit/tree arguments are reserved for promotion modes",
        )
        validate_inventory(frontend, expect_outputs=args.mode == "check")
        outputs = build_all(frontend, backend, agent, worktree_root)
        if args.mode == "prepare":
            write_outputs(frontend, outputs)
            validate_inventory(frontend, expect_outputs=True)
            print("WAVE3_MOD_PER_COMPPLAN_PHASE_B_PREPARED artifacts=5 token=1 worktrees=2 promotion=0")
        else:
            check_outputs(frontend, outputs)
            print("WAVE3_MOD_PER_COMPPLAN_PHASE_B_GENERATED_CHECK_PASS artifacts=5 token=1 worktrees=2 promotion=0")
        return 0

    require(args.bundle_commit is not None, "promotion modes require --bundle-commit")
    require(args.bundle_tree is not None, "promotion modes require --bundle-tree")
    if args.mode == "prepare-promotion":
        context = validate_promotion_prepare_boundary(
            frontend, args.bundle_commit, args.bundle_tree
        )
    else:
        context = validate_promotion_carrier_boundary(
            frontend, args.bundle_commit, args.bundle_tree
        )
    validate_live_promotion_inputs(frontend, backend, agent, worktree_root, context)
    receipt = build_promotion_receipt(
        frontend, args.bundle_commit, args.bundle_tree, context
    )
    write_promotion_receipt(
        frontend,
        json_bytes(receipt),
        check_only=args.mode == "check-promotion",
    )
    if args.mode == "prepare-promotion":
        print("WAVE3_MOD_PER_COMPPLAN_PHASE_C_RECEIPT_PREPARED files=1 activeTokens=1")
    else:
        print("WAVE3_MOD_PER_COMPPLAN_PHASE_C_GENERATED_CHECK_PASS files=1 activeTokens=1")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (PhaseBBlocked, subprocess.CalledProcessError, OSError, ValueError, KeyError, ET.ParseError) as exc:
        raise SystemExit(f"WAVE3_MOD_PER_COMPPLAN_ACTIVATION_BLOCKED: {exc}") from exc
