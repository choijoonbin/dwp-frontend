#!/usr/bin/env python3
"""Run one exact frontend slice test file and emit a fail-closed typed receipt."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any


SLICE_ID = re.compile(r"^(?:BASE-TFR-(?:HRM|PER|PAY|TIM|SYS)-\d{3}|MOD-(?:HRM|PER|PAY|TIM|SYS)-[A-Z0-9-]+)$")
TEST_SUFFIXES = (".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx")
DEFAULT_FRONTEND_PROJECT_DIR = (
    Path(__file__).resolve().parents[3] / ".codex-worktrees/hris/integration/frontend"
)
DEFAULT_NODE = Path(
    "/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
)
DEFAULT_YARN = Path("/opt/homebrew/opt/node@20/bin/yarn")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_argv_sha256(argv: list[str]) -> str:
    return sha256_bytes(json.dumps(argv, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))


def safe_test_path(project_dir: Path, value: str) -> tuple[Path, str]:
    relative = Path(value)
    if (
        not value
        or relative.is_absolute()
        or ".." in relative.parts
        or "__tests__" not in relative.parts
        or not value.endswith(TEST_SUFFIXES)
    ):
        raise ValueError("test path must be one relative __tests__ TypeScript test file")
    root = project_dir.resolve()
    cursor = root
    for part in relative.parts:
        cursor /= part
        if cursor.is_symlink():
            raise ValueError("test path must not contain a symlink")
    target = (root / relative).resolve(strict=False)
    if target == root or root not in target.parents:
        raise ValueError("test path escapes project root")
    return target, relative.as_posix()


def assertion_full_name(assertion: dict[str, Any]) -> str:
    full_name = assertion.get("fullName")
    if isinstance(full_name, str) and full_name:
        return full_name
    ancestors = assertion.get("ancestorTitles", [])
    title = assertion.get("title", "")
    if not isinstance(ancestors, list) or not all(isinstance(item, str) for item in ancestors):
        return ""
    if not isinstance(title, str):
        return ""
    return " ".join([*ancestors, title]).strip()


def validate_vitest_result(
    result: dict[str, Any],
    *,
    project_dir: Path,
    test_path: str,
    slice_id: str,
    exit_code: int,
) -> tuple[list[str], dict[str, int]]:
    errors: list[str] = []
    require = lambda condition, message: None if condition else errors.append(message)
    def exact_integer(field: str) -> int | None:
        value = result.get(field)
        return value if isinstance(value, int) and not isinstance(value, bool) else None
    target, canonical_path = safe_test_path(project_dir, test_path)
    test_results = result.get("testResults")
    require(isinstance(test_results, list) and len(test_results) == 1, "exactly one test file must execute")
    suites = test_results if isinstance(test_results, list) else []
    assertions: list[dict[str, Any]] = []
    exact_file_count = 0
    for suite in suites:
        if not isinstance(suite, dict):
            errors.append("test result suite is not an object")
            continue
        suite_name = suite.get("name") or suite.get("testFilePath")
        if isinstance(suite_name, str):
            observed = Path(suite_name)
            observed = observed.resolve(strict=False) if observed.is_absolute() else (project_dir / observed).resolve(strict=False)
            if observed == target:
                exact_file_count += 1
        suite_assertions = suite.get("assertionResults")
        if not isinstance(suite_assertions, list):
            errors.append("assertionResults missing")
            continue
        assertions.extend(item for item in suite_assertions if isinstance(item, dict))
        if len(assertions) != sum(len(item.get("assertionResults", [])) for item in suites if isinstance(item, dict) and isinstance(item.get("assertionResults"), list)):
            errors.append("assertion result contains a non-object")
    tag = f"[SLICE:{slice_id}]"
    related = [item for item in assertions if tag in assertion_full_name(item)]
    unrelated = [item for item in assertions if tag not in assertion_full_name(item)]
    passed = [item for item in assertions if item.get("status") == "passed"]
    failed = [item for item in assertions if item.get("status") == "failed"]
    skipped = [item for item in assertions if item.get("status") in {"pending", "skipped", "disabled", "todo"}]
    require(exit_code == 0, "Vitest exit code must be zero")
    require(result.get("success") is True, "Vitest JSON result success must be true")
    require(exact_file_count == 1, f"executed test file must equal {canonical_path}")
    require(bool(assertions), "no slice test executed")
    require(len(related) == len(assertions), "unrelated test executed")
    require(len(passed) == len(assertions), "every slice assertion must pass")
    require(not failed and exact_integer("numFailedTests") == 0, "failed slice test present")
    require(not skipped and exact_integer("numPendingTests") == 0, "skipped or pending slice test present")
    require(exact_integer("numTodoTests") == 0, "todo slice test present")
    require(exact_integer("numTotalTests") == len(assertions), "Vitest total test count drift")
    require(exact_integer("numPassedTests") == len(assertions), "Vitest passed test count drift")
    counts = {
        "testFileCount": exact_file_count,
        "executedTestCount": len(assertions),
        "passedTestCount": len(passed),
        "failedTestCount": len(failed),
        "skippedTestCount": len(skipped),
        "unrelatedTestCount": len(unrelated),
    }
    return sorted(set(errors)), counts


def receipt(
    *,
    status: str,
    slice_id: str,
    test_path: str,
    counts: dict[str, int],
    exit_code: int,
    result_bytes: bytes,
    argv: list[str],
    errors: list[str],
) -> dict[str, Any]:
    return {
        "schema": "dwp.hris.g3.frontend-slice-test-gate.v1",
        "status": status,
        "sliceId": slice_id,
        "testPath": test_path,
        **counts,
        "jestExitCode": exit_code,
        "jestResultSha256": sha256_bytes(result_bytes),
        "argvSha256": canonical_argv_sha256(argv),
        "errors": errors,
    }


def valid_typed_receipt(value: object, *, slice_id: str, test_path: str) -> bool:
    if not isinstance(value, dict):
        return False
    fields = {
        "schema", "status", "sliceId", "testPath", "testFileCount",
        "executedTestCount", "passedTestCount", "failedTestCount",
        "skippedTestCount", "unrelatedTestCount", "jestExitCode",
        "jestResultSha256", "argvSha256", "errors",
    }
    integer_fields = (
        "testFileCount", "executedTestCount", "passedTestCount",
        "failedTestCount", "skippedTestCount", "unrelatedTestCount",
        "jestExitCode",
    )
    return (
        set(value) == fields
        and value.get("schema") == "dwp.hris.g3.frontend-slice-test-gate.v1"
        and value.get("status") == "PASS"
        and value.get("sliceId") == slice_id
        and value.get("testPath") == test_path
        and all(
            isinstance(value.get(field), int)
            and not isinstance(value.get(field), bool)
            for field in integer_fields
        )
        and value.get("testFileCount") == 1
        and value.get("executedTestCount", 0) >= 1
        and value.get("passedTestCount") == value.get("executedTestCount")
        and value.get("failedTestCount") == 0
        and value.get("skippedTestCount") == 0
        and value.get("unrelatedTestCount") == 0
        and value.get("jestExitCode") == 0
        and isinstance(value.get("jestResultSha256"), str)
        and bool(re.fullmatch(r"[0-9a-f]{64}", value["jestResultSha256"]))
        and isinstance(value.get("argvSha256"), str)
        and bool(re.fullmatch(r"[0-9a-f]{64}", value["argvSha256"]))
        and value.get("errors") == []
    )


def sample_vitest_result(project_dir: Path, test_path: str, slice_id: str) -> dict[str, Any]:
    return {
        "success": True,
        "numTotalTests": 1,
        "numPassedTests": 1,
        "numFailedTests": 0,
        "numPendingTests": 0,
        "numTodoTests": 0,
        "testResults": [
            {
                "name": str((project_dir / test_path).resolve()),
                "assertionResults": [
                    {
                        "ancestorTitles": [f"[SLICE:{slice_id}]"],
                        "title": "executes the exact slice contract",
                        "fullName": f"[SLICE:{slice_id}] executes the exact slice contract",
                        "status": "passed",
                    }
                ],
            }
        ],
    }


def build_vitest_argv(
    *,
    node: Path,
    yarn: Path,
    test_path: str,
    slice_id: str,
    output_path: Path,
) -> list[str]:
    return [
        str(node),
        str(yarn),
        "test",
        test_path,
        "--testNamePattern",
        rf"\[SLICE:{re.escape(slice_id)}\]",
        "--reporter=json",
        "--outputFile",
        str(output_path),
        "--maxWorkers=2",
        "--maxConcurrency=1",
    ]


def actual_vitest_integration_self_test(
    *,
    frontend_project_dir: Path = DEFAULT_FRONTEND_PROJECT_DIR,
    node: Path = DEFAULT_NODE,
    yarn: Path = DEFAULT_YARN,
) -> dict[str, Any]:
    """Exercise the production argv against the installed Yarn/Vitest, not a forged JSON result."""

    runtime_modules = frontend_project_dir.resolve() / "node_modules"
    if not frontend_project_dir.is_dir() or not runtime_modules.is_dir():
        raise ValueError("canonical frontend integration runtime is unavailable")
    if not node.is_absolute() or not yarn.is_absolute() or not node.is_file() or not yarn.is_file():
        raise ValueError("canonical node/yarn executable is unavailable")

    slice_id = "BASE-TFR-SYS-999"
    test_path = (
        "apps/dwp/src/features/hris/verification/__tests__/g3-slices/"
        "base-tfr-sys-999.slice.test.ts"
    )
    with tempfile.TemporaryDirectory(prefix="hris-fe-slice-vite-integration-") as directory:
        root = Path(directory)
        # Reuse the installed project's exact package/lock/runtime identity so
        # Yarn executes the same Vitest version without installing or mutating
        # either repository.  All copied metadata and the module link live only
        # inside the owned temporary directory.
        for metadata in ("package.json", "yarn.lock", ".yarnrc.yml"):
            source = frontend_project_dir.resolve() / metadata
            if not source.is_file() or source.is_symlink():
                raise ValueError(f"canonical frontend {metadata} is unavailable")
            (root / metadata).write_bytes(source.read_bytes())
        (root / "node_modules").symlink_to(runtime_modules, target_is_directory=True)
        target = root / test_path
        target.parent.mkdir(parents=True)
        target.write_text(
            "import { describe, expect, it } from 'vitest';\n"
            f"describe('[SLICE:{slice_id}]', () => {{\n"
            "  it('executes through the installed Vitest JSON reporter', () => {\n"
            "    expect({ runner: 'vitest', isolated: true }).toEqual({ runner: 'vitest', isolated: true });\n"
            "  });\n"
            "});\n",
            encoding="utf-8",
        )
        result = execute(
            argparse.Namespace(
                project_dir=str(root),
                node=str(node),
                yarn=str(yarn),
                test_path=test_path,
                slice_id=slice_id,
            )
        )
    return result


def self_test() -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="hris-fe-slice-gate-") as directory:
        root = Path(directory)
        test_path = "apps/dwp/src/features/hris/people/__tests__/g3-slices/base-tfr-hrm-001.slice.test.tsx"
        target = root / test_path
        target.parent.mkdir(parents=True)
        target.write_text("// synthetic self-test only\n", encoding="utf-8")
        slice_id = "BASE-TFR-HRM-001"
        canonical = sample_vitest_result(root, test_path, slice_id)

        def rejected(mutate: Any, *, exit_code: int = 0, path: str = test_path, identity: str = slice_id) -> bool:
            value = copy.deepcopy(canonical)
            mutate(value)
            try:
                errors, _counts = validate_vitest_result(value, project_dir=root, test_path=path, slice_id=identity, exit_code=exit_code)
                return bool(errors)
            except ValueError:
                return True

        errors, counts = validate_vitest_result(canonical, project_dir=root, test_path=test_path, slice_id=slice_id, exit_code=0)
        valid = receipt(status="PASS", slice_id=slice_id, test_path=test_path, counts=counts, exit_code=0, result_bytes=b"{}", argv=["node", "yarn"], errors=[])
        forged_boolean_count = copy.deepcopy(valid)
        forged_boolean_count["executedTestCount"] = True
        forged_boolean_count["passedTestCount"] = True
        cases = {
            "exact-slice-pass-accepted": not errors,
            "typed-pass-receipt-accepted": valid_typed_receipt(valid, slice_id=slice_id, test_path=test_path),
            "boolean-count-receipt-rejected": not valid_typed_receipt(forged_boolean_count, slice_id=slice_id, test_path=test_path),
            "wrong-slice-id-rejected": rejected(lambda value: None, identity="BASE-TFR-HRM-002"),
            "no-tests-rejected": rejected(lambda value: value.update({"numTotalTests": 0, "numPassedTests": 0, "testResults": []})),
            "skipped-test-rejected": rejected(lambda value: value["testResults"][0]["assertionResults"][0].update({"status": "pending"})),
            "todo-test-rejected": rejected(
                lambda value: (
                    value.update({"numTodoTests": 1}),
                    value["testResults"][0]["assertionResults"][0].update({"status": "todo"}),
                )
            ),
            "failed-test-rejected": rejected(lambda value: value["testResults"][0]["assertionResults"][0].update({"status": "failed"}), exit_code=1),
            "unrelated-test-rejected": rejected(lambda value: value["testResults"][0]["assertionResults"][0].update({"fullName": "unrelated test", "ancestorTitles": []})),
            "wrong-test-path-rejected": rejected(lambda value: None, path="apps/dwp/src/features/hris/people/__tests__/g3-slices/other.slice.test.tsx"),
            "multi-file-run-rejected": rejected(lambda value: value["testResults"].append(copy.deepcopy(value["testResults"][0]))),
            "nonzero-exit-rejected": rejected(lambda value: None, exit_code=1),
        }
        try:
            execute(
                argparse.Namespace(
                    project_dir=str(root),
                    node=str(DEFAULT_NODE),
                    yarn=str(DEFAULT_YARN),
                    test_path=(
                        "apps/dwp/src/features/hris/people/__tests__/g3-slices/"
                        "missing.slice.test.tsx"
                    ),
                    slice_id=slice_id,
                )
            )
        except ValueError as error:
            cases["missing-test-file-rejected"] = "missing or symlinked" in str(error)
        else:
            cases["missing-test-file-rejected"] = False
        symlink_path = (
            root
            / "apps/dwp/src/features/hris/people/__tests__/g3-slices/"
            / "linked.slice.test.tsx"
        )
        symlink_path.symlink_to(target)
        try:
            safe_test_path(root, symlink_path.relative_to(root).as_posix())
        except ValueError as error:
            cases["symlink-test-file-rejected"] = "symlink" in str(error)
        else:
            cases["symlink-test-file-rejected"] = False
    try:
        integration = actual_vitest_integration_self_test()
        cases["actual-yarn-vitest-json-runner-pass"] = valid_typed_receipt(
            integration,
            slice_id="BASE-TFR-SYS-999",
            test_path=(
                "apps/dwp/src/features/hris/verification/__tests__/g3-slices/"
                "base-tfr-sys-999.slice.test.ts"
            ),
        )
    except (OSError, ValueError, subprocess.TimeoutExpired) as error:
        integration = {"status": "FAIL", "errors": [str(error)]}
        cases["actual-yarn-vitest-json-runner-pass"] = False
    return {
        "schema": "dwp.hris.g3.frontend-slice-test-gate-self-test.v1",
        "status": "PASS" if all(cases.values()) else "FAIL",
        "caseCount": len(cases),
        "passedCount": sum(cases.values()),
        "cases": cases,
        "actualRunner": integration,
    }


def execute(args: argparse.Namespace) -> dict[str, Any]:
    if not SLICE_ID.fullmatch(args.slice_id):
        raise ValueError("invalid slice ID")
    project_dir = Path(args.project_dir).resolve()
    target, test_path = safe_test_path(project_dir, args.test_path)
    if not target.is_file() or target.is_symlink():
        raise ValueError("exact frontend slice test file is missing or symlinked")
    node = Path(args.node)
    yarn = Path(args.yarn)
    if not node.is_absolute() or not yarn.is_absolute() or not node.is_file() or not yarn.is_file():
        raise ValueError("node/yarn executable path is missing or not absolute")
    descriptor, output_name = tempfile.mkstemp(prefix="hris-fe-slice-vitest-", suffix=".json")
    os.close(descriptor)
    output_path = Path(output_name)
    argv = build_vitest_argv(
        node=node,
        yarn=yarn,
        test_path=test_path,
        slice_id=args.slice_id,
        output_path=output_path,
    )
    try:
        completed = subprocess.run(
            argv,
            cwd=project_dir,
            env={**os.environ, "CI": "true", "TZ": "UTC", "LANG": "C", "LC_ALL": "C"},
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=1800,
            check=False,
            shell=False,
        )
        result_bytes = output_path.read_bytes() if output_path.is_file() else b""
        try:
            result = json.loads(result_bytes)
        except json.JSONDecodeError:
            result = {}
        errors, counts = validate_vitest_result(
            result if isinstance(result, dict) else {},
            project_dir=project_dir,
            test_path=test_path,
            slice_id=args.slice_id,
            exit_code=completed.returncode,
        )
        return receipt(
            status="PASS" if not errors else "FAIL",
            slice_id=args.slice_id,
            test_path=test_path,
            counts=counts,
            exit_code=completed.returncode,
            result_bytes=result_bytes,
            argv=argv,
            errors=errors,
        )
    finally:
        output_path.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-dir")
    parser.add_argument("--node")
    parser.add_argument("--yarn")
    parser.add_argument("--test-path")
    parser.add_argument("--slice-id")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    try:
        if args.self_test:
            result = self_test()
        else:
            if not all((args.project_dir, args.node, args.yarn, args.test_path, args.slice_id)):
                parser.error("normal mode requires --project-dir --node --yarn --test-path --slice-id")
            result = execute(args)
    except (OSError, ValueError, subprocess.TimeoutExpired) as error:
        result = {"schema": "dwp.hris.g3.frontend-slice-test-gate.v1", "status": "FAIL", "errors": [str(error)]}
    print(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":") if args.compact else None, indent=None if args.compact else 2))
    return 0 if result.get("status") == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
