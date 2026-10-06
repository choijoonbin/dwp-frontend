#!/usr/bin/env python3
"""Run a Gradle test task with fresh, exact JUnit-result requirements.

Database suites additionally require a live PostgreSQL 16 container runtime. Pure
contract suites explicitly select ``NONE`` so they still get a non-UP-TO-DATE
Gradle execution and exact XML closure without claiming a Docker dependency.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import tempfile
import time
import xml.etree.ElementTree as ET
from pathlib import Path


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def parse_requirement(value: str) -> tuple[str, str]:
    if value.count("#") != 1:
        raise ValueError("required test must be fully.qualified.Class#method")
    class_name, method = value.split("#", 1)
    if not class_name or not method:
        raise ValueError("required test class/method is blank")
    return class_name, method


def canonical_junit_method_name(value: str) -> str:
    """Normalize only Gradle/JUnit's zero-argument display suffix."""
    return value[:-2] if value.endswith("()") and "(" not in value[:-2] else value


def validate_junit_results(
    result_root: Path,
    requirements: set[tuple[str, str]],
    *,
    not_before_epoch: float | None = None,
) -> list[str]:
    errors: list[str] = []
    observed: dict[tuple[str, str], int] = {}
    observed_in_required_classes: dict[tuple[str, str], int] = {}
    required_classes = {class_name for class_name, _method in requirements}
    matching_suite_count = 0
    for path in sorted(result_root.glob("TEST-*.xml")):
        if not_before_epoch is not None and path.stat().st_mtime + 1 < not_before_epoch:
            errors.append(f"stale JUnit XML predates this execution: {path.name}")
        try:
            root = ET.parse(path).getroot()
        except (ET.ParseError, OSError) as error:
            errors.append(f"unreadable JUnit XML {path.name}: {error}")
            continue
        suites = [root] if root.tag == "testsuite" else list(root.findall("testsuite"))
        for suite in suites:
            cases = list(suite.findall("testcase"))
            if any(
                (
                    case.get("classname", ""),
                    canonical_junit_method_name(case.get("name", "")),
                ) in requirements
                for case in cases
            ):
                matching_suite_count += 1
                for field in ("failures", "errors", "skipped"):
                    try:
                        count = int(suite.get(field, "0"))
                    except ValueError:
                        count = -1
                    if count != 0:
                        errors.append(f"JUnit suite {suite.get('name', '')} has {field}={count}")
            for case in cases:
                key = (
                    case.get("classname", ""),
                    canonical_junit_method_name(case.get("name", "")),
                )
                if key[0] in required_classes:
                    observed_in_required_classes[key] = (
                        observed_in_required_classes.get(key, 0) + 1
                    )
                if key not in requirements:
                    continue
                observed[key] = observed.get(key, 0) + 1
                if case.find("failure") is not None or case.find("error") is not None:
                    errors.append(f"required test failed: {key[0]}#{key[1]}")
                if case.find("skipped") is not None:
                    errors.append(f"required test skipped: {key[0]}#{key[1]}")
    if matching_suite_count == 0:
        errors.append("no JUnit suite contains a required test")
    for key in sorted(requirements):
        if observed.get(key) != 1:
            errors.append(
                f"required test occurrence is {observed.get(key, 0)}, expected 1: {key[0]}#{key[1]}"
            )
    extras = set(observed_in_required_classes) - requirements
    if extras:
        errors.append(f"unexpected test in required class set: {sorted(extras)}")
    return errors


