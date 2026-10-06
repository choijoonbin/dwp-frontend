#!/usr/bin/env python3
"""Capture value-free proof that every HRIS module worktree is executable.

Commands come from a closed catalog and run with ``shell=False``. Integration-
wide suites are linked by digest instead of being repeated in five worktrees.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import platform
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

from host_semaphore import (
    HOST_VERIFICATION_SEMAPHORE,
    SemaphoreTimeoutError,
    active_host_semaphore_capability,
    exclusive_host_semaphore,
)


G0 = Path(__file__).resolve().parent
ROOT = G0.parent
CATALOG = G0 / "session-environment-command-catalog.v1.json"
OUTPUT = G0 / "session-environment-evidence.json"
SESSIONS = ("HRIS-HRM", "HRIS-PER", "HRIS-TIM", "HRIS-PAY", "HRIS-SYS")
REPOSITORIES = ("DWP_BACKEND", "DWP_FRONTEND")
REQUIRED_INTEGRATION_CHECKS = {
    "DWP_BACKEND": {"CHK-BE-FULL", "CHK-BE-SBOM", "CHK-BE-PAY", "CHK-BE-TIM"},
    "DWP_FRONTEND": {
        "CHK-FE-INSTALL",
        "CHK-FE-PACKAGE-MANAGER",
        "CHK-FE-ARCH",
        "CHK-FE-TYPE",
        "CHK-FE-TEST",
        "CHK-FE-BUILD",
        "CHK-FE-LICENSE",
        "CHK-FE-CONTRACT",
        "CHK-FE-CLOSURE-TEST",
        "CHK-FE-RELEASE-CONTRACT-TEST",
        "CHK-FE-READINESS-TEST",
        "CHK-FE-SECURITY-AUDIT",
        "CHK-FE-SBOM",
    },
}
NODE = "/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
YARN = "/opt/homebrew/opt/node@20/bin/yarn"
EXPECTED_BACKEND = {
    "HRIS-HRM": [("people-service-test", ["./gradlew", ":dwp-people-server:test", "--no-daemon"])],
    "HRIS-PER": [("people-service-test", ["./gradlew", ":dwp-people-server:test", "--no-daemon"])],
    "HRIS-TIM": [("time-service-boot-test", ["./gradlew", ":dwp-time-server:bootJar", ":dwp-time-server:test", "--no-daemon"])],
    "HRIS-PAY": [("payroll-service-boot-test", ["./gradlew", ":dwp-payroll-server:bootJar", ":dwp-payroll-server:test", "--no-daemon"])],
    "HRIS-SYS": [("auth-platform-service-test", ["./gradlew", ":dwp-auth-server:test", ":dwp-platform-server:test", "--no-daemon"])],
}
SESSION_SLUGS = {session: session.removeprefix("HRIS-").lower() for session in SESSIONS}
for _session, _slug in SESSION_SLUGS.items():
    _frontend = f"/Users/a10697/Work/DWP/.codex-worktrees/hris/g1-20260910/{_slug}/frontend"
    _environment = [
        "env",
        f"DWP_DEV_INSTANCE={_slug}",
        f"DWP_FRONTEND_ROOT={_frontend}",
        f"DWP_NODE_BIN={NODE}",
        "python3",
        "scripts/devctl.py",
    ]
    EXPECTED_BACKEND[_session].extend(
        [
            ("runtime-topology", [*_environment, "topology"]),
            ("runtime-doctor", [*_environment, "doctor", "--profile", _slug]),
        ]
    )
EXPECTED_FRONTEND = [
    ("package-manager", [NODE, YARN, "package-manager:check"]),
    ("hris-layer-scan", [NODE, "scripts/verification/hris-layer-contract-v1.mjs", "--mode", "scan"]),
    ("typecheck", [NODE, YARN, "typecheck"]),
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def argv_sha256(argv: list[str]) -> str:
    encoded = json.dumps(argv, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return sha256_bytes(encoded)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def git(path: Path, *args: str) -> str:
    completed = subprocess.run(
        ["git", "-C", str(path), *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
        text=True,
        shell=False,
    )
    if completed.returncode != 0:
        raise ValueError(f"git {' '.join(args)} failed for registered worktree")
    return completed.stdout.strip()


def worktree_state(path: Path) -> dict[str, object]:
    dirty = git(path, "status", "--porcelain=v1", "--untracked-files=all", "--ignore-submodules=none")
    return {
        "headSha": git(path, "rev-parse", "HEAD"),
        "treeSha": git(path, "rev-parse", "HEAD^{tree}"),
        "branch": git(path, "branch", "--show-current"),
        "dirtyCount": len(dirty.splitlines()) if dirty else 0,
        "porcelainSha256": sha256_bytes(dirty.encode("utf-8")),
    }


def validate_catalog_payload(payload: object) -> list[dict[str, object]]:
    if not isinstance(payload, dict):
        raise ValueError("session environment catalog must be an object")
    if set(payload) != {"schema", "policy", "profiles"}:
        raise ValueError("session environment catalog fields drift")
    if payload["schema"] != "dwp.hris.session-environment-command-catalog.v1":
        raise ValueError("session environment catalog schema drift")
    expected_policy = {
        "modulePurpose": "PROVE_EACH_REGISTERED_WORKTREE_CAN_RESOLVE_SCOPED_AUTHORING_AND_ISOLATED_RUNTIME_TOPOLOGY",
        "integrationHeavyEvidenceRefs": [
            "g0/target-command-evidence-backend.json",
            "g0/target-command-evidence-frontend.json",
        ],
        "notRepeatedPerModule": [
            "BACKEND_ROOT_CHECK",
            "FRONTEND_FULL_TEST",
            "FRONTEND_BUILD",
            "FRONTEND_SECURITY_AUDIT",
            "FRONTEND_SBOM",
        ],
    }
    if payload["policy"] != expected_policy:
        raise ValueError("session environment heavy-suite policy drift")
    profiles = payload["profiles"]
    if not isinstance(profiles, list) or len(profiles) != 5:
        raise ValueError("session environment profile count drift")
    observed_sessions: set[str] = set()
    for profile in profiles:
        if set(profile) != {"sessionId", "backendCommands", "frontendCommands"}:
            raise ValueError("session environment profile fields drift")
        session = profile["sessionId"]
        if session not in SESSIONS or session in observed_sessions:
            raise ValueError("session environment profile binding drift")
        observed_sessions.add(session)
        for field in ("backendCommands", "frontendCommands"):
            commands = profile[field]
            if not isinstance(commands, list) or not commands:
                raise ValueError(f"{session}: empty command set")
            for command in commands:
                if set(command) != {"commandKey", "workingDirectory", "argv"}:
                    raise ValueError(f"{session}: command fields drift")
                if command["workingDirectory"] != ".":
                    raise ValueError(f"{session}: command working directory drift")
                argv = command["argv"]
                if not isinstance(argv, list) or not all(isinstance(value, str) and value for value in argv):
                    raise ValueError(f"{session}: command argv invalid")
        observed_backend = [(row["commandKey"], row["argv"]) for row in profile["backendCommands"]]
        observed_frontend = [(row["commandKey"], row["argv"]) for row in profile["frontendCommands"]]
        if observed_backend != EXPECTED_BACKEND[session]:
            raise ValueError(f"{session}: backend command set drift")
        if observed_frontend != EXPECTED_FRONTEND:
            raise ValueError(f"{session}: frontend command set drift")
    if observed_sessions != set(SESSIONS):
        raise ValueError("session environment module matrix incomplete")
    return profiles


def validate_catalog() -> list[dict[str, object]]:
    return validate_catalog_payload(json.loads(CATALOG.read_text(encoding="utf-8")))


def registered_worktrees() -> dict[tuple[str, str], dict[str, str]]:
    rows = read_csv(G0 / "worktree-branch-register.csv")
    result = {(row["session_id"], row["repository"]): row for row in rows if row["session_id"] in SESSIONS}
    expected = {(session, repository) for session in SESSIONS for repository in REPOSITORIES}
    if set(result) != expected:
        raise ValueError("registered module worktree matrix incomplete")
    return result


def observe_target(registration: dict[str, str]) -> tuple[Path, dict[str, object]]:
    path = Path(registration["worktree_path"])
    if not path.is_dir() or path.is_symlink():
        raise ValueError(f"target worktree missing or symlinked: {registration['record_id']}")
    state = worktree_state(path)
    expected_tree = git(path, "rev-parse", f"{registration['head_sha']}^{{tree}}")
    if (
        registration.get("clean_required") != "YES"
        or registration.get("observed_dirty_count") != "0"
        or registration.get("state") != "SEALED_ENTRY_VALIDATOR_CONTROLLED"
        or registration.get("head_sha") != registration.get("approved_integration_sha")
        or
        state["headSha"] != registration["head_sha"]
        or state["treeSha"] != expected_tree
        or state["branch"] != registration["branch"]
        or state["dirtyCount"] != 0
    ):
        raise ValueError(f"target worktree seal drift: {registration['record_id']}")
    return path, state


def observe_support(session: str) -> list[dict[str, object]]:
    rows = [
        row
        for row in read_csv(G0 / "session-support-worktree-register.csv")
        if row["session_id"] == session
    ]
    expected_roles = {
        "BACKEND_AGENT_EVIDENCE",
        "FRONTEND_OFFICIAL_CONTRACT",
        "FRONTEND_OPENAPI_COMPAT",
    }
    if len(rows) != 3 or {row["dependency_role"] for row in rows} != expected_roles:
        raise ValueError(f"{session}: support worktree role matrix drift")
    observations: list[dict[str, object]] = []
    for row in sorted(rows, key=lambda value: value["dependency_role"]):
        path = Path(row["worktree_path"])
        if not path.is_dir() or path.is_symlink():
            raise ValueError(f"support worktree missing or symlinked: {row['record_id']}")
        state = worktree_state(path)
        if (
            row["access_mode"] != "READ_ONLY_PINNED"
            or row["clean_required"] != "YES"
            or row["state"] != "SEALED_ENTRY_VALIDATOR_CONTROLLED"
            or state["branch"] != ""
            or state["headSha"] != row["head_sha"]
            or state["treeSha"] != row["tree_sha"]
            or state["dirtyCount"] != 0
        ):
            raise ValueError(f"support worktree seal drift: {row['record_id']}")
        observations.append(
            {
                "recordId": row["record_id"],
                "dependencyRole": row["dependency_role"],
                "worktreePath": str(path),
                "headSha": state["headSha"],
                "treeSha": state["treeSha"],
                "branch": state["branch"],
                "dirtyCount": state["dirtyCount"],
                "porcelainSha256": state["porcelainSha256"],
                "sealStatus": "PASS",
            }
        )
    return observations


def frontend_dependency_state(path: Path) -> dict[str, object]:
    package_json = path / "package.json"
    yarn_lock = path / "yarn.lock"
    install_state = path / ".yarn" / "install-state.gz"
    node_modules = path / "node_modules"
    if not package_json.is_file() or package_json.is_symlink():
        raise ValueError(f"frontend package.json unavailable: {path}")
    if not yarn_lock.is_file() or yarn_lock.is_symlink():
        raise ValueError(f"frontend lockfile unavailable: {path}")
    if not install_state.is_file() or install_state.is_symlink():
        raise ValueError(f"frontend install state unavailable: {path}")
    if not node_modules.is_dir() or node_modules.is_symlink():
        raise ValueError(f"frontend node_modules unavailable: {path}")
    package = json.loads(package_json.read_text(encoding="utf-8"))
    if package.get("packageManager") != "yarn@4.17.1":
        raise ValueError(f"frontend package manager drift: {path}")
    engines = package.get("engines")
    if not isinstance(engines, dict) or engines.get("node") != ">=24.18 <25":
        raise ValueError(f"frontend Node engine drift: {path}")
    node = Path(NODE)
    yarn = Path(YARN)
    if not node.is_file() or not os.access(node, os.X_OK):
        raise ValueError("registered Node executable unavailable")
    if not yarn.is_file() or not os.access(yarn, os.X_OK):
        raise ValueError("registered Yarn executable unavailable")
    return {
        "packageManager": package["packageManager"],
        "nodeEngine": engines["node"],
        "hostSystem": platform.system(),
        "hostArchitecture": platform.machine(),
        "nodeExecutablePath": NODE,
        "nodeExecutableSha256": sha256_file(node),
        "yarnExecutablePath": YARN,
        "yarnExecutableSha256": sha256_file(yarn),
        "lockfileSha256": sha256_file(yarn_lock),
        "lockfileBytes": yarn_lock.stat().st_size,
        "installStateSha256": sha256_file(install_state),
        "installStateBytes": install_state.stat().st_size,
        "nodeModulesPresent": True,
        "status": "PASS",
    }


def integration_evidence_refs() -> list[dict[str, object]]:
    control_rows = {
        row["repository"]: row
        for row in read_csv(G0 / "worktree-branch-register.csv")
        if row["session_id"] == "CONTROL"
    }
    if set(control_rows) != set(REPOSITORIES):
        raise ValueError("Integration Control target matrix incomplete")
    names = {
        "DWP_BACKEND": "target-command-evidence-backend.json",
        "DWP_FRONTEND": "target-command-evidence-frontend.json",
    }
    references: list[dict[str, object]] = []
    for repository in REPOSITORIES:
        path = G0 / names[repository]
        payload = json.loads(path.read_text(encoding="utf-8"))
        checks = payload.get("checks")
        if (
            payload.get("schema") != "dwp.hris.g0.command-evidence.v2"
            or payload.get("all_passed") is not True
            or not isinstance(checks, list)
            or not checks
        ):
            raise ValueError(f"{repository}: Integration Control heavy evidence invalid")
        expected_head = control_rows[repository]["head_sha"]
        observed_check_ids = {
            str(check.get("check_id", "")) for check in checks if isinstance(check, dict)
        }
        if not REQUIRED_INTEGRATION_CHECKS[repository] <= observed_check_ids:
            raise ValueError(
                f"{repository}: Integration Control heavy evidence checks incomplete"
            )
        if any(
            not isinstance(check, dict)
            or check.get("repository") != repository
            or check.get("baseline_head_sha") != expected_head
            or check.get("observed_pre_head_sha") != expected_head
            or check.get("observed_post_head_sha") != expected_head
            or check.get("exit_code") != 0
            for check in checks
        ):
            raise ValueError(f"{repository}: Integration Control heavy evidence is stale")
        references.append(
            {
                "repository": repository,
                "evidenceRef": f"g0/{path.name}",
                "evidenceSha256": sha256_file(path),
                "schema": payload["schema"],
                "generatedAt": payload.get("generated_at"),
                "checkIds": [check["check_id"] for check in checks],
                "registeredHeadSha": expected_head,
                "status": "PASS",
            }
        )
    return references


def expected_runtime_topology(
    session: str, backend_path: Path, frontend_path: Path
) -> dict[str, object]:
    slug = SESSION_SLUGS[session]
    offset = {"hrm": 10000, "per": 20000, "pay": 30000, "tim": 40000, "sys": 50000}[slug]
    runtime_root = backend_path / ".dev-runtime" / slug
    service_bases = {
        "agent": 8010, "approval": 8005, "auth": 8001, "frontend": 4200,
        "gateway": 8080, "meeting": 8009, "messaging": 8007,
        "notification": 8008, "payroll": 8012, "people": 8003,
        "platform": 8002, "provider": 8004, "space": 8006, "time": 8011,
    }
    infrastructure_bases = {
        "kafka": 9092, "livekitHttp": 7880, "livekitTcp": 7881,
        "livekitUdp": 7882, "postgres": 5432, "redis": 6379,
    }
    database_names = {
        name: f"{name}_{slug}"
        for name in (
            "dwp_agent", "dwp_approval", "dwp_auth", "dwp_meetings",
            "dwp_messaging", "dwp_notification", "dwp_payroll", "dwp_people",
            "dwp_platform", "dwp_provider", "dwp_space", "dwp_time",
        )
    }
    return {
        "schemaVersion": "1.0",
        "instance": slug,
        "portOffset": offset,
        "frontendRoot": str(frontend_path),
        "runtimeRoot": str(runtime_root),
        "stateFile": str(runtime_root / "processes.json"),
        "logRoot": str(runtime_root / "logs"),
        "composeProject": f"dwp-{slug}",
        "containerPrefix": f"dwp-{slug}",
        "servicePorts": {name: port + offset for name, port in service_bases.items()},
        "infrastructurePorts": {name: port + offset for name, port in infrastructure_bases.items()},
        "databases": database_names,
    }


def execute_command(
    session: str,
    repository: str,
    worktree: Path,
    command: dict[str, object],
) -> tuple[dict[str, object], bytes]:
    argv = command["argv"]
    if not isinstance(argv, list) or not all(isinstance(value, str) for value in argv):
        raise ValueError("validated command argv unexpectedly changed")
    started_at = utc_now()
    started = time.monotonic()
    environment = os.environ.copy()
    environment.update({"CI": "true", "TZ": "UTC", "LANG": "C", "LC_ALL": "C"})
    timed_out = False
    try:
        completed = subprocess.run(
            argv,
            cwd=worktree / str(command["workingDirectory"]),
            env=environment,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
            shell=False,
            timeout=1800,
        )
        output = completed.stdout
        exit_code = completed.returncode
    except subprocess.TimeoutExpired as error:
        timed_out = True
        output = error.stdout or b""
        if isinstance(output, str):
            output = output.encode("utf-8", errors="replace")
        exit_code = 124
    duration = time.monotonic() - started
    receipt = {
        "sessionId": session,
        "repository": repository,
        "commandKey": command["commandKey"],
        "workingDirectory": str(command["workingDirectory"]),
        "argvSha256": argv_sha256(argv),
        "startedAt": started_at,
        "endedAt": utc_now(),
        "durationMilliseconds": round(duration * 1000),
        "exitCode": exit_code,
        "timedOut": timed_out,
        "combinedOutputSha256": sha256_bytes(output),
        "combinedOutputBytes": len(output),
        "valuePolicy": "NO_RAW_COMMAND_OUTPUT_STORED",
        "status": "PASS" if exit_code == 0 and not timed_out else "FAIL",
    }
    return receipt, output


def atomic_write_json(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def _capture_under_active_lock(
    *,
    run_commands: bool,
    semaphore_metadata: dict[str, object],
) -> dict[str, object]:
    """Read, execute, re-read and construct one receipt under one live lease."""
    if active_host_semaphore_capability(HOST_VERIFICATION_SEMAPHORE) is None:
        raise ValueError("session environment capture requires active host semaphore")
    profiles = validate_catalog()
    registrations = registered_worktrees()
    integration_refs = integration_evidence_refs()
    control_registrations = {
        row["repository"]: row
        for row in read_csv(G0 / "worktree-branch-register.csv")
        if row["session_id"] == "CONTROL"
    }
    if set(control_registrations) != set(REPOSITORIES):
        raise ValueError("Integration Control target worktree matrix incomplete")
    control_targets: list[dict[str, object]] = []
    for repository in REPOSITORIES:
        path, state = observe_target(control_registrations[repository])
        control_targets.append(
            {
                "repository": repository,
                "recordId": control_registrations[repository]["record_id"],
                "worktreePath": str(path),
                "state": state,
                "sealStatus": "PASS",
            }
        )
    control_supports = observe_support("CONTROL")
    session_results: list[dict[str, object]] = []
    for profile in profiles:
        session = str(profile["sessionId"])
        backend_path, backend_pre = observe_target(
            registrations[(session, "DWP_BACKEND")]
        )
        frontend_path, frontend_pre = observe_target(
            registrations[(session, "DWP_FRONTEND")]
        )
        supports = observe_support(session)
        dependencies = frontend_dependency_state(frontend_path)
        receipts: list[dict[str, object]] = []
        runtime_topology: dict[str, object] = {}
        if run_commands:
            for command in profile["backendCommands"]:
                receipt, output = execute_command(
                    session, "DWP_BACKEND", backend_path, command
                )
                receipts.append(receipt)
                if command["commandKey"] == "runtime-topology":
                    try:
                        parsed = json.loads(output)
                    except (UnicodeDecodeError, json.JSONDecodeError) as error:
                        raise ValueError(
                            f"{session}: topology command did not emit JSON"
                        ) from error
                    expected_topology = expected_runtime_topology(
                        session, backend_path, frontend_path
                    )
                    if parsed != expected_topology:
                        raise ValueError(f"{session}: runtime topology semantic drift")
                    runtime_topology = parsed
            for command in profile["frontendCommands"]:
                receipt, _output = execute_command(
                    session, "DWP_FRONTEND", frontend_path, command
                )
                receipts.append(receipt)
        _, backend_post = observe_target(
            registrations[(session, "DWP_BACKEND")]
        )
        _, frontend_post = observe_target(
            registrations[(session, "DWP_FRONTEND")]
        )
        if backend_pre != backend_post or frontend_pre != frontend_post:
            raise ValueError(f"{session}: target changed during environment capture")
        commands_passed = all(row["status"] == "PASS" for row in receipts)
        session_results.append(
            {
                "sessionId": session,
                "targets": [
                    {
                        "repository": "DWP_BACKEND",
                        "recordId": registrations[(session, "DWP_BACKEND")]["record_id"],
                        "worktreePath": str(backend_path),
                        "pre": backend_pre,
                        "post": backend_post,
                        "sealStatus": "PASS",
                    },
                    {
                        "repository": "DWP_FRONTEND",
                        "recordId": registrations[(session, "DWP_FRONTEND")]["record_id"],
                        "worktreePath": str(frontend_path),
                        "pre": frontend_pre,
                        "post": frontend_post,
                        "sealStatus": "PASS",
                    },
                ],
                "supportSeals": supports,
                "frontendDependencyState": dependencies,
                "runtimeTopology": runtime_topology,
                "commandReceipts": receipts,
                "commandExecution": (
                    "EXECUTED" if run_commands else "NOT_EXECUTED_VALIDATE_ONLY"
                ),
                "status": (
                    "PASS"
                    if run_commands and commands_passed
                    else "OBSERVATION_PASS"
                    if not run_commands
                    else "FAIL"
                ),
            }
        )
    overall = all(
        row["status"] == ("PASS" if run_commands else "OBSERVATION_PASS")
        for row in session_results
    )
    return {
        "schema": "dwp.hris.session-environment-evidence.v1",
        "generatedAt": utc_now(),
        "valuePolicy": "VALUE_FREE_METADATA_AND_DIGESTS_ONLY",
        "catalogRef": "g0/session-environment-command-catalog.v1.json",
        "catalogSha256": sha256_file(CATALOG),
        "integrationHeavyEvidence": integration_refs,
        "integrationControlTargets": control_targets,
        "integrationControlSupportSeals": control_supports,
        "semaphore": semaphore_metadata,
        "executionMode": "CAPTURE" if run_commands else "VALIDATE_ONLY",
        "sessions": session_results,
        "allPassed": overall,
        "status": "PASS" if overall else "FAIL",
    }


def capture(
    *,
    run_commands: bool,
) -> dict[str, object]:
    """Capture all authority inputs and command results under one common lock."""
    with exclusive_host_semaphore(
        HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300.0
    ) as semaphore_metadata:
        return _capture_under_active_lock(
            run_commands=run_commands,
            semaphore_metadata=semaphore_metadata,
        )


def self_test() -> dict[str, object]:
    import inspect
    import stat

    cases: dict[str, bool] = {}
    payload = json.loads(CATALOG.read_text(encoding="utf-8"))
    cases["catalog-valid"] = len(validate_catalog_payload(payload)) == 5
    mutated = json.loads(json.dumps(payload))
    mutated["profiles"][0]["frontendCommands"][0]["argv"][-1] = "test"
    try:
        validate_catalog_payload(mutated)
        cases["catalog-command-tamper-rejected"] = False
    except ValueError:
        cases["catalog-command-tamper-rejected"] = True
    cases["argv-digest-deterministic"] = argv_sha256(["a", "b"]) == argv_sha256(
        ["a", "b"]
    ) and argv_sha256(["a", "b"]) != argv_sha256(["a b"])
    cases["module-target-matrix-complete"] = len(registered_worktrees()) == 10
    try:
        observe_support("HRIS-HRM")
        cases["three-support-seals"] = True
    except ValueError:
        cases["three-support-seals"] = False
    all_target_rows = [
        row
        for row in read_csv(G0 / "worktree-branch-register.csv")
        if row.get("session_id") in {*SESSIONS, "CONTROL"}
        and row.get("repository") in REPOSITORIES
    ]
    cases["twelve-target-registration-rows"] = (
        len(all_target_rows) == 12
        and len({(row["session_id"], row["repository"]) for row in all_target_rows}) == 12
    )
    all_support_rows = [
        row
        for row in read_csv(G0 / "session-support-worktree-register.csv")
        if row.get("session_id") in {*SESSIONS, "CONTROL"}
    ]
    cases["eighteen-support-registration-rows"] = (
        len(all_support_rows) == 18
        and all(
            len([row for row in all_support_rows if row["session_id"] == session]) == 3
            for session in (*SESSIONS, "CONTROL")
        )
    )
    cases["shared-semaphore-key"] = HOST_VERIFICATION_SEMAPHORE == "hris-verification"
    try:
        _capture_under_active_lock(run_commands=False, semaphore_metadata={})
        cases["unlocked-internal-capture-rejected"] = False
    except ValueError as error:
        cases["unlocked-internal-capture-rejected"] = (
            str(error) == "session environment capture requires active host semaphore"
        )
    capture_source = inspect.getsource(capture)
    internal_source = inspect.getsource(_capture_under_active_lock)
    cases["lock-encloses-all-input-reads-and-command-execution"] = (
        capture_source.index("with exclusive_host_semaphore(")
        < capture_source.index("_capture_under_active_lock(")
        and "timeout_seconds=300.0" in capture_source
        and internal_source.index("active_host_semaphore_capability(")
        < internal_source.index("profiles = validate_catalog()")
        and "exclusive_host_semaphore(" not in internal_source
    )
    synthetic_backend = Path("/tmp/hris-backend")
    synthetic_frontend = Path("/tmp/hris-frontend")
    topology = expected_runtime_topology("HRIS-HRM", synthetic_backend, synthetic_frontend)
    cases["runtime-topology-semantic-matrix"] = (
        topology["instance"] == "hrm"
        and topology["portOffset"] == 10000
        and topology["frontendRoot"] == str(synthetic_frontend)
        and topology["servicePorts"]["people"] == 18003
        and topology["databases"]["dwp_people"] == "dwp_people_hrm"
    )
    with tempfile.TemporaryDirectory(prefix="hris-session-evidence-selftest-") as temporary:
        output = Path(temporary) / "evidence.json"
        atomic_write_json(output, {"schema": "self-test", "status": "PASS"})
        cases["atomic-value-free-output"] = (
            json.loads(output.read_text(encoding="utf-8"))["status"] == "PASS"
            and stat.S_IMODE(output.stat().st_mode) == 0o600
        )
    status_value = "PASS" if all(cases.values()) else "FAIL"
    return {
        "schema": "dwp.hris.session-environment-capture-self-test.v1",
        "status": status_value,
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    actions = parser.add_mutually_exclusive_group(required=True)
    actions.add_argument("--capture", action="store_true")
    actions.add_argument("--validate-only", action="store_true")
    actions.add_argument("--self-test", action="store_true")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    arguments = parser.parse_args()
    try:
        if arguments.self_test:
            result = self_test()
            print(json.dumps(result, ensure_ascii=False, sort_keys=True))
            return 0 if result["status"] == "PASS" else 1
        result = capture(run_commands=arguments.capture)
        if arguments.capture:
            # The receipt records the completed RELEASED lease.  Publication is
            # outside the read/execute critical section; the canonical validator
            # reacquires the same lock and rejects any intervening input drift.
            atomic_write_json(arguments.output, result)
        else:
            print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0 if result["status"] == "PASS" or arguments.validate_only else 1
    except (OSError, ValueError, json.JSONDecodeError, SemaphoreTimeoutError) as error:
        failure = {
            "schema": "dwp.hris.session-environment-capture-error.v1",
            "status": "FAIL",
            "errorType": type(error).__name__,
            "message": str(error),
        }
        print(json.dumps(failure, ensure_ascii=False, sort_keys=True), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
