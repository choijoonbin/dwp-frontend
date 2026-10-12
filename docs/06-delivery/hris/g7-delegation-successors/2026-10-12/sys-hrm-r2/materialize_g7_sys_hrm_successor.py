#!/usr/bin/env python3
"""Materialize the append-only SYS/HRM G7 R2 delegation successor.

The predecessor G7 v1 bundle remains immutable.  This tool refuses to emit an
R2 bundle until the Control completion receipt, both central repositories, and
all four exact SYS/HRM worktrees are clean, pushed, and mutually pinned.

The process deliberately has two commits:

* ``bundle`` creates the sealed SYS lease/HRM consumed-pin delta, worktree
  register, tokens, state, and manifest.  Those files are carried by commit A.
* ``promotion`` creates the receipt that pins commit A and is carried by a
  later commit B.  This avoids a receipt/commit self-reference cycle.

No application test or historical G7 validator is executed by this tool.
"""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import io
import json
import re
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable


HERE = Path(__file__).resolve().parent
DEFAULT_FRONTEND = HERE.parents[5]
DEFAULT_BACKEND = DEFAULT_FRONTEND.parent / "backend"
DEFAULT_WORKTREE_ROOT = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/g7-20261012-r2"
)
HRIS_REL = Path("docs/06-delivery/hris")
PREDECESSOR_ROOT_REL = HRIS_REL / "g7-delegation/2026-10-12"
SUCCESSOR_ROOT_REL = (
    HRIS_REL / "g7-delegation-successors/2026-10-12/sys-hrm-r2"
)
PROMOTION_RECEIPT_REL = (
    HRIS_REL / "2026-10-12-g7-sys-hrm-promotion-receipt.v2.json"
)
CONTROL_RECEIPT_REL = SUCCESSOR_ROOT_REL / "control-bootstrap-completion.v2.json"

EMPTY_SHA256 = hashlib.sha256(b"").hexdigest()
ACTIVATION_RECEIPT_ID = "HRIS-G7-SYS-HRM-PROMOTION-20261012-R2"
CONTROL_RECEIPT_ID = "HRIS-G7-SYS-HRM-CONTROL-BOOTSTRAP-20261012-R2"

CENTRAL_REPOSITORIES = {
    "frontend": {
        "branch": "codex/hris-g1-integration-frontend-20261006",
        "upstream": "origin/codex/hris-g1-integration-frontend-20261006",
    },
    "backend": {
        "branch": "codex/hris-g1-integration-backend-20261006",
        "upstream": "origin/codex/hris-g1-integration-backend-20261006",
    },
}

PREDECESSOR_PINS = {
    "manifest": {
        "path": str(PREDECESSOR_ROOT_REL / "manifest.v1.json"),
        "sha256": "711cd8e282ed70be7fc8471adde26e96602ab697abf7b8eba568db568f220c07",
    },
    "promotionReceipt": {
        "path": str(
            HRIS_REL / "2026-10-12-g7-evidence-promotion-and-delegation-receipt.json"
        ),
        "sha256": "80bc8a7da69e3bb3fc733be28a02d8db4f5c2f5652bc3fb80659ae37437bf93b",
    },
    "migrationLeaseRegister": {
        "path": str(PREDECESSOR_ROOT_REL / "migration-leases.v1.json"),
        "sha256": "4df1f5375fd82549ee022f935184044074d7306b848d97238033296a83ab54b5",
    },
}

CLOSED_PREDECESSOR_TOKENS = [
    {
        "tokenId": "G7-START-PER-BASE-TFR-PER-006-R1",
        "state": "RESULT_INTEGRATED_CLOSED",
    },
    {
        "tokenId": "G7-START-TIM-BASE-TFR-TIM-006-R1",
        "state": "RESULT_INTEGRATED_CLOSED",
    },
]

ACTIVE_TOKEN_CLOSED_SET = [
    "G7-START-SYS-BASE-TFR-SYS-007-R2",
    "G7-START-HRM-BASE-TFR-HRM-010-R2",
]

CONTROL_REQUESTS = [
    "G7-CR-SYS-007-AUTH-PEP-R1",
    "G7-CR-SYS-007-CONTRACT-GATEWAY-R1",
    "G7-CR-SYS-007-SHELL-ROUTE-R1",
    "G7-CR-SYS-007-SECURITY-BRIDGE-R1",
    "G7-CR-HRM-010-EVENT-CONTRACT-R1",
    "G7-CR-HRM-010-AUTH-PEP-R1",
    "G7-CR-HRM-010-CONTRACT-GATEWAY-R1",
    "G7-CR-HRM-010-SHELL-ROUTE-R1",
    "G7-CR-HRM-010-APPROVAL-CALLBACK-R1",
    "G7-CR-HRM-010-APPROVAL-CASE-HANDOFF-R1",
]