def run_gate(
    project_dir: Path,
    task: str,
    required_values: list[str],
    runtime_preflight: str,
) -> dict[str, object]:
    requirements = {parse_requirement(value) for value in required_values}
    if len(requirements) != len(required_values) or not requirements:
        raise ValueError("required test set is empty or duplicated")
    if runtime_preflight not in {"NONE", "POSTGRES_16"}:
        raise ValueError("runtime preflight must be NONE or POSTGRES_16")
    docker_server_digest = ""
    postgres_image_digest = ""
    if runtime_preflight == "POSTGRES_16":
        docker = subprocess.run(
            ["docker", "info", "--format", "{{.ServerVersion}}"],
            cwd=project_dir, capture_output=True, text=True, check=False, shell=False,
            timeout=30,
        )
        if docker.returncode != 0 or not docker.stdout.strip():
            raise ValueError(
                "Docker preflight failed; skip-capable database tests are forbidden"
            )
        docker_server_digest = sha256_text(docker.stdout.strip())
    classes = sorted({class_name for class_name, _method in requirements})
    argv = ["./gradlew", task]
    for class_name in classes:
        argv.extend(["--tests", class_name])
    argv.extend(["--rerun-tasks", "--no-build-cache", "--no-daemon"])
    started_epoch = time.time()
    completed = subprocess.run(
        argv, cwd=project_dir, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        check=False, shell=False, timeout=1800,
    )
    if completed.returncode != 0:
        raise ValueError(f"Gradle required-test gate failed rc={completed.returncode}")
    module = task.split(":")[1] if task.startswith(":") and task.count(":") >= 2 else ""
    result_root = project_dir / module / "build/test-results/test"
    errors = validate_junit_results(
        result_root, requirements, not_before_epoch=started_epoch
    )
    if errors:
        raise ValueError("; ".join(errors))
    if runtime_preflight == "POSTGRES_16":
        image = subprocess.run(
            ["docker", "image", "inspect", "postgres:16-alpine", "--format", "{{.Id}}"],
            cwd=project_dir, capture_output=True, text=True, check=False, shell=False,
            timeout=30,
        )
        if image.returncode != 0 or not image.stdout.strip().startswith("sha256:"):
            raise ValueError(
                "required PostgreSQL 16 container image identity is unavailable"
            )
        postgres_image_digest = sha256_text(image.stdout.strip())
    return {
        "schema": "dwp.hris.required-gradle-test-gate.v1",
        "status": "PASS",
        "runtimePreflight": runtime_preflight,
        "dockerServerVersionSha256": docker_server_digest,
        "postgres16ImageIdSha256": postgres_image_digest,
        "gradleArgvSha256": sha256_text(json.dumps(argv, separators=(",", ":"))),
        "requiredTestCount": len(requirements),
        "junitResultRoot": str(result_root.relative_to(project_dir)),
        "failures": 0,
        "errors": 0,
        "skipped": 0,
    }


def self_test() -> dict[str, object]:
    class_name = "example.RequiredPostgresTest"
    required = {(class_name, "databaseBehavior")}
    cases: dict[str, bool] = {}
    with tempfile.TemporaryDirectory(prefix="hris-junit-gate-") as temporary:
        root = Path(temporary)
        good = (
            '<testsuite name="example.RequiredPostgresTest" tests="1" failures="0" errors="0" skipped="0">'
            f'<testcase classname="{class_name}" name="databaseBehavior()"/></testsuite>'
        )
        path = root / "TEST-example.RequiredPostgresTest.xml"
        path.write_text(good, encoding="utf-8")
        cases["exact-required-test-pass"] = not validate_junit_results(root, required)
        path.write_text(good.replace('skipped="0"', 'skipped="1"').replace("/></testsuite>", "><skipped/></testcase></testsuite>"), encoding="utf-8")
        cases["exit-zero-skipped-test-rejected"] = bool(validate_junit_results(root, required))
        path.write_text(good.replace("databaseBehavior()", "otherBehavior()"), encoding="utf-8")
        cases["missing-required-method-rejected"] = bool(validate_junit_results(root, required))
        path.write_text(good.replace("/></testsuite>", f'/><testcase classname="{class_name}" name="unexpectedBehavior"/></testsuite>'), encoding="utf-8")
        cases["extra-or-renamed-method-rejected"] = bool(validate_junit_results(root, required))
        path.write_text(good.replace("databaseBehavior()", "databaseBehavior(String)"), encoding="utf-8")
        cases["parameterized-display-name-not-normalized"] = bool(
            validate_junit_results(root, required)
        )
        path.write_text(good.replace("/></testsuite>", f'/><testcase classname="{class_name}" name="databaseBehavior"/></testsuite>'), encoding="utf-8")
        cases["duplicate-required-method-rejected"] = bool(validate_junit_results(root, required))
        path.write_text(good, encoding="utf-8")
        os.utime(path, (1, 1))
        cases["stale-junit-result-rejected"] = bool(
            validate_junit_results(root, required, not_before_epoch=time.time())
        )
    return {
        "schema": "dwp.hris.required-gradle-test-gate-self-test.v1",
        "status": "PASS" if all(cases.values()) else "FAIL",
        "caseCount": len(cases), "passedCount": sum(cases.values()), "cases": cases,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-dir", default=".")
    parser.add_argument("--task")
    parser.add_argument("--required-test", action="append", default=[])
    parser.add_argument(
        "--runtime-preflight",
        choices=("NONE", "POSTGRES_16"),
        default="POSTGRES_16",
    )
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    try:
        result = self_test() if args.self_test else run_gate(
            Path(args.project_dir).resolve(),
            str(args.task or ""),
            args.required_test,
            args.runtime_preflight,
        )
    except (OSError, ValueError, subprocess.TimeoutExpired) as error:
        result = {
            "schema": "dwp.hris.required-gradle-test-gate.v1",
            "status": "FAIL", "error": str(error),
        }
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0 if result.get("status") == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
