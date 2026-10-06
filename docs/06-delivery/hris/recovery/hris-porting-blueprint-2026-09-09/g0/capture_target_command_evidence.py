#!/usr/bin/env python3
"""Run pinned G0 target checks and persist value-free execution attestations.

The attestation is fail-closed: every command is run only when the observed
repository HEAD, tree, branch, and porcelain state match the pinned integration
baseline.  The same state is checked again immediately after every command so
a command cannot hide repository drift by a later cleanup step.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import shlex
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

from host_semaphore import (
    HOST_VERIFICATION_SEMAPHORE,
    SemaphoreTimeoutError,
    exclusive_host_semaphore,
)


ROOT = Path(__file__).resolve().parent
GROUP_PREFIX = {"backend": "CHK-BE-", "frontend": "CHK-FE-"}
OUTPUTS = {
    "backend": ROOT / "target-command-evidence-backend.json",
    "frontend": ROOT / "target-command-evidence-frontend.json",
}
EMPTY_SHA256 = hashlib.sha256(b"").hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def git_bytes(working_directory: str, *arguments: str) -> bytes:
    result = subprocess.run(
        ["git", "-C", working_directory, *arguments],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
        shell=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"git observation failed ({' '.join(arguments)}), exit={result.returncode}"
        )
    return result.stdout


def observe_repository(working_directory: str) -> dict[str, object]:
    head = git_bytes(working_directory, "rev-parse", "HEAD").decode("ascii").strip()
    tree = git_bytes(working_directory, "rev-parse", "HEAD^{tree}").decode("ascii").strip()
    branch = git_bytes(working_directory, "branch", "--show-current").decode("utf-8").strip()
    porcelain = git_bytes(
        working_directory,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
    )
    return {
        "head_sha": head,
        "tree_sha": tree,
        "branch": branch,
        "porcelain_count": len(porcelain.splitlines()),
        "porcelain_sha256": sha256_bytes(porcelain),
    }


def require_pinned_state(
    observation: dict[str, object],
    baseline: dict[str, str],
    check_id: str,
    phase: str,
) -> None:
    expected = {
        "head_sha": baseline["integration_head_sha"],
        "tree_sha": baseline["integration_tree_sha"],
        "branch": baseline["integration_branch"],
        "porcelain_count": 0,
        "porcelain_sha256": EMPTY_SHA256,
    }
    mismatches = [key for key, value in expected.items() if observation.get(key) != value]
    if mismatches:
        raise RuntimeError(
            f"{check_id}: {phase} repository attestation mismatch: {','.join(mismatches)}"
        )


def run_check(row: dict[str, str], baseline: dict[str, str]) -> dict[str, object]:
    working_directory = row["working_directory"]
    expected_root = Path(baseline["integration_worktree"]).resolve()
    observed_root = Path(
        git_bytes(working_directory, "rev-parse", "--show-toplevel")
        .decode("utf-8")
        .strip()
    ).resolve()
    if observed_root != expected_root:
        raise RuntimeError(f"{row['check_id']}: working tree root does not match baseline")

    observed_pre = observe_repository(working_directory)
    require_pinned_state(observed_pre, baseline, row["check_id"], "pre")
    started_at = utc_now()
    started = time.monotonic()
    with tempfile.TemporaryFile() as output:
        result = subprocess.run(
            shlex.split(row["command"]),
            cwd=working_directory,
            stdout=output,
            stderr=subprocess.STDOUT,
            check=False,
            shell=False,
        )
        duration_seconds = round(time.monotonic() - started, 3)
        output.seek(0)
        output_bytes = output.read()
    observed_post = observe_repository(working_directory)
    require_pinned_state(observed_post, baseline, row["check_id"], "post")
    return {
        "check_id": row["check_id"],
        "repository": row["repository"],
        "baseline_head_sha": baseline["integration_head_sha"],
        "baseline_tree_sha": baseline["integration_tree_sha"],
        "working_directory": working_directory,
        "runtime": row["runtime"],
        "command_sha256": sha256_bytes(row["command"].encode("utf-8")),
        "started_at": started_at,
        "ended_at": utc_now(),
        "duration_seconds": duration_seconds,
        "exit_code": result.returncode,
        "combined_output_sha256": sha256_bytes(output_bytes),
        "combined_output_bytes": len(output_bytes),
        "declared_summary": row["evidence_reference"],
        "observed_pre_head_sha": observed_pre["head_sha"],
        "observed_pre_tree_sha": observed_pre["tree_sha"],
        "observed_pre_branch": observed_pre["branch"],
        "observed_pre_porcelain_count": observed_pre["porcelain_count"],
        "observed_pre_porcelain_sha256": observed_pre["porcelain_sha256"],
        "observed_post_head_sha": observed_post["head_sha"],
        "observed_post_tree_sha": observed_post["tree_sha"],
        "observed_post_branch": observed_post["branch"],
        "observed_post_porcelain_count": observed_post["porcelain_count"],
        "observed_post_porcelain_sha256": observed_post["porcelain_sha256"],
    }


def capture_group(group: str) -> int:
    matrix = read_csv(ROOT / "build-matrix.csv")
    baselines = {
        row["repository"]: row
        for row in read_csv(ROOT / "integration-baseline-manifest.csv")
    }
    prefix = GROUP_PREFIX[group]
    selected = [
        row for row in matrix
        if row["check_id"].startswith(prefix) and row["required_for_g0_close"] == "YES"
    ]
    evidence = []
    failed = []
    try:
        for row in selected:
            baseline = baselines.get(row["repository"])
            if baseline is None:
                raise RuntimeError(f"{row['check_id']}: baseline repository is not registered")
            record = run_check(row, baseline)
            evidence.append(record)
            if record["exit_code"] != 0:
                failed.append(row["check_id"])
    except RuntimeError as error:
        print(f"TARGET_COMMAND_EVIDENCE_ABORTED group={group} reason={error}")
        return 2

    payload = {
        "schema": "dwp.hris.g0.command-evidence.v2",
        "group": group,
        "generated_at": utc_now(),
        "value_policy": "NO_RAW_COMMAND_OUTPUT_STORED_ONLY_SHA256_AND_BYTE_COUNT",
        "capture_script_sha256": sha256_bytes(Path(__file__).read_bytes()),
        "build_matrix_sha256": sha256_bytes((ROOT / "build-matrix.csv").read_bytes()),
        "baseline_manifest_sha256": sha256_bytes(
            (ROOT / "integration-baseline-manifest.csv").read_bytes()
        ),
        "checks": evidence,
        "all_passed": not failed,
        "failed_check_ids": failed,
    }
    destination = OUTPUTS[group]
    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{destination.name}.", dir=destination.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
        os.replace(temporary_name, destination)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)

    print(
        f"TARGET_COMMAND_EVIDENCE group={group} checks={len(evidence)} "
        f"passed={len(evidence) - len(failed)} failed={len(failed)} output={destination}"
    )
    return 1 if failed else 0


def self_test() -> dict[str, object]:
    import ast

    tree = ast.parse(Path(__file__).read_text(encoding="utf-8"))
    calls = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "run"
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "subprocess"
    ]
    cases = {
        "shared-semaphore-key": HOST_VERIFICATION_SEMAPHORE == "hris-verification",
        "closed-group-set": set(GROUP_PREFIX) == {"backend", "frontend"},
        "output-readable": bool(calls),
        "all-subprocesses-shell-false": bool(calls)
        and all(
            any(
                keyword.arg == "shell"
                and isinstance(keyword.value, ast.Constant)
                and keyword.value.value is False
                for keyword in call.keywords
            )
            for call in calls
        ),
    }
    return {
        "schema": "dwp.hris.target-command-capture-self-test.v1",
        "status": "PASS" if all(cases.values()) else "FAIL",
        "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    actions = parser.add_mutually_exclusive_group(required=True)
    actions.add_argument("--group", choices=sorted(GROUP_PREFIX))
    actions.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        result = self_test()
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0 if result["status"] == "PASS" else 1
    try:
        with exclusive_host_semaphore(
            HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300.0
        ) as semaphore:
            result = capture_group(args.group)
    except SemaphoreTimeoutError as error:
        print(
            f"TARGET_COMMAND_EVIDENCE_ABORTED group={args.group} "
            f"reason=HOST_SEMAPHORE_{error.metadata['status']}"
        )
        return 2
    print(
        f"HOST_SEMAPHORE name={semaphore['name']} status={semaphore['status']} "
        f"wait_ms={semaphore['waitMilliseconds']}"
    )
    return result


if __name__ == "__main__":
    raise SystemExit(main())