MODULES: dict[str, dict[str, Any]] = {
    "SYS": {
        "sliceId": "BASE-TFR-SYS-007",
        "sessionId": "HRIS-SYS",
        "packetId": "G7-PACKET-SYS-BASE-TFR-SYS-007-R1",
        "packetPath": str(PREDECESSOR_ROOT_REL / "packets/sys-007.v1.json"),
        "packetSha256": "13c9e32ddd24b20805060e9b1e1ebdf1549d0619fc7c9b32f4543e72556bfd4e",
        "pathPolicySha256": "c8b56ea099ba546c434fc8d3f6bf2fe8a84f5bddc37d76dd2b372ac3c3fdda74",
        "dependencyPinsSha256": "9630aa6033139fb3982cc30fdb8294a7e7a7669531dbbb41130265972a04c233",
        "tokenId": "G7-START-SYS-BASE-TFR-SYS-007-R2",
        "tokenRelativePath": "tokens/sys-007.start-token.v2.json",
        "predecessorLeaseId": "G7-LEASE-SYS-PLATFORM-V325-R1",
        "predecessorLeaseDigestSha256": "f79ea16e8fa389bc44eec07e975a9351b44d5df6d30434bfec85ce6aa5206cc8",
        "migrationAuthorityMode": "ADMITTED_EXACT_LEASE",
        "leaseId": "G7-LEASE-SYS-PLATFORM-V325-R2",
        "stream": "PLATFORM_MAIN",
        "streamRoot": "dwp-platform-server/src/main/resources/db/migration",
        "frozenHighWater": 324,
        "version": 325,
        "migrationFilename": "V325__create_hris_reference_configuration_lifecycle.sql",
        "migrationPath": "dwp-platform-server/src/main/resources/db/migration/V325__create_hris_reference_configuration_lifecycle.sql",
        "schemaEffect": [
            "reference configuration lifecycle set and version records",
            "evaluation evidence and immutable command receipts",
            "outbox and audit controls; no duplicate raw reference-data store",
        ],
        "allowedPaths": [
            "backend:dwp-platform-server/src/main/java/com/dwp/services/platform/hrisconfiguration/referenceconfiguration/**",
            "backend:dwp-platform-server/src/test/java/com/dwp/services/platform/hrisconfiguration/referenceconfiguration/**",
            "frontend:apps/dwp/src/features/hris/administration/reference-configuration/**",
        ],
        "protectedPaths": [
            "backend:dwp-platform-server/src/main/java/com/dwp/services/platform/hrisconfiguration/HrisConfigurationProjectionController.java",
            "backend:dwp-platform-server/src/main/java/com/dwp/services/platform/hrisconfiguration/HrisConfigurationProjectionDtos.java",
            "backend:dwp-platform-server/src/main/java/com/dwp/services/platform/hrisconfiguration/HrisConfigurationProjectionService.java",
            "backend:dwp-platform-server/src/test/java/com/dwp/services/platform/hrisconfiguration/HrisConfigurationProjectionControllerContractTest.java",
            "backend:dwp-platform-server/src/test/java/com/dwp/services/platform/hrisconfiguration/HrisConfigurationProjectionServiceTest.java",
            "backend:dwp-platform-server/src/main/java/com/dwp/services/platform/reference/**",
            "backend:dwp-people-server/src/main/java/com/dwp/services/people/workforce/WorkforceReference*",
            "frontend:apps/dwp/src/features/workforce/workforce-reference-data.tsx",
            "frontend:apps/dwp/src/features/admin/reference-data-*.ts*",
            "frontend:apps/dwp/src/features/hris/administration/system-access/**",
        ],
        "requestIds": CONTROL_REQUESTS[:4],
        "worktreeSlug": "sys-007",
    },
    "HRM": {
        "sliceId": "BASE-TFR-HRM-010",
        "sessionId": "HRIS-HRM",
        "packetId": "G7-PACKET-HRM-BASE-TFR-HRM-010-R1",
        "packetPath": str(PREDECESSOR_ROOT_REL / "packets/hrm-010.v1.json"),
        "packetSha256": "95c151eb2b277518d31cc9733175c7f2e05fc0c73da37fa9f861d58eef9b8a65",
        "pathPolicySha256": "1b9eef240654dcb21663615bbcf57a1285feaec6d47128be55d8a5b1173a2380",
        "dependencyPinsSha256": "c985183adb748fca02559695cf293fd4da96602099523da3d871d115612ecfb9",
        "tokenId": "G7-START-HRM-BASE-TFR-HRM-010-R2",
        "tokenRelativePath": "tokens/hrm-010.start-token.v2.json",
        "predecessorLeaseId": "G7-LEASE-HRM-PEOPLE-V54-R1",
        "predecessorLeaseDigestSha256": "f4a459ab472198008decb1f1e2d43b4108f2eb6f6e3e716113100a2a24cc0add",
        "migrationAuthorityMode": "CONTROL_BOOTSTRAP_READ_ONLY_PIN",
        "stream": "PEOPLE_MAIN",
        "streamRoot": "dwp-people-server/src/main/resources/db/migration",
        "frozenHighWater": 54,
        "version": 54,
        "migrationFilename": "V54__create_employee_change_request_lifecycle.sql",
        "migrationPath": "dwp-people-server/src/main/resources/db/migration/V54__create_employee_change_request_lifecycle.sql",
        "schemaEffect": [
            "employee-change request and frozen patch evidence",
            "approval decision inbox and immutable command receipts",
            "transactional outbox; no assignment-proposal table changes",
        ],
        "allowedPaths": [
            "backend:dwp-people-server/src/main/java/com/dwp/services/people/hris/employeeservice/employeechange/**",
            "backend:dwp-people-server/src/test/java/com/dwp/services/people/hris/employeeservice/employeechange/**",
            "frontend:apps/dwp/src/features/hris/employee-services/employee-change/**",
        ],
        "protectedPaths": [
            "backend:dwp-people-server/src/main/java/com/dwp/services/people/hr/assignment/**",
            "backend:dwp-people-server/src/main/resources/db/migration/V53__create_assignment_change_proposals.sql",
            "backend:dwp-people-server/src/main/java/com/dwp/services/people/hris/people/**",
            "frontend:apps/dwp/src/features/hris/employment/assignment-proposal-*.ts*",
            "frontend:libs/shared-utils/src/api/assignment-proposal-api.ts",
            "frontend:apps/dwp/src/features/hris/people/**",
            "backend:dwp-people-server/src/main/java/com/dwp/services/people/security/PeopleSecurityFilter.java",
            "backend:dwp-people-server/src/test/java/com/dwp/services/people/security/PeopleSecurityFilterTest.java",
        ],
        "additionalProtectedPaths": [
            "backend:dwp-people-server/src/main/resources/db/migration/V54__create_employee_change_request_lifecycle.sql",
        ],
        "requestIds": CONTROL_REQUESTS[4:],
        "worktreeSlug": "hrm-010",
    },
}

TOOL_RELATIVE_PATHS = [
    "contracts/g7-control-bootstrap-completion.schema.v2.json",
    "contracts/g7-start-token.schema.v2.json",
    "contracts/g7-migration-lease-delta.schema.v2.json",
    "contracts/g7-successor-state.schema.v2.json",
    "contracts/g7-successor-manifest.schema.v2.json",
    "contracts/g7-promotion-receipt.schema.v2.json",
    "materialize_g7_sys_hrm_successor.py",
    "validate_g7_sys_hrm_successor.py",
    "test_g7_sys_hrm_successor.py",
]

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

