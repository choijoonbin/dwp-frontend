#!/usr/bin/env python3
"""Validate the HRIS G2 backend integration receipt from pinned evidence only.

This validator deliberately does not run Gradle, Docker, OpenAPI generation, or
repository-wide static gates.  It validates the already-recorded targeted test
dispositions, immutable Git objects, migration bytes, size-debt classification,
and the sealed G2 successor bundle in one pass.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Callable


FRONTEND_ROOT = Path(__file__).resolve().parents[4]
DOCS = Path("docs/06-delivery/hris")
DEFAULT_RECEIPT = DOCS / "2026-10-07-g2-backend-semantic-integration-receipt.json"
G1_LEASE = DOCS / "2026-10-06-g1-migration-admission-and-lease.json"
ROADMAP = DOCS / "2026-10-06-integration-roadmap.md"
ROADMAP_SUCCESSOR = DOCS / "2026-10-07-integration-roadmap-status.md"
SUCCESSOR_VALIDATOR = DOCS / "tools/validate_g2_successor_authorities.py"

CURRENT_FRONTEND = "08a05f764a7c6dec38cce2627b81bcb8ef87ee6c"
RECONCILED_FRONTEND = "7f39d12cd10b8827c67355a7f445973d05373cc9"
CURRENT_BACKEND = "5612cc1a0b4a21a4d0b9107739579f23d165790f"
RECONCILED_BACKEND = "0731f6df2d55cdeb4784a09ae6e28d4ae4b0c294"
CURRENT_AGENT = "1d46fc4ab49c604efb7464574c49d13ee453e059"
BACKEND_RESULT = "ea630a5f2dec9b1f044f11dd5eb66ffb6f87941a"
PENDING_RESULT = "BACKEND_RESULT_COMMIT_PENDING"

# The receipt cannot self-hash without a circular value, so its companion
# validator carries the final byte-exact digest.
EXPECTED_RECEIPT_SHA256 = "5e30388eee282513dbdcc2748d63ce39403356c10813a11e2b7ddff66eb45ae1"
EXPECTED_G1_ROADMAP_BYTES = 11234
EXPECTED_G1_ROADMAP_SHA256 = "ac1abe594d7fa509e0d299024c6d330ab377dd58885b58ab267449fd15c5344e"

EXPECTED_SOURCE_PINS = {
    "currentFrontend": CURRENT_FRONTEND,
    "reconciledFrontend": RECONCILED_FRONTEND,
    "currentBackend": CURRENT_BACKEND,
    "reconciledBackend": RECONCILED_BACKEND,
    "currentAgent": CURRENT_AGENT,
}
EXPECTED_PARENTS = [CURRENT_BACKEND, RECONCILED_BACKEND]
EXPECTED_BRANCH = "codex/hris-g1-integration-backend-20261006"
EXPECTED_UPSTREAM = f"origin/{EXPECTED_BRANCH}"

EXPECTED_OPENAPI_SERVICES = (
    "auth",
    "platform",
    "people",
    "provider",
    "approval",
    "space",
    "messaging",
    "notification",
    "meeting",
    "time",
    "payroll",
    "agent-public",
)
EXPECTED_SUCCESSOR_FILES = (
    "hrm-api-event-contract-successor.v1.json",
    "hrm-source-family-coverage-successor.v1.csv",
    "hrm-source-family-coverage-successor.v1.seal.json",
    "g3-primary-ownership-disposition.v1.json",
    "manifest.v1.json",
)
EXPECTED_SIZE_DEBT_DIGESTS = {
    "production": "b7f59f4ca7126d26889d238d29c790c7e79c3459c500d2eb5f9a1e8c26b1ca4c",
    "test": "7b3fdedd0b5dd5ade240a9e091eb07038e2bda73fd409df1d0acbd1bcdaade9e",
}
EXPECTED_SIZE_COUNTS = {
    "production": (38, 32, 1, 2, 3),
    "test": (10, 6, 1, 2, 1),
}


class Validation:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.checks: dict[str, dict[str, Any]] = {}

    def require(self, condition: bool, message: str) -> None:
        if not condition:
            self.errors.append(message)

    def equal(self, actual: Any, expected: Any, message: str) -> None:
        self.require(actual == expected, f"{message}: {actual!r} != {expected!r}")

    def section(self, name: str, operation: Callable[[], dict[str, Any] | None]) -> None:
        before = len(self.errors)
        details: dict[str, Any] = {}
        try:
            details = operation() or {}
        except Exception as exc:  # collect independent failures in a single run
            self.errors.append(f"{name}: {type(exc).__name__}: {exc}")
        self.checks[name] = {
            "status": "PASS" if len(self.errors) == before else "FAIL",
            **details,
        }


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def run(command: list[str], *, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        command,
        check=check,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def git(repo: Path, *args: str, check: bool = True) -> bytes:
    return run(["git", "-C", str(repo), *args], check=check).stdout


def git_text(repo: Path, *args: str, check: bool = True) -> str:
    return git(repo, *args, check=check).decode("utf-8").strip()


def git_blob(repo: Path, commit: str, path: str) -> bytes:
    return git(repo, "show", f"{commit}:{path}")


def git_object_exists(repo: Path, object_name: str) -> bool:
    return run(
        ["git", "-C", str(repo), "cat-file", "-e", f"{object_name}^{{commit}}"],
        check=False,
    ).returncode == 0


def git_path_exists(repo: Path, commit: str, path: str) -> bool:
    return run(
        ["git", "-C", str(repo), "cat-file", "-e", f"{commit}:{path}"],
        check=False,
    ).returncode == 0


def worktree_for_branch(repo: Path, branch: str) -> Path | None:
    current_path: Path | None = None
    for line in git_text(repo, "worktree", "list", "--porcelain").splitlines():
        if line.startswith("worktree "):
            current_path = Path(line.removeprefix("worktree "))
        elif line == f"branch refs/heads/{branch}" and current_path is not None:
            return current_path
    return None


def normalized_repo_path(value: Any) -> bool:
    if not isinstance(value, str) or not value or "\\" in value:
        return False
    path = Path(value)
    return not path.is_absolute() and ".." not in path.parts and value == path.as_posix()


def verify_bytes(v: Validation, data: bytes, record: dict[str, Any], label: str) -> None:
    v.equal(len(data), record.get("bytes"), f"{label} byte count")
    v.equal(sha256(data), record.get("sha256"), f"{label} SHA-256")


def check_receipt_contract(
    v: Validation,
    receipt_path: Path,
    receipt: dict[str, Any],
    allow_pending: bool,
) -> dict[str, Any]:
    raw = receipt_path.read_bytes()
    digest = sha256(raw)
    v.equal(receipt.get("schema"), "dwp.hris.g2-backend-semantic-integration-receipt.v1", "receipt schema")
    v.equal(receipt.get("status"), "PASS_WITH_KNOWN_G5_BLOCKERS", "receipt status")
    v.equal(receipt.get("decision"), "G3_CANONICAL_AND_CONDITIONAL_V35_AUTHORIZED", "receipt decision")
    v.equal(receipt.get("sourcePins"), EXPECTED_SOURCE_PINS, "source pins")
    result = receipt.get("backendIntegration", {}).get("resultCommit")
    draft = result == PENDING_RESULT and allow_pending
    if not draft:
        v.equal(
            EXPECTED_RECEIPT_SHA256 != "TO_BE_BOUND_AFTER_SUCCESSOR_MANIFEST",
            True,
            "validator receipt digest binding is finalized",
        )
        if EXPECTED_RECEIPT_SHA256 != "TO_BE_BOUND_AFTER_SUCCESSOR_MANIFEST":
            v.equal(digest, EXPECTED_RECEIPT_SHA256, "receipt SHA-256")
        v.require(PENDING_RESULT.encode("utf-8") not in raw, "final receipt retains pending backend-result placeholder")

    exclusions = receipt.get("exclusions")
    v.require(isinstance(exclusions, list) and len(exclusions) == 6, "receipt must retain six exclusions")
    joined = "\n".join(str(item) for item in exclusions or [])
    for token in ("G3", "OpenAPI", "Docker", "source-size", "G6", "module-parallel"):
        v.require(token in joined, f"receipt exclusions missing {token!r} boundary")

    authority = receipt.get("authority", {})
    v.equal(authority.get("g3CanonicalGenerationAuthorized"), True, "G3 authorization")
    v.equal(authority.get("conditionalV35AuthorizedOnlyForNonEmptyReviewedDiff"), True, "conditional v35 rule")
    v.equal(authority.get("moduleParallelDevelopmentAuthorized"), False, "module authority")
    v.equal(authority.get("moduleAuthorizationGate"), "G7_PACKET_ISSUANCE", "module gate")
    v.equal(receipt.get("g6W1Successor", {}).get("status"), "NOT_RUN", "G6 W1 state")
    next_gate = receipt.get("nextGate", {})
    v.equal(next_gate.get("id"), "G3_CANONICAL_AND_CONDITIONAL_V35", "next gate")
    v.equal(next_gate.get("status"), "AUTHORIZED_NOT_STARTED", "next gate state")
    v.equal(next_gate.get("fullStaticAndDockerDebtGate"), "G5_REQUIRED_NO_WAIVER", "G5 blocker")
    return {"receiptSha256": digest, "receiptBytes": len(raw)}


def check_source_objects(
    v: Validation, frontend: Path, backend: Path, agent: Path
) -> dict[str, Any]:
    pairs = (
        (frontend, CURRENT_FRONTEND, "current frontend"),
        (frontend, RECONCILED_FRONTEND, "reconciled frontend"),
        (backend, CURRENT_BACKEND, "current backend"),
        (backend, RECONCILED_BACKEND, "reconciled backend"),
        (agent, CURRENT_AGENT, "current agent"),
    )
    for repo, commit, label in pairs:
        v.require(repo.is_dir(), f"{label} repository missing: {repo}")
        if repo.is_dir():
            v.require(git_object_exists(repo, commit), f"{label} commit is not locally reachable: {commit}")
    return {"pinnedCommitCount": len(pairs)}


def check_backend_merge(
    v: Validation,
    backend: Path,
    receipt: dict[str, Any],
    allow_pending: bool,
) -> dict[str, Any]:
    integration = receipt.get("backendIntegration", {})
    result = integration.get("resultCommit")
    v.equal(integration.get("branch"), EXPECTED_BRANCH, "integration branch")
    v.equal(integration.get("upstream"), EXPECTED_UPSTREAM, "integration upstream")
    v.equal(integration.get("mergeParents"), EXPECTED_PARENTS, "receipt merge parents")
    v.equal(integration.get("unresolvedConflictCount"), 0, "unresolved conflict count")
    v.equal(integration.get("committedConflictMarkerCount"), 0, "committed conflict marker count")

    if result == PENDING_RESULT:
        v.require(allow_pending, "backend result commit is pending; normal validation forbids draft evidence")
        return {"resultCommit": result, "draft": True}

    v.equal(result, BACKEND_RESULT, "backend result commit")
    v.require(git_object_exists(backend, str(result)), f"backend result commit is absent: {result}")
    if not git_object_exists(backend, str(result)):
        return {"resultCommit": result, "draft": False}

    parents = git_text(backend, "rev-list", "--parents", "-n", "1", str(result)).split()[1:]
    v.equal(parents, EXPECTED_PARENTS, "actual backend merge parents")
    local_head = git_text(backend, "rev-parse", f"refs/heads/{EXPECTED_BRANCH}")
    upstream_head = git_text(backend, "rev-parse", f"refs/remotes/{EXPECTED_UPSTREAM}")
    v.equal(local_head, result, "local integration branch head")
    v.equal(upstream_head, result, "upstream integration branch head")
    v.equal(integration.get("localBranchHeadMatches"), True, "receipt local branch result")
    v.equal(integration.get("upstreamHeadMatches"), True, "receipt upstream result")
    v.equal(integration.get("resultCommitReachableFromLocalBranch"), True, "receipt reachability")
    ancestor = run(
        ["git", "-C", str(backend), "merge-base", "--is-ancestor", str(result), local_head],
        check=False,
    ).returncode == 0
    v.require(ancestor, "backend result is not reachable from the local integration branch")
    integration_worktree = worktree_for_branch(backend, EXPECTED_BRANCH)
    v.require(integration_worktree is not None, "integration branch has no registered worktree")
    if integration_worktree is not None:
        v.equal(git_text(integration_worktree, "rev-parse", "HEAD"), result, "integration worktree HEAD")
        dirty = git_text(integration_worktree, "status", "--porcelain")
        unmerged = git_text(integration_worktree, "ls-files", "-u")
        v.equal(dirty, "", "integration worktree status")
        v.equal(unmerged, "", "integration worktree unresolved index conflicts")
        v.equal(integration.get("integrationWorktreeClean"), True, "receipt integration worktree cleanliness")

    changed = git_text(backend, "diff", "--name-only", CURRENT_BACKEND, str(result)).splitlines()
    marker_paths: list[str] = []
    if changed:
        marker_scan = run(
            [
                "git",
                "-C",
                str(backend),
                "grep",
                "-l",
                "-E",
                "^(<<<<<<< |=======|>>>>>>> )",
                str(result),
                "--",
                *changed,
            ],
            check=False,
        )
        v.require(marker_scan.returncode in {0, 1}, f"conflict-marker scan failed: {marker_scan.stderr.decode('utf-8', errors='replace')}")
        if marker_scan.returncode == 0:
            marker_paths = [
                line.split(":", 1)[1] if ":" in line else line
                for line in marker_scan.stdout.decode("utf-8").splitlines()
            ]
    v.equal(marker_paths, [], "committed conflict-marker paths")
    return {
        "resultCommit": result,
        "parents": parents,
        "changedPathsScannedForMarkers": len(changed),
        "integrationWorktree": str(integration_worktree) if integration_worktree else None,
        "draft": False,
    }


def check_authorization(v: Validation, backend: Path, receipt: dict[str, Any]) -> dict[str, Any]:
    decision = receipt.get("authorizationDecision", {})
    v.equal(decision.get("currentVersionsPreserved"), [32, 33, 34], "preserved authorization versions")
    artifacts = decision.get("preservedArtifacts", [])
    v.equal(len(artifacts), 6, "preserved authorization artifact count")
    expected_paths = {
        f"contracts/product-authorization/product-surfaces-v1.bundle-v{version}.json"
        for version in (32, 33, 34)
    } | {
        f"dwp-auth-server/src/main/resources/product-authorization/product-surfaces-v1.bundle-v{version}.generated.json"
        for version in (32, 33, 34)
    }
    v.equal({item.get("path") for item in artifacts}, expected_paths, "preserved authorization paths")
    for item in artifacts:
        path = item.get("path")
        if not normalized_repo_path(path):
            v.require(False, f"unsafe preserved authorization path: {path!r}")
            continue
        result_data = git_blob(backend, BACKEND_RESULT, path)
        current_data = git_blob(backend, CURRENT_BACKEND, path)
        verify_bytes(v, result_data, item, f"result {path}")
        v.equal(result_data, current_data, f"{path} result/current bytes")
        v.equal(item.get("matchesCurrentBase"), True, f"{path} current-base disposition")

    tree_paths = git_text(backend, "ls-tree", "-r", "--name-only", BACKEND_RESULT).splitlines()
    v35 = [path for path in tree_paths if "bundle-v35" in Path(path).name]
    v243 = [path for path in tree_paths if Path(path).name.startswith("V243__")]
    v.equal(decision.get("v35Issued"), False, "v35 issue state")
    v.equal(decision.get("v35ArtifactCount"), 0, "v35 receipt count")
    v.equal(decision.get("v243Issued"), False, "V243 issue state")
    v.equal(decision.get("v243ArtifactCount"), 0, "V243 receipt count")
    v.equal(v35, [], "v35 tree artifacts")
    v.equal(v243, [], "V243 tree artifacts")
    rule = str(decision.get("g3Rule", ""))
    v.require("Keep v34 byte-identical" in rule and "generate v35" in rule, "G3 v34/v35 rule drifted")
    return {"preservedArtifactCount": len(artifacts), "v35ArtifactCount": len(v35), "v243ArtifactCount": len(v243)}


def stream_digest(records: list[dict[str, Any]]) -> str:
    payload = b"".join(
        f"{item['path']}\0{item['bytes']}\0{item['sha256']}\n".encode("utf-8")
        for item in sorted(records, key=lambda item: item["path"])
    )
    return sha256(payload)


def check_migrations(
    v: Validation, frontend: Path, backend: Path, receipt: dict[str, Any]
) -> dict[str, Any]:
    lease = load_json(frontend / G1_LEASE)
    migration = receipt.get("migrationDecision", {})
    auth = migration.get("authV242", {})
    v.equal(auth.get("leaseId"), "HRIS-AUTH-V242-20261006-R1", "AUTH V242 lease")
    v.equal(auth.get("status"), "CONSUMED_IN_G2_RESULT_PENDING_G5_CLEAN_UPGRADE", "AUTH V242 status")
    verify_bytes(v, git_blob(backend, BACKEND_RESULT, auth["path"]), auth, "AUTH V242")

    manifest = lease.get("immutableArtifactManifest", {})
    records = manifest.get("artifacts", [])
    v.equal(len(records), 16, "immutable migration artifact count")
    by_stream: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        by_stream[str(record.get("stream"))].append(record)
        path = record.get("path")
        v.require(normalized_repo_path(path), f"unsafe immutable migration path: {path!r}")
        if normalized_repo_path(path):
            verify_bytes(v, git_blob(backend, BACKEND_RESULT, path), record, f"immutable {path}")

    expected_counts = {"PEOPLE": 4, "PAYROLL": 5, "TIME": 7}
    streams = migration.get("immutableStreams", {})
    v.equal(set(by_stream), set(expected_counts), "immutable migration streams")
    for stream, count in expected_counts.items():
        computed = stream_digest(by_stream[stream])
        v.equal(len(by_stream[stream]), count, f"{stream} artifact count")
        v.equal(computed, manifest.get("streamDigests", {}).get(stream), f"{stream} G1 stream digest")
        v.equal(streams.get(stream, {}).get("artifactCount"), count, f"{stream} receipt artifact count")
        v.equal(streams.get(stream, {}).get("streamDigest"), computed, f"{stream} receipt stream digest")
    expected_stream_metadata = {
        "PEOPLE": ("49..52", "ADMITTED_IMMUTABLE_PENDING_ENVIRONMENT_HISTORY_CHECK"),
        "PAYROLL": ("1..5", "ADMITTED_IMMUTABLE"),
        "TIME": ("1..7", "ADMITTED_IMMUTABLE"),
    }
    for stream, (versions, status) in expected_stream_metadata.items():
        v.equal(streams.get(stream, {}).get("versions"), versions, f"{stream} admitted versions")
        v.equal(streams.get(stream, {}).get("status"), status, f"{stream} admission status")

    people = migration.get("peopleCurrentSuccessor", {})
    v.equal(people.get("version"), 53, "People successor version")
    verify_bytes(v, git_blob(backend, BACKEND_RESULT, people["path"]), people, "People V53")
    v.equal(migration.get("cleanInstallAndUpgradeGate"), "G5_REQUIRED_NO_WAIVER", "migration G5 gate")

    tree_paths = git_text(backend, "ls-tree", "-r", "--name-only", BACKEND_RESULT).splitlines()
    migration_ranges = {
        "PEOPLE": ("dwp-people-server/src/main/resources/db/migration/", set(range(49, 54))),
        "PAYROLL": ("dwp-payroll-server/src/main/resources/db/migration/", set(range(1, 6))),
        "TIME": ("dwp-time-server/src/main/resources/db/migration/", set(range(1, 8))),
    }
    for stream, (prefix, expected_versions) in migration_ranges.items():
        versions = []
        for path in tree_paths:
            if not path.startswith(prefix):
                continue
            match = re.match(r"V(\d+)__", Path(path).name)
            if match and int(match.group(1)) in expected_versions:
                versions.append(int(match.group(1)))
        v.equal(Counter(versions), Counter(expected_versions), f"{stream} exact admitted migration versions")
    auth_versions = [
        Path(path).name
        for path in tree_paths
        if path.startswith("dwp-auth-server/src/main/resources/db/migration/V242__")
        or path.startswith("dwp-auth-server/src/main/resources/db/migration/V243__")
    ]
    v.equal(auth_versions, [Path(auth["path"]).name], "AUTH V242/V243 migration inventory")

    runtime_configs = {
        "dwp-gateway/src/main/resources/application.yml": ("DWP_PAYROLL_SERVICE_TOKEN", "DWP_TIME_SERVICE_TOKEN"),
        "dwp-payroll-server/src/main/resources/application.yml": ("PAYROLL_DB_NAME:dwp_payroll", "DWP_PAYROLL_SERVICE_TOKEN"),
        "dwp-time-server/src/main/resources/application.yml": ("TIME_DB_NAME:dwp_time", "DWP_TIME_SERVICE_TOKEN"),
    }
    for path, tokens in runtime_configs.items():
        text = git_blob(backend, BACKEND_RESULT, path).decode("utf-8")
        for token in tokens:
            v.require(token in text, f"{path} is missing runtime boundary {token}")
    return {"immutableArtifactCount": len(records), "streamCounts": expected_counts}


def check_openapi(v: Validation, backend: Path, receipt: dict[str, Any]) -> dict[str, Any]:
    decision = receipt.get("openApiDecision", {})
    expected = {
        "status": "PROVISIONAL_G2_APPROVED_SNAPSHOT_COMPOSITION",
        "approvedSnapshotCheck": "PASS",
        "serviceCount": 12,
        "gatewayPublicPathCount": 1658,
        "payrollAndTimeDefaultLive": False,
        "payrollAndTimeAreRuntimeTruth": False,
        "g3OneTimeGenerationRequired": True,
    }
    for key, value in expected.items():
        v.equal(decision.get(key), value, f"OpenAPI {key}")
    for service in EXPECTED_OPENAPI_SERVICES:
        path = f"contracts/openapi/{service}.json"
        v.require(git_path_exists(backend, BACKEND_RESULT, path), f"approved OpenAPI snapshot missing: {path}")
        if git_path_exists(backend, BACKEND_RESULT, path):
            document = json.loads(git_blob(backend, BACKEND_RESULT, path))
            v.require(isinstance(document.get("paths"), dict), f"{path} has no paths object")
    gateway = json.loads(git_blob(backend, BACKEND_RESULT, "contracts/openapi/gateway-public.json"))
    v.equal(len(gateway.get("paths", {})), 1658, "Gateway public OpenAPI path count")
    exporter = git_blob(backend, BACKEND_RESULT, "scripts/export-openapi-contracts.py").decode("utf-8")
    v.require("product-surfaces-v1.bundle-v34.json" in exporter, "OpenAPI exporter is not pinned to v34")
    v.require('ServiceContract("time", 8011, prefixed("/api/time"), default_live=False)' in exporter, "Time exporter default-live boundary drifted")
    v.require('ServiceContract("payroll", 8012, prefixed("/api/payroll"), default_live=False)' in exporter, "Payroll exporter default-live boundary drifted")
    v.require("HRIS_DESIGN_TIME_OVERLAY" in exporter, "OpenAPI design-time overlay binding missing")
    return {"serviceCount": len(EXPECTED_OPENAPI_SERVICES), "gatewayPublicPathCount": len(gateway.get("paths", {}))}


def check_owner_reclassification(v: Validation, backend: Path, receipt: dict[str, Any]) -> dict[str, Any]:
    expected = {
        "dwp-notification-server/src/main/java/com/dwp/services/notification/domain/NotificationQueryRepository.java": (
            "NOTIFICATION",
            "VISIBLE_PRODUCT_IDENTITY_NOTIFICATION_PRESENTATION",
        ),
        "dwp-notification-server/src/test/java/com/dwp/services/notification/domain/NotificationAdminRepositoryTest.java": (
            "NOTIFICATION",
            "VISIBLE_PRODUCT_IDENTITY_NOTIFICATION_PRESENTATION",
        ),
        "dwp-platform-server/src/main/java/com/dwp/services/platform/provisioning/PlatformTenantProvisioningService.java": (
            "PLATFORM",
            "PLATFORM_HOME_MIGRATION_VISIBLE_PRODUCT_IDENTITY",
        ),
    }
    rows = receipt.get("ownerReclassification", [])
    v.equal({row.get("path") for row in rows}, set(expected), "OTHER_BACKEND reclassification paths")
    for row in rows:
        path = row.get("path")
        if path not in expected:
            continue
        owner, cluster = expected[path]
        v.equal(row.get("formerCluster"), "OTHER_BACKEND", f"{path} former cluster")
        v.equal(row.get("owner"), owner, f"{path} owner")
        v.equal(row.get("cluster"), cluster, f"{path} cluster")
        v.equal(row.get("disposition"), "KEEP_IDENTICAL_BOTH_PINS", f"{path} disposition")
        current = git_blob(backend, CURRENT_BACKEND, path)
        reconciled = git_blob(backend, RECONCILED_BACKEND, path)
        result = git_blob(backend, BACKEND_RESULT, path)
        v.equal(current, reconciled, f"{path} current/reconciled bytes")
        v.equal(result, current, f"{path} result/current bytes")
    return {"reclassifiedPathCount": len(rows)}


def check_targeted_evidence(v: Validation, receipt: dict[str, Any]) -> dict[str, Any]:
    expected: dict[str, dict[str, Any]] = {
        "Auth six-class targeted batch": {"status": "PASS", "testClasses": 6, "tests": None, "countEvidence": "NOT_RECORDED"},
        "PilotAuthorizationFixtureAdapterTest": {"status": "PASS", "tests": 7, "passed": 7, "skipped": 0},
        "ProductAuthorizationContractControllerTest": {"status": "PASS", "tests": 2, "passed": 2, "skipped": 0},
        "Python product authorization v32, v33 and v34 tests": {"status": "PASS", "tests": 13, "passed": 13, "skipped": 0},
        "W1 successor manifest and lineage unit tests": {"status": "PASS", "tests": 37, "passed": 37, "skipped": 0, "fullG6RuntimeW1": False},
        "PayrollFoundationExactOperationsAuthorizationPostgresTest": {"status": "SKIP_DOCKER_UNAVAILABLE_G5_REQUIRED", "tests": 1, "passed": 0, "skipped": 1},
        "Directory, guard and registry targeted batch": {"status": "PASS", "tests": 37, "passed": 37, "skipped": 0},
        "Assignment, OpenAPI and security unique targeted batch": {"status": "PASS_WITH_DOCKER_SKIP", "tests": 36, "passed": 35, "skipped": 1},
        "GeneratedProductRouteCatalogTest after dual-inventory repair": {"status": "PASS", "tests": 32, "passed": 32, "skipped": 0},
        "Remaining exact fifteen-class targeted batch": {"status": "PASS", "testClasses": 15, "tests": None, "countEvidence": "NOT_RECORDED"},
        "Non-Docker Payroll targeted batch": {"status": "PASS", "tests": 70, "passed": 70, "skipped": 0},
        "Non-Docker Time targeted batch": {"status": "PASS", "tests": 127, "passed": 127, "skipped": 0},
        "Platform Home, catalog, OpenAPI and migration targeted batch": {"status": "PASS_WITH_DOCKER_SKIP", "tests": 15, "passed": 14, "skipped": 1},
        "NotificationAdminRepositoryTest": {"status": "PASS", "tests": 3, "passed": 3, "skipped": 0},
        "Python export-openapi unit inventory": {"status": "PASS_BY_INITIAL_27_PLUS_CORRECTED_TARGET_1", "uniqueTests": 28, "passed": 28, "fullBatchRerunAfterRepair": False},
        "Approved snapshot composition": {"status": "PASS_PROVISIONAL", "services": 12, "gatewayPublicPaths": 1658},
    }
    rows = receipt.get("targetedValidation", [])
    by_check = {row.get("check"): row for row in rows}
    v.equal(len(by_check), len(rows), "targeted evidence unique check count")
    v.equal(set(by_check), set(expected), "targeted evidence check inventory")
    for check, fields in expected.items():
        row = by_check.get(check, {})
        for key, value in fields.items():
            v.equal(row.get(key), value, f"{check} {key}")

    repairs = receipt.get("repairTrace", [])
    v.equal(len(repairs), 3, "repair trace count")
    v.equal({row.get("cluster") for row in repairs}, {"PEOPLE_ASSIGNMENT_SECURITY", "GATEWAY", "OPENAPI_GENERATION"}, "repair trace clusters")
    for row in repairs:
        v.equal(row.get("fullBatchRerun"), False, f"{row.get('cluster')} full-batch rerun")

    expected_skips = {
        "com.dwp.services.auth.migration.PayrollFoundationExactOperationsAuthorizationPostgresTest": 1,
        "com.dwp.services.people.hr.assignment.AssignmentProposalPostgresTest": 1,
        "com.dwp.services.platform.home.HomeWaveOneMigrationPostgresIntegrationTest": 1,
        "com.dwp.services.payroll.foundation.JdbcPayrollFoundationStoreTest": None,
        "com.dwp.services.time.workregime.TimeMigrationCleanUpgradeTest": None,
        "com.dwp.services.time.workregime.TimeOwnerPersistenceIntegrationTest": None,
    }
    skips = receipt.get("dockerSkips", [])
    by_class = {row.get("class"): row for row in skips}
    v.equal(set(by_class), set(expected_skips), "Docker skip inventory")
    for name, tests in expected_skips.items():
        row = by_class.get(name, {})
        v.equal(row.get("tests"), tests, f"{name} test count")
        v.equal(row.get("nextGate"), "G5", f"{name} next gate")
        if tests is None:
            v.equal(row.get("execution"), "DEFERRED_NOT_RUN", f"{name} execution")

    stops = receipt.get("environmentStopConditions", [])
    v.equal(len(stops), 7, "environment stop-condition count")
    stop_text = "\n".join(stops)
    for token in ("People V53", "separate databases", "DWP_PAYROLL_SERVICE_TOKEN", "DWP_TIME_SERVICE_TOKEN", "canonical semantic source", "v35", "G5"):
        v.require(token in stop_text, f"environment stop conditions missing {token!r}")
    return {"targetedEvidenceCount": len(rows), "dockerDispositionCount": len(skips), "repairTraceCount": len(repairs)}


def line_count(data: bytes) -> int:
    return len(data.decode("utf-8").splitlines())


def check_size_debt(v: Validation, backend: Path, receipt: dict[str, Any]) -> dict[str, Any]:
    debt = receipt.get("sizeGateDebt", {})
    v.equal(debt.get("policy"), "KNOWN_G5_STATIC_GATE_BLOCKER_NO_WAIVER_NO_BASELINE_EXPANSION", "size-gate policy")
    categories = (
        "currentBaseExistingNoG2Increase",
        "currentBaseExistingG2Increased",
        "g2IntroducedFromWithinLimit",
        "g2NewFiles",
    )
    summary: dict[str, int] = {}
    all_paths: list[str] = []
    for kind in ("production", "test"):
        section = debt.get(kind, {})
        expected_total, no_increase, increased, introduced, new = EXPECTED_SIZE_COUNTS[kind]
        v.equal(section.get("total"), expected_total, f"{kind} size-debt total")
        v.equal(section.get("currentBaseExistingNoG2IncreaseCount"), no_increase, f"{kind} no-increase count")
        v.equal(section.get("currentBaseExistingG2IncreasedCount"), increased, f"{kind} increased count")
        v.equal(section.get("g2IntroducedFromWithinLimitCount"), introduced, f"{kind} introduced count")
        v.equal(section.get("g2NewFileCount"), new, f"{kind} new-file count")

        records: list[str] = []
        actual_count = 0
        for category in categories:
            for item in section.get(category, []):
                actual_count += 1
                path = item.get("path")
                all_paths.append(path)
                v.require(normalized_repo_path(path), f"unsafe size-debt path: {path!r}")
                if not normalized_repo_path(path):
                    continue
                result_lines = line_count(git_blob(backend, BACKEND_RESULT, path))
                v.equal(result_lines, item.get("resultLines"), f"{path} result line count")
                base_exists = git_path_exists(backend, CURRENT_BACKEND, path)
                base_lines = line_count(git_blob(backend, CURRENT_BACKEND, path)) if base_exists else None
                v.equal(base_lines, item.get("baseLines"), f"{path} current-base line count")
                limit = item.get("limit")
                if category == "currentBaseExistingNoG2Increase":
                    v.require(base_lines is not None and base_lines > limit and result_lines <= base_lines and result_lines > limit, f"{path} is misclassified as existing/no-increase")
                elif category == "currentBaseExistingG2Increased":
                    v.require(base_lines is not None and base_lines > limit and result_lines > base_lines, f"{path} is misclassified as existing/increased")
                elif category == "g2IntroducedFromWithinLimit":
                    v.require(base_lines is not None and base_lines <= limit and result_lines > limit, f"{path} is misclassified as introduced-from-within-limit")
                else:
                    v.require(base_lines is None and result_lines > limit, f"{path} is misclassified as a G2 new file")
                records.append(f"{category}\0{path}\0{limit}\0{base_lines}\0{result_lines}\n")
        v.equal(actual_count, expected_total, f"{kind} classified size-debt rows")
        digest = sha256("".join(sorted(records)).encode("utf-8"))
        v.equal(digest, EXPECTED_SIZE_DEBT_DIGESTS[kind], f"{kind} exact size-debt classification digest")
        summary[kind] = actual_count
    v.equal(len(all_paths), len(set(all_paths)), "size-debt path uniqueness")
    v.require("without raising either exact baseline" in str(debt.get("g5ExitRule", "")), "G5 size-debt exit rule permits baseline drift")
    return summary


def check_successor_bundle(v: Validation, frontend: Path, receipt: dict[str, Any]) -> dict[str, Any]:
    successor = receipt.get("successorArtifacts", {})
    expected_dir = DOCS / "g2-successors/2026-10-07"
    v.equal(successor.get("directory"), expected_dir.as_posix(), "successor directory")
    v.equal(successor.get("manifestPath"), (expected_dir / "manifest.v1.json").as_posix(), "successor manifest path")
    v.equal(successor.get("requiredFiles"), list(EXPECTED_SUCCESSOR_FILES), "successor required files")
    v.equal(successor.get("status"), "PINNED_PASS", "successor receipt status")
    v.equal(successor.get("validatorPath"), SUCCESSOR_VALIDATOR.as_posix(), "successor validator path")
    successor_validator_raw = (frontend / SUCCESSOR_VALIDATOR).read_bytes() if (frontend / SUCCESSOR_VALIDATOR).is_file() else b""
    v.equal(successor.get("validatorBytes"), len(successor_validator_raw), "successor validator bytes")
    v.equal(successor.get("validatorSha256"), sha256(successor_validator_raw), "successor validator SHA-256")
    v.equal(successor.get("validatorMode"), "FINAL", "successor validator mode")
    v.equal(successor.get("validatorStatus"), "PASS", "successor receipt validator status")
    v.equal(successor.get("finalAuthorityValid"), True, "successor receipt final authority")

    base = frontend / expected_dir
    for name in EXPECTED_SUCCESSOR_FILES:
        v.require((base / name).is_file(), f"successor artifact missing: {name}")
    manifest_path = base / "manifest.v1.json"
    if not manifest_path.is_file():
        return {"artifactCount": 0}
    manifest_raw = manifest_path.read_bytes()
    v.equal(successor.get("manifestBytes"), len(manifest_raw), "successor manifest bytes")
    v.equal(successor.get("manifestSha256"), sha256(manifest_raw), "successor manifest SHA-256")
    manifest = json.loads(manifest_raw)
    v.equal(manifest.get("schema"), "dwp.hris.g2.successor-authority-manifest.v1", "successor manifest schema")
    v.equal(manifest.get("status"), "SEALED_SOURCE_INTEGRATION_DISPOSITION", "successor manifest status")
    manifest_validation = manifest.get("validation", {})
    v.equal(manifest_validation.get("validator"), SUCCESSOR_VALIDATOR.as_posix(), "manifest validator path")
    v.equal(manifest_validation.get("command"), f"python3 {SUCCESSOR_VALIDATOR.as_posix()} --compact", "manifest normal validator command")
    v.equal(manifest_validation.get("manifestPinsArtifactCount"), 4, "manifest pinned artifact count")
    v.equal(manifest_validation.get("manifestSelfPinned"), False, "manifest self-pin boundary")
    pins = manifest.get("sourcePins", {})
    v.equal(pins.get("currentBackendCommit"), CURRENT_BACKEND, "successor current backend pin")
    v.equal(pins.get("reconciledBackendCommit"), RECONCILED_BACKEND, "successor reconciled backend pin")
    v.equal(pins.get("backendResultCommit"), BACKEND_RESULT, "successor result pin")
    v.equal(pins.get("backendResultParents"), EXPECTED_PARENTS, "successor result parents")

    entries = manifest.get("artifacts", [])
    expected_paths = {(expected_dir / name).as_posix() for name in EXPECTED_SUCCESSOR_FILES[:-1]}
    v.equal(len(entries), 4, "successor manifest artifact count")
    v.equal({entry.get("path") for entry in entries}, expected_paths, "successor manifest paths")
    for entry in entries:
        path = entry.get("path")
        v.require(normalized_repo_path(path), f"unsafe successor artifact path: {path!r}")
        if normalized_repo_path(path):
            artifact = frontend / path
            v.require(artifact.is_file(), f"manifest-pinned successor artifact missing: {path}")
            if artifact.is_file():
                verify_bytes(v, artifact.read_bytes(), entry, f"successor {path}")

    seal_path = base / "hrm-source-family-coverage-successor.v1.seal.json"
    if seal_path.is_file():
        seal = load_json(seal_path)
        csv_path = expected_dir / "hrm-source-family-coverage-successor.v1.csv"
        csv_raw = (frontend / csv_path).read_bytes()
        artifact = seal.get("artifact", {})
        v.equal(artifact.get("path"), csv_path.as_posix(), "coverage seal CSV path")
        v.equal(artifact.get("bytes"), len(csv_raw), "coverage seal CSV bytes")
        v.equal(artifact.get("sha256"), sha256(csv_raw), "coverage seal CSV SHA-256")

    for name in EXPECTED_SUCCESSOR_FILES:
        path = base / name
        if path.is_file():
            v.require(PENDING_RESULT.encode("utf-8") not in path.read_bytes(), f"pending backend result remains in {name}")

    validator_path = frontend / SUCCESSOR_VALIDATOR
    v.require(validator_path.is_file(), f"successor validator missing: {SUCCESSOR_VALIDATOR}")
    successor_result: dict[str, Any] = {}
    if validator_path.is_file():
        completed = run([sys.executable, str(validator_path), "--compact"], check=False)
        v.equal(completed.returncode, 0, "successor validator exit code")
        try:
            successor_result = json.loads(completed.stdout.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            v.require(False, f"successor validator did not emit JSON: {exc}; stderr={completed.stderr.decode('utf-8', errors='replace')!r}")
        v.equal(successor_result.get("status"), "PASS", "successor validator normal-mode status")
        v.equal(successor_result.get("finalAuthorityValid"), True, "successor validator final authority")
    return {
        "manifestSha256": sha256(manifest_raw),
        "manifestBytes": len(manifest_raw),
        "artifactCount": len(entries),
        "successorValidatorStatus": successor_result.get("status"),
    }


def check_control_plane(v: Validation, frontend: Path, receipt: dict[str, Any]) -> dict[str, Any]:
    records = receipt.get("controlPlaneArtifactDigests", [])
    expected_paths = {
        (DOCS / "2026-10-06-g1-integration-lock-receipt.json").as_posix(),
        G1_LEASE.as_posix(),
        ROADMAP.as_posix(),
        ROADMAP_SUCCESSOR.as_posix(),
    }
    v.equal({item.get("path") for item in records}, expected_paths, "control-plane digest paths")
    for item in records:
        path = item.get("path")
        v.require(normalized_repo_path(path), f"unsafe control-plane artifact path: {path!r}")
        if normalized_repo_path(path):
            data = (frontend / path).read_bytes()
            verify_bytes(v, data, item, f"control-plane {path}")

    g1_roadmap_raw = (frontend / ROADMAP).read_bytes()
    v.equal(len(g1_roadmap_raw), EXPECTED_G1_ROADMAP_BYTES, "immutable G1 roadmap bytes")
    v.equal(sha256(g1_roadmap_raw), EXPECTED_G1_ROADMAP_SHA256, "immutable G1 roadmap SHA-256")
    roadmap = (frontend / ROADMAP_SUCCESSOR).read_text(encoding="utf-8")
    required = (
        "G2 complete with known G5 blockers; G3 authorized, not started",
        "| G2 Backend 의미 통합 | `COMPLETE_WITH_KNOWN_G5_BLOCKERS` |",
        "| G3 Canonical·조건부 v35 생성 | `AUTHORIZED_NOT_STARTED` |",
        "[G2 Backend Semantic Integration Receipt](2026-10-07-g2-backend-semantic-integration-receipt.json)",
        "G3 결과와 결합할 Frontend 통합 HEAD를 생성",
    )
    for text in required:
        v.require(text in roadmap, f"roadmap missing G2/G3 state text: {text}")
    v.require("| G2 Backend 의미 통합 | `AUTHORIZED_NOT_STARTED` |" not in roadmap, "roadmap successor retains obsolete G2 state")
    return {"pinnedControlArtifactCount": len(records)}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--frontend", type=Path, default=FRONTEND_ROOT)
    parser.add_argument("--backend", type=Path, default=FRONTEND_ROOT.parent / "dwp-backend")
    parser.add_argument("--agent", type=Path, default=FRONTEND_ROOT.parent / "dwp_agent")
    parser.add_argument("--receipt", type=Path)
    parser.add_argument(
        "--allow-pending-backend-result",
        action="store_true",
        help="permit only the explicit BACKEND_RESULT_COMMIT_PENDING draft sentinel; never waives successor or other checks",
    )
    parser.add_argument("--compact", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    frontend = args.frontend.resolve()
    backend = args.backend.resolve()
    agent = args.agent.resolve()
    receipt_path = (args.receipt.resolve() if args.receipt else frontend / DEFAULT_RECEIPT)
    validation = Validation()

    try:
        receipt = load_json(receipt_path)
    except Exception as exc:
        output = {"schema": "dwp.hris.g2-backend-semantic-integration-validation.v1", "status": "FAIL", "errors": [f"receipt load failed: {exc}"], "checks": {}}
        print(json.dumps(output, ensure_ascii=False, separators=(",", ":") if args.compact else None, indent=None if args.compact else 2))
        return 1

    validation.section(
        "receiptContract",
        lambda: check_receipt_contract(
            validation,
            receipt_path,
            receipt,
            args.allow_pending_backend_result,
        ),
    )
    validation.section("sourceObjects", lambda: check_source_objects(validation, frontend, backend, agent))
    validation.section("backendMerge", lambda: check_backend_merge(validation, backend, receipt, args.allow_pending_backend_result))

    result = receipt.get("backendIntegration", {}).get("resultCommit")
    if result != PENDING_RESULT:
        validation.section("authorizationPreservation", lambda: check_authorization(validation, backend, receipt))
        validation.section("migrationIntegrity", lambda: check_migrations(validation, frontend, backend, receipt))
        validation.section("openApiDisposition", lambda: check_openapi(validation, backend, receipt))
        validation.section("ownerReclassification", lambda: check_owner_reclassification(validation, backend, receipt))
        validation.section("sizeGateDebt", lambda: check_size_debt(validation, backend, receipt))
    validation.section("targetedEvidence", lambda: check_targeted_evidence(validation, receipt))
    validation.section("successorBundle", lambda: check_successor_bundle(validation, frontend, receipt))
    validation.section("controlPlaneArtifacts", lambda: check_control_plane(validation, frontend, receipt))

    draft = result == PENDING_RESULT
    status = "FAIL" if validation.errors else ("DRAFT_PASS" if draft else "PASS")
    output = {
        "schema": "dwp.hris.g2-backend-semantic-integration-validation.v1",
        "status": status,
        "finalAuthorityValid": status == "PASS" and not args.allow_pending_backend_result,
        "draftMode": bool(args.allow_pending_backend_result),
        "receipt": str(receipt_path),
        "backendResultCommit": result,
        "checks": validation.checks,
        "errors": validation.errors,
    }
    if args.compact:
        print(json.dumps(output, ensure_ascii=False, separators=(",", ":"), sort_keys=True))
    else:
        print(json.dumps(output, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if status in {"PASS", "DRAFT_PASS"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
