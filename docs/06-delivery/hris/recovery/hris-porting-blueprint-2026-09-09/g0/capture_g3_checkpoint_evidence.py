#!/usr/bin/env python3
"""Capture a G3 checkpoint's registered commands without invoking a shell.

The script never accepts a free-form command. It resolves the exact argv set from
``g3-verification-command-catalog.v1.json``, verifies the registered worktree and
commit range, executes every required command, and atomically writes typed JSON.
Raw output is intentionally not persisted; only its SHA-256 is retained.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from host_semaphore import (
    HOST_VERIFICATION_SEMAPHORE,
    SemaphoreTimeoutError,
    exclusive_host_semaphore,
)
from write_module_evidence_shard import append_new_bytes, resolve_target

from validate_code_checkpoint import (
    Checks,
    G0,
    MODULES,
    ROOT,
    SHA40,
    canonical_argv_sha256,
    expected_command_bindings,
    git,
    parse_frontend_slice_typed_result,
    read_csv,
    reproducible_result_sha256,
    validate_command_catalog,
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def fail(message: str) -> None:
    raise ValueError(message)


def capture_main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint-id", required=True)
    parser.add_argument(
        "--checkpoint-kind",
        required=True,
        choices=("MODULE_COMMIT", "CENTRAL_MATERIALIZATION", "INTEGRATION_MERGE"),
    )
    parser.add_argument("--slice-id", required=True)
    parser.add_argument("--owner-session-id", required=True, choices=tuple(MODULES))
    parser.add_argument("--writer-session-id", required=True, choices=(*MODULES, "CONTROL"))
    parser.add_argument("--repository", required=True, choices=("DWP_BACKEND", "DWP_FRONTEND"))
    parser.add_argument("--parent-head-sha", required=True)
    parser.add_argument("--head-sha", required=True)
    parser.add_argument("--source-checkpoint-id")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    try:
        kind = args.checkpoint_kind
        if not SHA40.fullmatch(args.parent_head_sha) or not SHA40.fullmatch(args.head_sha):
            fail("parent/head SHA must be lowercase 40-hex")
        if args.parent_head_sha == args.head_sha:
            fail("checkpoint range is empty")
        if kind == "MODULE_COMMIT" and args.writer_session_id != args.owner_session_id:
            fail("MODULE_COMMIT writer must equal owner")
        if kind != "MODULE_COMMIT" and args.writer_session_id != "CONTROL":
            fail("Control checkpoint writer must be CONTROL")
        if (kind == "INTEGRATION_MERGE") != bool(args.source_checkpoint_id):
            fail("only INTEGRATION_MERGE requires --source-checkpoint-id")

        slices = {
            row["slice_id"]: row
            for row in read_csv(ROOT / "coding-readiness/g3-slice-code-go-register.csv")
        }
        slice_row = slices.get(args.slice_id, {})
        if slice_row.get("session_id") != args.owner_session_id:
            fail("slice is not owned by owner-session-id")
        worktrees = {
            (row["session_id"], row["repository"]): row
            for row in read_csv(G0 / "worktree-branch-register.csv")
        }
        registration = worktrees.get((args.writer_session_id, args.repository))
        if not registration:
            fail("writer/repository has no registered worktree")
        worktree = Path(registration["worktree_path"])
        code, head = git(worktree, "rev-parse", "HEAD")
        if code != 0 or head != args.head_sha:
            fail("registered worktree HEAD does not equal --head-sha")
        code, branch = git(worktree, "branch", "--show-current")
        if code != 0 or branch != registration["branch"]:
            fail("registered worktree branch drift")
        code, dirty = git(
            worktree,
            "status",
            "--porcelain=v1",
            "--untracked-files=all",
            "--ignore-submodules=none",
        )
        if code != 0 or dirty:
            fail("registered worktree is dirty")
        parent_code, _ = git(worktree, "cat-file", "-e", f"{args.parent_head_sha}^{{commit}}")
        ancestor_code, _ = git(
            worktree,
            "merge-base",
            "--is-ancestor",
            args.parent_head_sha,
            args.head_sha,
        )
        if parent_code != 0 or ancestor_code != 0:
            fail("parent/head is not a resolvable forward range")

        checkpoint = {
            "checkpoint_id": args.checkpoint_id,
            "checkpoint_kind": kind,
            "slice_id": args.slice_id,
            "owner_session_id": args.owner_session_id,
            "writer_session_id": args.writer_session_id,
            "repository": args.repository,
            "parent_head_sha": args.parent_head_sha,
            "head_sha": args.head_sha,
            "source_checkpoint_id": args.source_checkpoint_id or "",
        }
        checks = Checks()
        profiles = validate_command_catalog(checks)
        if checks.errors:
            fail("command catalog invalid: " + "; ".join(checks.errors))
        bindings = expected_command_bindings(checkpoint, profiles)
        if not bindings:
            fail("no registered verification commands")

        environment = dict(os.environ)
        environment.update({"CI": "true", "TZ": "UTC", "LANG": "C", "LC_ALL": "C"})
        commands: list[dict[str, object]] = []
        for command_id, (argv, working_directory) in bindings.items():
            command_cwd = (worktree / working_directory).resolve()
            if command_cwd != worktree.resolve() and worktree.resolve() not in command_cwd.parents:
                fail(f"command workdir escapes registered worktree: {command_id}")
            started_at = utc_now()
            try:
                completed = subprocess.run(
                    argv,
                    cwd=command_cwd,
                    env=environment,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    timeout=1800,
                    check=False,
                    shell=False,
                )
            except (OSError, subprocess.TimeoutExpired) as error:
                fail(f"command execution failed: {command_id}: {error}")
            ended_at = utc_now()
            status_value = "PASS" if completed.returncode == 0 else "FAIL"
            command_digest = canonical_argv_sha256(argv)
            command_receipt: dict[str, object] = {
                    "commandId": command_id,
                    "commandSha256": command_digest,
                    "startedAt": started_at,
                    "endedAt": ended_at,
                    "exitCode": completed.returncode,
                    "outputSha256": file_sha256_bytes(completed.stdout),
                    "reproducibleResultSha256": reproducible_result_sha256(
                        command_digest,
                        completed.returncode,
                        status_value,
                    ),
                    "status": status_value,
                }
            typed_result = parse_frontend_slice_typed_result(
                command_id,
                completed.stdout,
                slice_id=args.slice_id,
                test_path=slice_row.get("frontend_test_path", ""),
            )
            if typed_result is not None:
                command_receipt["typedResult"] = typed_result
            commands.append(command_receipt)

        after_code, after_head = git(worktree, "rev-parse", "HEAD")
        dirty_code, dirty_after = git(
            worktree,
            "status",
            "--porcelain=v1",
            "--untracked-files=all",
            "--ignore-submodules=none",
        )
        if after_code != 0 or after_head != args.head_sha or dirty_code != 0 or dirty_after:
            fail("verification commands changed HEAD or left the worktree dirty")

        payload = {
            "schema": "dwp.hris.g3.checkpoint-test-evidence.v1",
            "checkpointId": args.checkpoint_id,
            "checkpointKind": kind,
            "sliceId": args.slice_id,
            "ownerSessionId": args.owner_session_id,
            "writerSessionId": args.writer_session_id,
            "repository": args.repository,
            "parentHeadSha": args.parent_head_sha,
            "headSha": args.head_sha,
            "sourceCheckpointId": args.source_checkpoint_id,
            "commands": commands,
            "overallStatus": "PASS" if all(row["status"] == "PASS" for row in commands) else "FAIL",
        }
        output_relative = Path(args.output)
        if (
            output_relative.is_absolute()
            or len(output_relative.parts) < 3
            or output_relative.parts[0] != "direct-captures"
            or output_relative.parts[1] != args.checkpoint_id
        ):
            fail(
                "output must be a shard-relative direct-captures/<checkpoint-id>/<file>.json path"
            )
        output = resolve_target(args.owner_session_id, args.output, "g3")
        payload_bytes = (
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
        ).encode("utf-8")
        append_new_bytes(
            args.owner_session_id,
            [(args.output, payload_bytes)],
            "g3",
        )
        print(json.dumps({"status": payload["overallStatus"], "output": str(output)}, ensure_ascii=False))
        return 0 if payload["overallStatus"] == "PASS" else 1
    except (KeyError, OSError, ValueError) as error:
        print(json.dumps({"status": "FAIL", "error": str(error)}, ensure_ascii=False))
        return 1


def file_sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def self_test() -> dict[str, object]:
    import ast
    import inspect

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
    slice_id = "BASE-TFR-HRM-001"
    test_path = (
        "apps/dwp/src/features/hris/people/__tests__/g3-slices/"
        "base-tfr-hrm-001.slice.test.tsx"
    )
    typed_result = {
        "schema": "dwp.hris.g3.frontend-slice-test-gate.v1",
        "status": "PASS",
        "sliceId": slice_id,
        "testPath": test_path,
        "testFileCount": 1,
        "executedTestCount": 1,
        "passedTestCount": 1,
        "failedTestCount": 0,
        "skippedTestCount": 0,
        "unrelatedTestCount": 0,
        "jestExitCode": 0,
        "jestResultSha256": "1" * 64,
        "argvSha256": "2" * 64,
        "errors": [],
    }
    parsed = parse_frontend_slice_typed_result(
        "G3CMD-HRM-FE:BASE-TFR-HRM-001:frontend-slice-test",
        json.dumps(typed_result).encode("utf-8"),
        slice_id=slice_id,
        test_path=test_path,
    )
    skipped_result = dict(typed_result, skippedTestCount=1)
    try:
        parse_frontend_slice_typed_result(
            "G3CMD-HRM-FE:BASE-TFR-HRM-001:frontend-slice-test",
            json.dumps(skipped_result).encode("utf-8"),
            slice_id=slice_id,
            test_path=test_path,
        )
    except ValueError:
        skipped_rejected = True
    else:
        skipped_rejected = False
    cases = {
        "shared-semaphore-key": HOST_VERIFICATION_SEMAPHORE == "hris-verification",
        "has-registered-command-runner": bool(calls),
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
        "exact-frontend-typed-result-accepted": parsed == typed_result,
        "skipped-frontend-typed-result-rejected": skipped_rejected,
        "non-frontend-command-has-no-typed-result": parse_frontend_slice_typed_result(
            "G3CMD-HRM-BE:BASE-TFR-HRM-001:slice-contract",
            b"not-json-needed",
            slice_id=slice_id,
            test_path=test_path,
        ) is None,
        "capture-output-uses-append-only-shard-writer": (
            "append_new_bytes(" in inspect.getsource(capture_main)
            and "resolve_target(" in inspect.getsource(capture_main)
            and "os.replace(" not in inspect.getsource(capture_main)
            and "NamedTemporaryFile" not in inspect.getsource(capture_main)
        ),
        "capture-output-is-checkpoint-relative": (
            "direct-captures/<checkpoint-id>/<file>.json"
            in inspect.getsource(capture_main)
        ),
    }
    return {
        "schema": "dwp.hris.g3.checkpoint-capture-self-test.v1",
        "status": "PASS" if all(cases.values()) else "FAIL",
        "cases": cases,
    }


def main() -> int:
    if sys.argv[1:] == ["--self-test"]:
        result = self_test()
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0 if result["status"] == "PASS" else 1
    try:
        with exclusive_host_semaphore(
            HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300.0
        ) as semaphore:
            result = capture_main()
    except SemaphoreTimeoutError as error:
        print(
            json.dumps(
                {
                    "status": "FAIL",
                    "error": f"HOST_SEMAPHORE_{error.metadata['status']}",
                },
                ensure_ascii=False,
            )
        )
        return 1
    print(
        json.dumps(
            {
                "hostSemaphore": semaphore["name"],
                "semaphoreStatus": semaphore["status"],
                "waitMilliseconds": semaphore["waitMilliseconds"],
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )
    return result


if __name__ == "__main__":
    raise SystemExit(main())