AUTHORITY_CARRIER_PATHS = {
    str(CONTROL_RECEIPT_REL),
    str(SUCCESSOR_ROOT_REL / "migration-leases.delta.v2.json"),
    str(SUCCESSOR_ROOT_REL / "registers/module-worktrees.active.v2.csv"),
    str(SUCCESSOR_ROOT_REL / MODULES["SYS"]["tokenRelativePath"]),
    str(SUCCESSOR_ROOT_REL / MODULES["HRM"]["tokenRelativePath"]),
    str(SUCCESSOR_ROOT_REL / "state/delegation-after-sys-hrm-promotion.v2.json"),
    str(SUCCESSOR_ROOT_REL / "manifest.v2.json"),
    str(PROMOTION_RECEIPT_REL),
}


class PrerequisiteError(RuntimeError):
    """Raised before any authority artifact is written."""


def sha256_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def sealed(value: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(value)
    result.pop("sealedPayloadSha256", None)
    result["sealedPayloadSha256"] = sha256_bytes(canonical_bytes(result))
    return result


def verify_seal(value: dict[str, Any], label: str) -> None:
    body = copy.deepcopy(value)
    actual = body.pop("sealedPayloadSha256", None)
    expected = sha256_bytes(canonical_bytes(body))
    if actual != expected:
        raise PrerequisiteError(
            f"{label} seal mismatch: expected {expected}, found {actual}"
        )


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise PrerequisiteError(f"required file is absent: {path}") from exc
    except (OSError, json.JSONDecodeError) as exc:
        raise PrerequisiteError(f"cannot read JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise PrerequisiteError(f"JSON root must be an object: {path}")
    return value


def parse_instant(value: Any, label: str) -> datetime:
    if not isinstance(value, str):
        raise PrerequisiteError(f"{label} must be an ISO-8601 string")
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise PrerequisiteError(f"{label} is not a valid ISO-8601 instant") from exc
    if result.tzinfo is None:
        raise PrerequisiteError(f"{label} must include an offset")
    return result


def run_git(root: Path, *args: str, raw: bool = False) -> Any:
    process = subprocess.run(
        ["git", *args],
        cwd=root,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if process.returncode != 0:
        detail = process.stderr.decode("utf-8", errors="replace").strip()
        raise PrerequisiteError(
            f"git {' '.join(args)} failed in {root}: {detail or process.returncode}"
        )
    return process.stdout if raw else process.stdout.decode("utf-8").strip()


def inspect_repository(
    root: Path, expected_branch: str, expected_upstream: str
) -> dict[str, Any]:
    if not root.is_dir():
        raise PrerequisiteError(f"repository/worktree is absent: {root}")
    inside = run_git(root, "rev-parse", "--is-inside-work-tree")
    if inside != "true":
        raise PrerequisiteError(f"not a Git worktree: {root}")
    branch = run_git(root, "branch", "--show-current")
    upstream = run_git(root, "rev-parse", "--abbrev-ref", "@{upstream}")
    if branch != expected_branch:
        raise PrerequisiteError(
            f"branch mismatch for {root}: expected {expected_branch}, found {branch}"
        )
    if upstream != expected_upstream:
        raise PrerequisiteError(
            f"upstream mismatch for {root}: expected {expected_upstream}, found {upstream}"
        )
    head = run_git(root, "rev-parse", "HEAD^{commit}")
    tree = run_git(root, "rev-parse", "HEAD^{tree}")
    upstream_head = run_git(root, "rev-parse", "@{upstream}^{commit}")
    status = run_git(
        root,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        raw=True,
    )
    counts = run_git(root, "rev-list", "--left-right", "--count", "HEAD...@{upstream}")
    try:
        ahead, behind = counts.split()
    except ValueError as exc:
        raise PrerequisiteError(f"unexpected ahead/behind output for {root}: {counts}") from exc
    if status:
        raise PrerequisiteError(f"worktree is not clean: {root}")
    if head != upstream_head or ahead != "0" or behind != "0":
        raise PrerequisiteError(
            f"worktree is not exactly pushed: {root} (ahead={ahead}, behind={behind})"
        )
    return {
        "commit": head,
        "tree": tree,
        "stateSha256": sha256_bytes(status),
        "branch": branch,
        "upstream": upstream,
        "clean": True,
        "upstreamMatched": True,
    }


def validate_predecessors(frontend: Path) -> dict[str, dict[str, Any]]:
    for label, pin in PREDECESSOR_PINS.items():
        path = frontend / pin["path"]
        if not path.is_file():
            raise PrerequisiteError(f"predecessor {label} is absent: {path}")
        actual = sha256_bytes(path.read_bytes())
        if actual != pin["sha256"]:
            raise PrerequisiteError(
                f"predecessor {label} changed: expected {pin['sha256']}, found {actual}"
            )

    packets: dict[str, dict[str, Any]] = {}
    for module, spec in MODULES.items():
        packet_path = frontend / spec["packetPath"]
        raw = packet_path.read_bytes()
        actual = sha256_bytes(raw)
        if actual != spec["packetSha256"]:
            raise PrerequisiteError(
                f"{module} predecessor packet changed: expected {spec['packetSha256']}, found {actual}"
            )
        packet = read_json(packet_path)
        verify_seal(packet, f"{module} predecessor packet")
        checks = {
            "packetId": spec["packetId"],
            "module": module,
            "lifecycleState": "PACKET_PREPARED_START_WITHHELD",
            "startTokenId": None,
            "pathPolicySha256": spec["pathPolicySha256"],
            "dependencyPinsSha256": spec["dependencyPinsSha256"],
        }
        for key, expected in checks.items():
            if packet.get(key) != expected:
                raise PrerequisiteError(
                    f"{module} predecessor {key} mismatch: {packet.get(key)!r}"
                )
        path_policy = packet.get("pathPolicy", {})
        if path_policy.get("allowedPaths") != spec["allowedPaths"]:
            raise PrerequisiteError(f"{module} allowed paths changed in predecessor")
        if path_policy.get("protectedPaths") != spec["protectedPaths"]:
            raise PrerequisiteError(f"{module} protected paths changed in predecessor")
        if packet.get("authority", {}).get("sourceChangeAuthorized") is not False:
            raise PrerequisiteError(f"{module} predecessor leaked source authority")
        lease = packet.get("migrationLease", {})
        if lease.get("leaseId") != spec["predecessorLeaseId"]:
            raise PrerequisiteError(f"{module} predecessor lease ID changed")
        if lease.get("leaseDigestSha256") != spec["predecessorLeaseDigestSha256"]:
            raise PrerequisiteError(f"{module} predecessor lease digest changed")
        if lease.get("status") != "RESERVED_CONTROL_ONLY":
            raise PrerequisiteError(f"{module} predecessor lease is no longer reserved")
        packets[module] = packet
    return packets


def validate_control_receipt(
    frontend: Path,
    live_frontend_pin: dict[str, Any],
    live_backend_pin: dict[str, Any],
    verify_frontend_carrier: bool = True,
) -> tuple[dict[str, Any], bytes]:
    path = frontend / CONTROL_RECEIPT_REL
    receipt = read_json(path)
    raw = path.read_bytes()
    verify_seal(receipt, "Control bootstrap completion receipt")
    expected_scalars = {
        "schema": "dwp.hris.g7-control-bootstrap-completion.v2",
        "receiptId": CONTROL_RECEIPT_ID,
        "status": "PASS_SYS_HRM_CONTROL_BOOTSTRAP",
        "issuedBy": "SYS_COMMON_INTEGRATION_CONTROL",
    }
    for key, expected in expected_scalars.items():
        if receipt.get(key) != expected:
            raise PrerequisiteError(
                f"Control completion {key} mismatch: expected {expected!r}"
            )
    issued_at = parse_instant(receipt.get("issuedAt"), "Control issuedAt")
    expires_at = parse_instant(receipt.get("expiresAt"), "Control expiresAt")
    if expires_at <= issued_at:
        raise PrerequisiteError("Control completion receipt is already expired by construction")
    frontend_source_pin = receipt.get("frontendPin")
    if not isinstance(frontend_source_pin, dict):
        raise PrerequisiteError("Control completion frontend pin is absent")
    if verify_frontend_carrier:
        validate_frontend_authority_carrier(
            frontend, frontend_source_pin, live_frontend_pin
        )
    if receipt.get("backendPin") != live_backend_pin:
        raise PrerequisiteError("Control completion backend pin is not the live clean repository")
    results = receipt.get("requestResults")
    if not isinstance(results, list):
        raise PrerequisiteError("Control requestResults must be an array")
    actual_ids = [row.get("requestId") for row in results if isinstance(row, dict)]
    if actual_ids != CONTROL_REQUESTS:
        raise PrerequisiteError(
            f"Control request closed set mismatch: expected {CONTROL_REQUESTS}, found {actual_ids}"
        )
    for row in results:
        request_id = row.get("requestId")
        expected_module = "SYS" if request_id in MODULES["SYS"]["requestIds"] else "HRM"
        if row.get("module") != expected_module or row.get("status") != "PASS":
            raise PrerequisiteError(f"Control request did not pass exactly: {request_id}")
        if not re.fullmatch(r"[0-9a-f]{64}", str(row.get("evidenceSha256", ""))):
            raise PrerequisiteError(f"Control request evidence hash is invalid: {request_id}")
    verification = receipt.get("verification")
    if not isinstance(verification, list) or not verification:
        raise PrerequisiteError("Control receipt has no verification evidence")
    if any(not isinstance(row, dict) or row.get("result") != "PASS" for row in verification):
        raise PrerequisiteError("Control receipt contains a non-PASS verification")
    expected_authority = {
        "controlBootstrapComplete": True,
        "moduleSourceChangeAuthorized": False,
        "sharedControlPathChangeAuthorizedForModules": False,
        "integrationMergeAuthorized": False,
        "customerDataAuthorized": False,
        "customerActivationAuthorized": False,
        "productionReleaseAuthorized": False,
    }
    if receipt.get("authority") != expected_authority:
        raise PrerequisiteError("Control completion authority is not the fail-closed shape")
    return receipt, raw


def validate_frontend_authority_carrier(
    frontend: Path,
    source_pin: dict[str, Any],
    live_pin: dict[str, Any],
) -> None:
    """Allow only append-only R2 authority files after the source-result pin.

    The Control receipt cannot include its own carrier commit.  It therefore
    pins the last source-result commit, while the clean live branch may advance
    only by adding the exact receipt/bundle/promotion authority artifacts.
    """

    expected_shape = {
        "branch": CENTRAL_REPOSITORIES["frontend"]["branch"],
        "upstream": CENTRAL_REPOSITORIES["frontend"]["upstream"],
        "clean": True,
        "upstreamMatched": True,
        "stateSha256": EMPTY_SHA256,
    }
    for key, expected in expected_shape.items():
        if source_pin.get(key) != expected:
            raise PrerequisiteError(
                f"Control frontend source pin {key} mismatch: {source_pin.get(key)!r}"
            )
    commit = source_pin.get("commit")
    tree = source_pin.get("tree")
    if not re.fullmatch(r"[0-9a-f]{40}", str(commit or "")):
        raise PrerequisiteError("Control frontend source commit is invalid")
    if not re.fullmatch(r"[0-9a-f]{40}", str(tree or "")):
        raise PrerequisiteError("Control frontend source tree is invalid")
    actual_tree = run_git(frontend, "rev-parse", f"{commit}^{{tree}}")
    if actual_tree != tree:
        raise PrerequisiteError("Control frontend source tree does not match its commit")
    run_git(frontend, "merge-base", "--is-ancestor", str(commit), "HEAD")
    changed = run_git(frontend, "diff", "--name-only", f"{commit}..HEAD").splitlines()
    unexpected = sorted(set(changed) - AUTHORITY_CARRIER_PATHS)
    if unexpected:
        raise PrerequisiteError(
            "frontend advanced past the Control source pin outside append-only R2 authority paths: "
            + ", ".join(unexpected)
        )
    if live_pin.get("branch") != source_pin.get("branch"):
        raise PrerequisiteError("frontend authority carrier moved to another branch")


def validate_migration_boundaries(
    backend: Path, backend_pin: dict[str, Any]
) -> dict[str, dict[str, Any]]:
    commit = str(backend_pin.get("commit", ""))
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise PrerequisiteError("Control backend commit pin is invalid")

    result: dict[str, dict[str, Any]] = {}
    for module, spec in MODULES.items():
        root = backend / spec["streamRoot"]
        if not root.is_dir():
            raise PrerequisiteError(f"{module} migration stream is absent: {root}")
        versions = []
        for path in root.iterdir():
            match = re.fullmatch(r"V([0-9]+)__.+\.sql", path.name)
            if match and path.is_file():
                versions.append(int(match.group(1)))
        high_water = max(versions, default=0)
        if high_water != spec["frozenHighWater"]:
            raise PrerequisiteError(
                f"{module} migration high-water changed: expected {spec['frozenHighWater']}, found {high_water}"
            )

        target = backend / spec["migrationPath"]
        if spec["migrationAuthorityMode"] == "ADMITTED_EXACT_LEASE":
            if target.exists():
                raise PrerequisiteError(f"{module} R2 migration slot is occupied: {target}")
            continue

        if not target.is_file():
            raise PrerequisiteError(
                f"{module} Control-owned migration prerequisite is absent: {target}"
            )
        committed_raw = run_git(
            backend, "show", f"{commit}:{spec['migrationPath']}", raw=True
        )
        working_raw = target.read_bytes()
        if working_raw != committed_raw:
            raise PrerequisiteError(
                f"{module} Control-owned migration bytes differ from the pinned commit"
            )
        result[module] = {
            "mode": "CONTROL_BOOTSTRAP_READ_ONLY_PIN",
            "exactRelativePath": spec["migrationPath"],
            "sha256": sha256_bytes(committed_raw),
            "frozenBackendCommit": commit,
            "state": "CONTROL_BOOTSTRAP_CONSUMED_READ_ONLY",
            "migrationEditAuthorized": False,
        }
    return result


def worktree_expectations(worktree_root: Path) -> Iterable[tuple[str, str, Path, str, str]]:
    for module, spec in MODULES.items():
        for repo in ("frontend", "backend"):
            branch = (
                f"codex/hris-g7-{spec['worktreeSlug']}-{repo}-20261012-r2"
            )
            yield (
                module,
                repo,
                worktree_root / spec["worktreeSlug"] / repo,
                branch,
                f"origin/{branch}",
            )


def inspect_worktrees(
    worktree_root: Path, central_pins: dict[str, dict[str, Any]]
) -> dict[str, list[dict[str, str]]]:
    result: dict[str, list[dict[str, str]]] = {"SYS": [], "HRM": []}
    for module, repo, path, branch, upstream in worktree_expectations(worktree_root):
        pin = inspect_repository(path, branch, upstream)
        central = central_pins[repo]
        if pin["commit"] != central["commit"] or pin["tree"] != central["tree"]:
            raise PrerequisiteError(
                f"{module} {repo} worktree does not start at the final Control pin"
            )
        spec = MODULES[module]
        result[module].append(
            {
                "module": module,
                "slice_id": spec["sliceId"],
                "token_id": spec["tokenId"],
                "repo": repo,
                "absolute_path": str(path),
                "branch": branch,
                "upstream": upstream,
                "head": pin["commit"],
                "tree": pin["tree"],
                "state_sha256": pin["stateSha256"],
                "clean": "true",
                "ahead": "0",
                "behind": "0",
                "state": "CREATED_PUSHED_CLEAN",
            }
        )
    return result


def prepare_context(
    frontend: Path, backend: Path, worktree_root: Path
) -> dict[str, Any]:
    validate_predecessors(frontend)
    live_frontend_pin = inspect_repository(
        frontend,
        CENTRAL_REPOSITORIES["frontend"]["branch"],
        CENTRAL_REPOSITORIES["frontend"]["upstream"],
    )
    live_backend_pin = inspect_repository(
        backend,
        CENTRAL_REPOSITORIES["backend"]["branch"],
        CENTRAL_REPOSITORIES["backend"]["upstream"],
    )
    control_receipt, control_raw = validate_control_receipt(
        frontend, live_frontend_pin, live_backend_pin
    )
    execution_pins = {
        "frontend": control_receipt["frontendPin"],
        "backend": control_receipt["backendPin"],
    }
    migration_prerequisites = validate_migration_boundaries(
        backend, execution_pins["backend"]
    )
    worktrees = inspect_worktrees(worktree_root, execution_pins)
    return {
        "frontend": frontend,
        "backend": backend,
        "issuedAt": control_receipt["issuedAt"],
        "expiresAt": control_receipt["expiresAt"],
        "centralPins": execution_pins,
        "controlReceipt": control_receipt,
        "controlReceiptRaw": control_raw,
        "worktrees": worktrees,
        "migrationPrerequisites": migration_prerequisites,
    }


def file_pin(path: str, raw: bytes) -> dict[str, Any]:
    return {"path": path, "bytes": len(raw), "sha256": sha256_bytes(raw)}


def effective_allowed_paths(module: str) -> list[str]:
    spec = MODULES[module]
    result = list(spec["allowedPaths"])
    if spec["migrationAuthorityMode"] == "ADMITTED_EXACT_LEASE":
        result.append(f"backend:{spec['migrationPath']}")
    return result


def effective_protected_paths(module: str) -> list[str]:
    spec = MODULES[module]
    return [*spec["protectedPaths"], *spec.get("additionalProtectedPaths", [])]


def build_lease_delta(context: dict[str, Any]) -> dict[str, Any]:
    spec = MODULES["SYS"]
    leases = [
        sealed(
            {
                "leaseId": spec["leaseId"],
                "supersedesLeaseId": spec["predecessorLeaseId"],
                "supersededLeaseDigestSha256": spec["predecessorLeaseDigestSha256"],
                "module": "SYS",
                "sliceId": spec["sliceId"],
                "stream": spec["stream"],
                "streamRoot": spec["streamRoot"],
                "frozenBackendCommit": context["centralPins"]["backend"]["commit"],
                "frozenHighWater": spec["frozenHighWater"],
                "version": spec["version"],
                "exactRelativePath": spec["migrationPath"],
                "schemaEffect": spec["schemaEffect"],
                "status": "ADMITTED_DOMAIN_AUTHORING",
                "ownerTokenId": spec["tokenId"],
                "reservedForPacketId": spec["packetId"],
                "issuedAt": context["issuedAt"],
                "expiresAt": context["expiresAt"],
                "invalidationConditions": [
                    "final Control backend commit or migration high-water changes",
                    "another migration claims the exact version or path",
                    "the R2 token expires, is revoked, or changes scope",
                ],
                "migrationAdmissionAuthorized": True,
            }
        )
    ]
    hrm_prerequisite = context["migrationPrerequisites"]["HRM"]
    return sealed(
        {
            "schema": "dwp.hris.g7-migration-lease-delta.v2",
            "issuedAt": context["issuedAt"],
            "predecessorRegister": PREDECESSOR_PINS["migrationLeaseRegister"],
            "leases": leases,
            "closedPredecessorLeases": [
                {
                    "leaseId": MODULES["SYS"]["predecessorLeaseId"],
                    "state": "SUPERSEDED_UNCONSUMED",
                    "successorLeaseId": MODULES["SYS"]["leaseId"],
                },
                {
                    "leaseId": MODULES["HRM"]["predecessorLeaseId"],
                    "state": "CONSUMED_BY_CONTROL_BOOTSTRAP",
                    "consumedByBackendCommit": hrm_prerequisite[
                        "frozenBackendCommit"
                    ],
                    "exactRelativePath": hrm_prerequisite["exactRelativePath"],
                    "migrationSha256": hrm_prerequisite["sha256"],
                    "successorLeaseId": None,
                },
            ],
            "historicalRangesAreAuthority": False,
            "openEndedVersionsAllowed": False,
        }
    )


def render_worktree_register(context: dict[str, Any]) -> bytes:
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=CSV_FIELDS, lineterminator="\n")
    writer.writeheader()
    for module in MODULES:
        for row in context["worktrees"][module]:
            writer.writerow(row)
    return stream.getvalue().encode("utf-8")


def domain_authority(module: str) -> dict[str, Any]:
    spec = MODULES[module]
    return {
        "domainAuthoringOnly": True,
        "exactWorktreesOnly": True,
        "exactAllowedPathsOnly": True,
        "migrationAuthorityMode": spec["migrationAuthorityMode"],
        "migrationEditAuthorized": spec["migrationAuthorityMode"]
        == "ADMITTED_EXACT_LEASE",
        "commitAndPushTokenBranchesAuthorized": True,
        "sharedControlPathChangeAuthorized": False,
        "integrationMergeAuthorized": False,
        "customerDataAuthorized": False,
        "customerActivationAuthorized": False,
        "productionReleaseAuthorized": False,
    }


def build_tokens(
    context: dict[str, Any], lease_delta: dict[str, Any]
) -> dict[str, dict[str, Any]]:
    leases = {row["module"]: row for row in lease_delta["leases"]}
    control_sha = sha256_bytes(context["controlReceiptRaw"])
    result = {}
    for module, spec in MODULES.items():
        payload = {
                "schema": "dwp.hris.g7-module-start-token.v2",
                "tokenId": spec["tokenId"],
                "packetId": spec["packetId"],
                "packetPath": spec["packetPath"],
                "packetFileSha256": spec["packetSha256"],
                "sliceId": spec["sliceId"],
                "module": module,
                "sessionId": spec["sessionId"],
                "issuedAt": context["issuedAt"],
                "issuedBy": "SYS_COMMON_INTEGRATION_CONTROL",
                "expiresAt": context["expiresAt"],
                "activationReceiptId": ACTIVATION_RECEIPT_ID,
                "state": "ISSUED_PENDING_PROMOTION_RECEIPT",
                "predecessorAuthority": {
                    "receiptId": "HRIS-G7-EVIDENCE-PROMOTION-DELEGATION-20261012-R1",
                    "receiptSha256": PREDECESSOR_PINS["promotionReceipt"]["sha256"],
                    "packetLifecycleState": "PACKET_PREPARED_START_WITHHELD",
                    "effectiveLifecycleStateAfterPromotion": "PACKET_AUTHORIZED_DOMAIN_AUTHORING",
                    "overriddenFields": [
                        "lifecycleState",
                        "startTokenId",
                        "basePins.frontend",
                        "basePins.backend",
                        "migrationLease",
                        "authority.sourceChangeAuthorized",
                        "authority.domainAuthoringOnly",
                        "authority.commitAndPushTokenBranchesAuthorized",
                    ],
                },
                "executionBasePins": context["centralPins"],
                "worktreeBindings": context["worktrees"][module],
                "effectiveAllowedPaths": effective_allowed_paths(module),
                "protectedPaths": effective_protected_paths(module),
                "pathPolicySha256": spec["pathPolicySha256"],
                "dependencyPinsSha256": spec["dependencyPinsSha256"],
                "controlBootstrapReceiptSha256": control_sha,
                "permittedAction": "START_DOMAIN_MODULE_IMPLEMENTATION",
                "invalidationConditions": [
                    "promotion receipt does not list this exact token in the active closed set",
                    "packet, token, Control receipt, worktree, migration authority, or execution base pin changes",
                    "worktree is dirty, unpublished, ahead/behind, or on another branch",
                    "an effective allowed-path or common-Control boundary is crossed",
                    "the pinned migration boundary changes",
                    "token expires or is revoked",
                ],
                "authority": domain_authority(module),
            }
        if spec["migrationAuthorityMode"] == "ADMITTED_EXACT_LEASE":
            payload["migrationLeaseSha256"] = leases[module]["sealedPayloadSha256"]
            payload["migrationLeaseId"] = spec["leaseId"]
        else:
            payload["controlOwnedMigrationPrerequisite"] = context[
                "migrationPrerequisites"
            ][module]
        token = sealed(payload)
        result[module] = token
    return result


def build_state(
    context: dict[str, Any], tokens: dict[str, dict[str, Any]]
) -> dict[str, Any]:
    return sealed(
        {
            "schema": "dwp.hris.g7-sys-hrm-successor-state.v2",
            "stateId": "HRIS-G7-SYS-HRM-DELEGATION-STATE-20261012-R2",
            "state": "BUNDLE_SEALED_PENDING_PROMOTION_RECEIPT",
            "issuedAt": context["issuedAt"],
            "activationReceiptId": ACTIVATION_RECEIPT_ID,
            "predecessor": {
                "manifest": PREDECESSOR_PINS["manifest"],
                "promotionReceipt": PREDECESSOR_PINS["promotionReceipt"],
            },
            "effectiveDelegations": [
                {
                    "module": module,
                    "sliceId": MODULES[module]["sliceId"],
                    "packetId": MODULES[module]["packetId"],
                    "predecessorPacketSha256": MODULES[module]["packetSha256"],
                    "effectivePacketStateAfterPromotion": "PACKET_AUTHORIZED_DOMAIN_AUTHORING",
                    "tokenId": tokens[module]["tokenId"],
                    "migrationAuthorityMode": MODULES[module][
                        "migrationAuthorityMode"
                    ],
                    "migrationAuthority": (
                        {"leaseId": MODULES[module]["leaseId"]}
                        if MODULES[module]["migrationAuthorityMode"]
                        == "ADMITTED_EXACT_LEASE"
                        else tokens[module]["controlOwnedMigrationPrerequisite"]
                    ),
                    "authority": "DOMAIN_AUTHORING_ONLY",
                }
                for module in MODULES
            ],
            "closedPredecessorTokens": CLOSED_PREDECESSOR_TOKENS,
            "activeTokenClosedSetAfterPromotion": ACTIVE_TOKEN_CLOSED_SET,
            "withheld": [
                {"module": "PAY", "state": "WITHHELD_PRODUCER_AND_NAMED_TESTS_REQUIRED"},
                {"module": "AGENT", "state": "NO_CANONICAL_SLICE_NO_PACKET"},
            ],
            "authority": {
                "moduleParallelDevelopmentAuthorizedAfterPromotion": True,
                "authorizedModulesAfterPromotion": ["SYS", "HRM"],
                "migrationAdmissionAuthorized": [MODULES["SYS"]["leaseId"]],
                "sharedControlPathChangeAuthorizedForModules": False,
                "integrationMergeAuthorized": False,
                "customerDataAuthorized": False,
                "customerActivationAuthorized": False,
                "productionReleaseAuthorized": False,
            },
        }
    )


def read_tool_pins(frontend: Path) -> list[dict[str, Any]]:
    pins = []
    for relative in TOOL_RELATIVE_PATHS:
        path = frontend / SUCCESSOR_ROOT_REL / relative
        if not path.is_file():
            raise PrerequisiteError(f"successor tool/schema is absent: {path}")
        pins.append(file_pin(str(SUCCESSOR_ROOT_REL / relative), path.read_bytes()))
    return pins


def build_bundle_bytes(
    context: dict[str, Any], tool_pins: list[dict[str, Any]]
) -> dict[Path, bytes]:
    lease_delta = build_lease_delta(context)
    register_raw = render_worktree_register(context)
    tokens = build_tokens(context, lease_delta)
    state = build_state(context, tokens)
    outputs: dict[Path, bytes] = {
        Path("migration-leases.delta.v2.json"): json_bytes(lease_delta),
        Path("registers/module-worktrees.active.v2.csv"): register_raw,
        Path(MODULES["SYS"]["tokenRelativePath"]): json_bytes(tokens["SYS"]),
        Path(MODULES["HRM"]["tokenRelativePath"]): json_bytes(tokens["HRM"]),
        Path("state/delegation-after-sys-hrm-promotion.v2.json"): json_bytes(state),
    }
    artifact_pins = [
        file_pin(str(SUCCESSOR_ROOT_REL / relative), raw)
        for relative, raw in sorted(outputs.items(), key=lambda item: str(item[0]))
    ]
    manifest = sealed(
        {
            "schema": "dwp.hris.g7-sys-hrm-successor-manifest.v2",
            "manifestId": "HRIS-G7-SYS-HRM-SUCCESSOR-MANIFEST-20261012-R2",
            "issuedAt": context["issuedAt"],
            "predecessorPins": PREDECESSOR_PINS,
            "controlBootstrapReceipt": file_pin(
                str(CONTROL_RECEIPT_REL), context["controlReceiptRaw"]
            ),
            "executionBasePins": context["centralPins"],
            "activeTokenClosedSetAfterPromotion": ACTIVE_TOKEN_CLOSED_SET,
            "artifacts": artifact_pins,
            "toolPins": tool_pins,
            "artifactCount": len(artifact_pins),
        }
    )
    outputs[Path("manifest.v2.json")] = json_bytes(manifest)
    return outputs


def build_promotion_receipt(
    context: dict[str, Any],
    bundle_outputs: dict[Path, bytes],
    bundle_commit: str,
    bundle_tree: str,
) -> dict[str, Any]:
    manifest_raw = bundle_outputs[Path("manifest.v2.json")]
    tokens = {
        module: json.loads(bundle_outputs[Path(spec["tokenRelativePath"])])
        for module, spec in MODULES.items()
    }
    lease_delta = json.loads(bundle_outputs[Path("migration-leases.delta.v2.json")])
    leases = {row["module"]: row for row in lease_delta["leases"]}
    delegations = []
    for module, spec in MODULES.items():
        row = {
            "module": module,
            "sliceId": spec["sliceId"],
            "packetId": spec["packetId"],
            "packetSha256": spec["packetSha256"],
            "tokenId": tokens[module]["tokenId"],
            "tokenPath": str(SUCCESSOR_ROOT_REL / spec["tokenRelativePath"]),
            "tokenSha256": sha256_bytes(
                bundle_outputs[Path(spec["tokenRelativePath"])]
            ),
            "migrationAuthorityMode": spec["migrationAuthorityMode"],
            "worktrees": tokens[module]["worktreeBindings"],
            "effectivePacketState": "PACKET_AUTHORIZED_DOMAIN_AUTHORING",
            "authority": "DOMAIN_AUTHORING_ONLY",
        }
        if spec["migrationAuthorityMode"] == "ADMITTED_EXACT_LEASE":
            row["migrationLeaseId"] = leases[module]["leaseId"]
            row["migrationLeaseSha256"] = leases[module]["sealedPayloadSha256"]
        else:
            row["controlOwnedMigrationPrerequisite"] = tokens[module][
                "controlOwnedMigrationPrerequisite"
            ]
        delegations.append(row)
    return sealed(
        {
            "schema": "dwp.hris.g7-sys-hrm-promotion-receipt.v2",
            "receiptId": ACTIVATION_RECEIPT_ID,
            "issuedAt": context["issuedAt"],
            "issuedBy": "SYS_COMMON_INTEGRATION_CONTROL",
            "status": "PASS_SCOPED_DELEGATION",
            "decision": "SYS_HRM_DOMAIN_AUTHORING_AUTHORIZED_PER_TIM_PREDECESSOR_TOKENS_CLOSED",
            "predecessor": {
                "manifest": PREDECESSOR_PINS["manifest"],
                "promotionReceipt": PREDECESSOR_PINS["promotionReceipt"],
            },
            "bundleCommit": {
                "commit": bundle_commit,
                "tree": bundle_tree,
                "manifestPath": str(SUCCESSOR_ROOT_REL / "manifest.v2.json"),
                "manifestSha256": sha256_bytes(manifest_raw),
                "selfReferenceRule": "The promotion receipt is carried by a later commit and pins the immutable R2 bundle commit.",
            },
            "delegations": delegations,
            "closedPredecessorTokens": CLOSED_PREDECESSOR_TOKENS,
            "activeTokenClosedSet": ACTIVE_TOKEN_CLOSED_SET,
            "authority": {
                "moduleParallelDevelopmentAuthorized": True,
                "authorizedModules": ["SYS", "HRM"],
                "authorizedSlices": [
                    MODULES["SYS"]["sliceId"],
                    MODULES["HRM"]["sliceId"],
                ],
                "startTokensIssued": ACTIVE_TOKEN_CLOSED_SET,
                "migrationAdmissionAuthorized": [MODULES["SYS"]["leaseId"]],
                "sharedControlPathChangeAuthorizedForModules": False,
                "integrationMergeAuthorized": False,
                "customerDataAuthorized": False,
                "customerActivationAuthorized": False,
                "productionReleaseAuthorized": False,
            },
        }
    )


def check_bundle_commit(
    frontend: Path,
    bundle_commit: str,
    bundle_tree: str,
    manifest_raw: bytes,
    *,
    require_current_head: bool,
) -> None:
    if not re.fullmatch(r"[0-9a-f]{40}", bundle_commit):
        raise PrerequisiteError("bundle commit must be a full lowercase Git object ID")
    if not re.fullmatch(r"[0-9a-f]{40}", bundle_tree):
        raise PrerequisiteError("bundle tree must be a full lowercase Git object ID")
    actual_tree = run_git(frontend, "rev-parse", f"{bundle_commit}^{{tree}}")
    if actual_tree != bundle_tree:
        raise PrerequisiteError(
            f"bundle tree mismatch: expected {bundle_tree}, found {actual_tree}"
        )
    committed = run_git(
        frontend,
        "show",
        f"{bundle_commit}:{SUCCESSOR_ROOT_REL / 'manifest.v2.json'}",
        raw=True,
    )
    if committed != manifest_raw:
        raise PrerequisiteError("bundle commit does not carry the exact R2 manifest")
    run_git(frontend, "merge-base", "--is-ancestor", bundle_commit, "HEAD")
    current_head = run_git(frontend, "rev-parse", "HEAD^{commit}")
    if require_current_head and current_head != bundle_commit:
        raise PrerequisiteError(
            "promotion must be created from the exact pushed bundle commit at HEAD"
        )
    if not require_current_head and current_head == bundle_commit:
        raise PrerequisiteError(
            "promotion verification requires a later receipt carrier commit"
        )
    receipt_in_bundle = run_git(
        frontend,
        "ls-tree",
        "-r",
        "--name-only",
        bundle_commit,
        "--",
        str(PROMOTION_RECEIPT_REL),
    )
    if receipt_in_bundle:
        raise PrerequisiteError(
            "bundle commit already contains the promotion receipt; two-stage promotion violated"
        )


def write_append_only(outputs: dict[Path, bytes], root: Path, check_only: bool) -> None:
    missing = []
    drift = []
    for relative, raw in outputs.items():
        path = root / relative
        if check_only:
            if not path.is_file():
                missing.append(str(path))
            elif path.read_bytes() != raw:
                drift.append(str(path))
            continue
        if path.exists():
            if not path.is_file() or path.read_bytes() != raw:
                drift.append(str(path))
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
    if missing or drift:
        details = []
        if missing:
            details.append("missing: " + ", ".join(missing))
        if drift:
            details.append("append-only drift: " + ", ".join(drift))
        raise PrerequisiteError("; ".join(details))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "phase", choices=("bundle", "check-bundle", "promotion", "check-promotion")
    )
    parser.add_argument("--frontend-root", type=Path, default=DEFAULT_FRONTEND)
    parser.add_argument("--backend-root", type=Path, default=DEFAULT_BACKEND)
    parser.add_argument("--worktree-root", type=Path, default=DEFAULT_WORKTREE_ROOT)
    parser.add_argument("--bundle-commit")
    parser.add_argument("--bundle-tree")
    args = parser.parse_args()

    frontend = args.frontend_root.resolve()
    backend = args.backend_root.resolve()
    worktree_root = args.worktree_root.resolve()
    context = prepare_context(frontend, backend, worktree_root)
    tool_pins = read_tool_pins(frontend)
    bundle_outputs = build_bundle_bytes(context, tool_pins)
    successor_root = frontend / SUCCESSOR_ROOT_REL

    if args.phase in {"bundle", "check-bundle"}:
        if (frontend / PROMOTION_RECEIPT_REL).exists():
            raise PrerequisiteError(
                "pre-promotion bundle phase refuses an existing promotion receipt"
            )
        write_append_only(
            bundle_outputs,
            successor_root,
            check_only=args.phase == "check-bundle",
        )
    else:
        if not args.bundle_commit or not args.bundle_tree:
            parser.error("promotion phases require --bundle-commit and --bundle-tree")
        write_append_only(bundle_outputs, successor_root, check_only=True)
        check_bundle_commit(
            frontend,
            args.bundle_commit,
            args.bundle_tree,
            bundle_outputs[Path("manifest.v2.json")],
            require_current_head=args.phase == "promotion",
        )
        receipt = build_promotion_receipt(
            context, bundle_outputs, args.bundle_commit, args.bundle_tree
        )
        write_append_only(
            {PROMOTION_RECEIPT_REL: json_bytes(receipt)},
            frontend,
            check_only=args.phase == "check-promotion",
        )
    print(f"PASS: G7 SYS/HRM R2 materializer {args.phase}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except PrerequisiteError as exc:
        raise SystemExit(f"R2 materialization blocked: {exc}") from exc
