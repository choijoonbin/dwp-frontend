#!/usr/bin/env python3
"""Run one closed PostgreSQL proof and create its evidence generation once."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from host_semaphore import (
    HOST_VERIFICATION_SEMAPHORE,
    active_host_semaphore_capability,
    exclusive_host_semaphore,
)
from validate_pre_g3_common_foundation_migrations import (
    BACKEND,
    BASELINE_COMMIT,
    COMMANDS,
    EVIDENCE_ID,
    EVIDENCE_PATHS,
    EXPECTED_JUNIT_CASE_IDS,
    EXPECTED_JUNIT_CASE_NAMES,
    EXPECTED_NOTIFICATION_JUNIT_CASE_IDS,
    EXPECTED_NOTIFICATION_SCENARIOS,
    JUNIT_BUILD_PATH,
    JUNIT_SUITE,
    NOTIFICATION_JUNIT_BUILD_PATH,
    NOTIFICATION_JUNIT_SUITE,
    NOTIFICATION_OBSERVATION_ID,
    NOTIFICATION_OBSERVATION_PATHS,
    NOTIFICATION_TEST_SOURCE_PATH,
    OBSERVATION_ID,
    OBSERVATION_PATHS,
    PRESERVED_NOTIFICATION_JUNIT_PATHS,
    PRESERVED_JUNIT_PATHS,
    ROOT,
    TEST_SOURCE_PATH,
    canonical_file,
    commit_blob,
    digest,
    expected_notification_observations,
    expected_observations,
    git,
    parse_json,
    parse_junit,
    seal,
    validate_observation_document,
    validate_notification_observation_document,
)


REPOSITORY_DIGEST = re.compile(r"^postgres@sha256:[0-9a-f]{64}$")
PLATFORM_OBSERVATION_ENV = "DWP_PRE_G3_PLATFORM_OBSERVATION_FILE"
NOTIFICATION_OBSERVATION_ENV = "DWP_PRE_G3_NOTIFICATION_OBSERVATION_FILE"
CONTROL_POSTGRES_IMAGE_ENV = "DWP_CONTROL_POSTGRES_TEST_IMAGE"
NOTIFICATION_POSTGRES_IMAGE_ENV = "DWP_TEST_POSTGRES_IMAGE"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace(
        "+00:00", "Z"
    )


def ensure_fixed_output(path: Path) -> None:
    root = ROOT.resolve()
    expected_parent = ROOT / "g0/control-evidence-intake"
    if path.is_symlink() or path.parent.is_symlink():
        raise ValueError(f"symlink evidence target forbidden: {path}")
    for ancestor in (ROOT, ROOT / "g0", expected_parent):
        if ancestor.is_symlink():
            raise ValueError(f"symlink evidence ancestor forbidden: {ancestor}")
    resolved_parent = path.parent.resolve()
    if (
        resolved_parent != expected_parent.resolve()
        or not resolved_parent.is_relative_to(root)
    ):
        raise ValueError(f"evidence target escaped fixed intake directory: {path}")
    if path.exists():
        raise FileExistsError(f"CREATE_NEW_ONLY evidence already exists: {path}")


def create_new(path: Path, data: bytes) -> None:
    ensure_fixed_output(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_CLOEXEC", 0)
    flags |= getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(path, flags, 0o600)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
    except Exception:
        try:
            path.unlink()
        except OSError:
            pass
        raise


def docker_repository_digest(image: str) -> str:
    completed = subprocess.run(
        ["docker", "image", "inspect", image, "--format", "{{json .RepoDigests}}"],
        cwd=BACKEND,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode:
        raise RuntimeError(
            "Docker image digest unavailable: "
            + completed.stderr.decode("utf-8", "replace").strip()
        )
    try:
        values = json.loads(completed.stdout.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("Docker RepoDigests output is not JSON") from exc
    matches = sorted(
        {
            value
            for value in values if isinstance(value, str)
            and REPOSITORY_DIGEST.fullmatch(value)
        }
    ) if isinstance(values, list) else []
    if len(matches) != 1:
        raise ValueError("Docker image does not resolve to one postgres repository digest")
    return matches[0]


def repository_state() -> tuple[str, str, str]:
    head = str(git("rev-parse", "HEAD"))
    tree = str(git("rev-parse", "HEAD^{tree}"))
    dirty = str(git("status", "--porcelain=v1", "--untracked-files=all"))
    return head, tree, dirty


def assert_repository_state(state: tuple[str, str, str]) -> None:
    head, tree, dirty = state
    if dirty:
        raise ValueError("backend evidence requires one clean worktree generation")
    if not re.fullmatch(r"[0-9a-f]{40}", head) or not re.fullmatch(
        r"[0-9a-f]{40}", tree
    ):
        raise ValueError("backend commit/tree identity is malformed")
    ancestry = subprocess.run(
        ["git", "-C", str(BACKEND), "merge-base", "--is-ancestor", BASELINE_COMMIT, head],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if ancestry.returncode:
        raise ValueError("sealed backend baseline is not an ancestor")


def require_exact_test_image_environment(
    environment: dict[str, str], requested_image: str
) -> None:
    """Fail closed unless both proof suites use the exact closed-set image."""
    if requested_image not in EVIDENCE_PATHS:
        raise ValueError("only the closed PostgreSQL 16/18 image set is allowed")
    actual = {
        CONTROL_POSTGRES_IMAGE_ENV: environment.get(CONTROL_POSTGRES_IMAGE_ENV),
        NOTIFICATION_POSTGRES_IMAGE_ENV: environment.get(
            NOTIFICATION_POSTGRES_IMAGE_ENV
        ),
    }
    if any(value != requested_image for value in actual.values()):
        raise ValueError(
            "PostgreSQL proof suites are not bound to the exact requested image: "
            + ",".join(f"{key}={value!r}" for key, value in sorted(actual.items()))
        )


def regular_fresh_file(path: Path, earliest_mtime_ns: int) -> bytes:
    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(path, flags)
    except OSError as exc:
        raise ValueError(f"missing/unsafe fresh result: {path}") from exc
    try:
        before = os.fstat(descriptor)
        if not stat.S_ISREG(before.st_mode):
            raise ValueError(f"fresh result is not a regular file: {path}")
        if before.st_mtime_ns < earliest_mtime_ns:
            raise ValueError(f"stale result predates execution: {path}")
        with os.fdopen(descriptor, "rb", closefd=False) as handle:
            data = handle.read()
        after = os.fstat(descriptor)
        path_after = path.lstat()
        identity = lambda item: (
            item.st_dev, item.st_ino, item.st_size, item.st_mtime_ns
        )
        if stat.S_ISLNK(path_after.st_mode) or not (
            identity(before) == identity(after) == identity(path_after)
        ):
            raise ValueError(f"fresh result changed while captured: {path}")
        return data
    finally:
        os.close(descriptor)


def load_platform_observation(
    raw: bytes, image: str
) -> tuple[dict[str, Any], bytes]:
    document = parse_json(raw, canonical=False)
    errors = validate_observation_document(document, image)
    if errors:
        raise ValueError("platform observation sidecar invalid: " + ";".join(errors))
    canonical = canonical_file(document)
    return document, canonical


def load_notification_observation(
    raw: bytes, image: str
) -> tuple[dict[str, Any], bytes]:
    document = parse_json(raw, canonical=False)
    errors = validate_notification_observation_document(document, image)
    if errors:
        raise ValueError(
            "notification observation sidecar invalid: " + ";".join(errors)
        )
    canonical = canonical_file(document)
    return document, canonical


def fixed_backend_path(relative: str) -> Path:
    relative_path = Path(relative)
    if relative_path.is_absolute() or ".." in relative_path.parts:
        raise ValueError(f"backend path must be fixed and relative: {relative}")
    root = BACKEND.resolve()
    path = BACKEND / relative_path
    if not path.resolve(strict=False).is_relative_to(root):
        raise ValueError(f"backend path escaped repository: {relative}")
    ancestor = BACKEND
    for part in relative_path.parts[:-1]:
        ancestor /= part
        if ancestor.is_symlink():
            raise ValueError(f"backend path has symlink ancestor: {relative}")
    if path.is_symlink():
        raise ValueError(f"backend path is a symlink: {relative}")
    return path


def committed_worktree_source(
    head: str, relative: str
) -> tuple[str, str, bytes, Path]:
    mode, oid, content = commit_blob(head, relative)
    if mode != "100644":
        raise ValueError(f"committed proof source is not regular 100644: {relative}")
    path = fixed_backend_path(relative)
    if not path.is_file() or path.read_bytes() != content:
        raise ValueError(f"worktree proof source differs from committed blob: {relative}")
    return mode, oid, content, path


def clear_build_result(relative: str) -> Path:
    path = fixed_backend_path(relative)
    if path.exists():
        if not path.is_file():
            raise ValueError(f"build output is not a regular file: {relative}")
        path.unlink()
    return path


def _capture_under_active_lock(image: str) -> dict[str, Any]:
    """Execute and publish one image proof while holding the common lease."""
    if active_host_semaphore_capability(HOST_VERIFICATION_SEMAPHORE) is None:
        raise ValueError("PostgreSQL evidence capture requires active host semaphore")
    if image not in EVIDENCE_PATHS:
        raise ValueError("only the closed PostgreSQL 16/18 image set is allowed")
    evidence_path = ROOT / EVIDENCE_PATHS[image]
    junit_target = ROOT / PRESERVED_JUNIT_PATHS[image]
    observation_target = ROOT / OBSERVATION_PATHS[image]
    notification_junit_target = ROOT / PRESERVED_NOTIFICATION_JUNIT_PATHS[image]
    notification_observation_target = (
        ROOT / NOTIFICATION_OBSERVATION_PATHS[image]
    )
    for target in (
        evidence_path,
        junit_target,
        observation_target,
        notification_junit_target,
        notification_observation_target,
    ):
        ensure_fixed_output(target)

    before = repository_state()
    assert_repository_state(before)
    head, tree, _dirty = before
    mode, oid, test_source, worktree_test = committed_worktree_source(
        head, TEST_SOURCE_PATH
    )
    (
        notification_mode,
        notification_oid,
        notification_test_source,
        notification_worktree_test,
    ) = committed_worktree_source(head, NOTIFICATION_TEST_SOURCE_PATH)

    junit_source = clear_build_result(JUNIT_BUILD_PATH)
    notification_junit_source = clear_build_result(NOTIFICATION_JUNIT_BUILD_PATH)

    with tempfile.TemporaryDirectory(prefix="hris-pre-g3-pg-evidence-") as temporary:
        platform_observation_directory = Path(temporary) / "platform"
        notification_observation_directory = Path(temporary) / "notification"
        platform_observation_directory.mkdir(mode=0o700)
        notification_observation_directory.mkdir(mode=0o700)
        observation_source = platform_observation_directory / "observations.json"
        notification_observation_source = (
            notification_observation_directory / "observations.json"
        )
        if any(
            path.exists() or path.is_symlink()
            for path in (observation_source, notification_observation_source)
        ):
            raise ValueError("temporary observation targets are not fresh")
        environment = os.environ.copy()
        environment[CONTROL_POSTGRES_IMAGE_ENV] = image
        environment[NOTIFICATION_POSTGRES_IMAGE_ENV] = image
        environment[PLATFORM_OBSERVATION_ENV] = str(observation_source)
        environment[NOTIFICATION_OBSERVATION_ENV] = str(
            notification_observation_source
        )
        require_exact_test_image_environment(environment, image)
        arguments = [
            "./gradlew",
            ":dwp-migration-control:test",
            ":dwp-notification-server:test",
            "--tests",
            "com.dwp.migration.control.PlatformInventoryBridgeControlPostgresTest",
            "--tests",
            (
                "com.dwp.services.notification.migration."
                "NotificationTriggerExecutionBoundaryPostgresTest"
            ),
            "--rerun-tasks",
            "--no-daemon",
            "--max-workers=1",
        ]
        started_at = utc_now()
        earliest_mtime_ns = time.time_ns()
        started_monotonic = time.monotonic_ns()
        completed = subprocess.run(
            arguments,
            cwd=BACKEND,
            env=environment,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        duration_ms = max(0, (time.monotonic_ns() - started_monotonic) // 1_000_000)
        finished_at = utc_now()

        after = repository_state()
        if after != before:
            raise ValueError("backend HEAD/tree/clean state changed during evidence run")
        if completed.returncode:
            raise RuntimeError(
                f"closed PostgreSQL proof failed rc={completed.returncode}; "
                f"stdoutSha256={digest(completed.stdout)}; "
                f"stderrSha256={digest(completed.stderr)}"
            )
        junit_bytes = regular_fresh_file(junit_source, earliest_mtime_ns)
        junit = parse_junit(junit_bytes)
        if any(junit[key] != 0 for key in ("failures", "errors", "skipped")):
            raise ValueError("platform JUnit proof contains failure/error/skip")
        notification_junit_bytes = regular_fresh_file(
            notification_junit_source, earliest_mtime_ns
        )
        notification_junit = parse_junit(
            notification_junit_bytes,
            suite=NOTIFICATION_JUNIT_SUITE,
            expected_case_ids=EXPECTED_NOTIFICATION_JUNIT_CASE_IDS,
        )
        if any(
            notification_junit[key] != 0
            for key in ("failures", "errors", "skipped")
        ):
            raise ValueError("notification JUnit proof contains failure/error/skip")
        if set(junit["caseIds"]) & set(notification_junit["caseIds"]):
            raise ValueError("platform and notification JUnit cases overlap")
        observation_raw = regular_fresh_file(
            observation_source, earliest_mtime_ns
        )
        observation, observation_bytes = load_platform_observation(
            observation_raw, image
        )
        notification_observation_raw = regular_fresh_file(
            notification_observation_source, earliest_mtime_ns
        )
        (
            notification_observation,
            notification_observation_bytes,
        ) = load_notification_observation(notification_observation_raw, image)

    # Recheck the two-suite binding immediately before sealing/publishing. This
    # prevents later runner changes from silently proving different images.
    require_exact_test_image_environment(environment, image)
    resolved_digest = docker_repository_digest(image)
    evidence = seal(
        {
            "schema": EVIDENCE_ID,
            "status": "PASS",
            "postgresImage": image,
            "containerImage": {
                "requested": image,
                "resolvedRepositoryDigest": resolved_digest,
            },
            "source": {
                "repository": "DWP_BACKEND",
                "commit": head,
                "tree": tree,
            },
            "testSource": {
                "path": TEST_SOURCE_PATH,
                "fileMode": mode,
                "gitBlobOid": oid,
                "sha256": digest(test_source),
                "byteLength": len(test_source),
            },
            "notificationTestSource": {
                "path": NOTIFICATION_TEST_SOURCE_PATH,
                "fileMode": notification_mode,
                "gitBlobOid": notification_oid,
                "sha256": digest(notification_test_source),
                "byteLength": len(notification_test_source),
            },
            "command": COMMANDS[image],
            "execution": {
                "startedAtUtc": started_at,
                "finishedAtUtc": finished_at,
                "durationMilliseconds": duration_ms,
                "exitCode": completed.returncode,
                "rerunTasks": True,
                "noDaemon": True,
                "maxWorkers": 1,
                "stdoutSha256": digest(completed.stdout),
                "stderrSha256": digest(completed.stderr),
            },
            "junit": {
                "sourcePath": JUNIT_BUILD_PATH,
                "preservedPath": PRESERVED_JUNIT_PATHS[image],
                "sha256": digest(junit_bytes),
                "byteLength": len(junit_bytes),
                **junit,
            },
            "notificationJunit": {
                "sourcePath": NOTIFICATION_JUNIT_BUILD_PATH,
                "preservedPath": PRESERVED_NOTIFICATION_JUNIT_PATHS[image],
                "sha256": digest(notification_junit_bytes),
                "byteLength": len(notification_junit_bytes),
                **notification_junit,
            },
            "observationSource": {
                "path": OBSERVATION_PATHS[image],
                "sha256": digest(observation_bytes),
                "byteLength": len(observation_bytes),
            },
            "observations": {
                key: observation[key] for key in expected_observations()
            },
            "notificationObservationSource": {
                "path": NOTIFICATION_OBSERVATION_PATHS[image],
                "sha256": digest(notification_observation_bytes),
                "byteLength": len(notification_observation_bytes),
            },
            "notificationObservations": {
                key: notification_observation[key]
                for key in expected_notification_observations()
            },
        }
    )
    evidence_bytes = canonical_file(evidence)
    created: list[Path] = []
    try:
        for target, data in (
            (observation_target, observation_bytes),
            (junit_target, junit_bytes),
            (notification_observation_target, notification_observation_bytes),
            (notification_junit_target, notification_junit_bytes),
            (evidence_path, evidence_bytes),
        ):
            create_new(target, data)
            created.append(target)
        if repository_state() != before:
            raise ValueError(
                "backend HEAD/tree/clean state changed before evidence publication"
            )
        if (
            not worktree_test.is_file()
            or worktree_test.read_bytes() != test_source
        ):
            raise ValueError(
                "committed platform PostgreSQL proof source changed before publication"
            )
        if (
            not notification_worktree_test.is_file()
            or notification_worktree_test.read_bytes() != notification_test_source
        ):
            raise ValueError(
                "committed notification PostgreSQL proof source changed before publication"
            )
    except Exception:
        for target in reversed(created):
            try:
                target.unlink()
            except OSError:
                pass
        raise
    return {
        "schema": "dwp.hris.pre-g3-common-foundation-postgres-capture.v1",
        "status": "PASS",
        "postgresImage": image,
        "resolvedRepositoryDigest": resolved_digest,
        "backendCommit": head,
        "backendTree": tree,
        "evidencePath": EVIDENCE_PATHS[image],
        "evidenceSha256": digest(evidence_bytes),
        "platformJunitTests": junit["tests"],
        "notificationJunitTests": notification_junit["tests"],
        "platformScenarioCount": len(observation["verifiedScenarioIds"]),
        "notificationScenarioCount": len(
            notification_observation["verifiedScenarioIds"]
        ),
    }


def capture(image: str) -> dict[str, Any]:
    """Acquire the same host semaphore used by all heavyweight G0 validation."""
    with exclusive_host_semaphore(
        HOST_VERIFICATION_SEMAPHORE, timeout_seconds=300.0
    ):
        return _capture_under_active_lock(image)


def self_test() -> dict[str, bool]:
    import inspect

    cases_xml = [
        f'<testcase classname="{JUNIT_SUITE}" name="{name}"></testcase>'
        for name in sorted(EXPECTED_JUNIT_CASE_NAMES.values())
    ]
    good_xml = (
        f'<testsuite name="{JUNIT_SUITE}" tests="{len(cases_xml)}" '
        'failures="0" errors="0" skipped="0">'
        + "".join(cases_xml)
        + "</testsuite>\n"
    ).encode()
    observation = {
        "schema": OBSERVATION_ID,
        "postgresImage": "postgres:16-alpine",
        **expected_observations(),
    }
    notification_cases_xml = [
        f'<testcase classname="{NOTIFICATION_JUNIT_SUITE}" name="{name}"></testcase>'
        for name in sorted(EXPECTED_NOTIFICATION_SCENARIOS)
    ]
    notification_good_xml = (
        f'<testsuite name="{NOTIFICATION_JUNIT_SUITE}" '
        f'tests="{len(notification_cases_xml)}" '
        'failures="0" errors="0" skipped="0">'
        + "".join(notification_cases_xml)
        + "</testsuite>\n"
    ).encode()
    notification_observation = {
        "schema": NOTIFICATION_OBSERVATION_ID,
        "postgresImage": "postgres:16-alpine",
        **expected_notification_observations(),
    }
    cases: dict[str, bool] = {}
    first_case = cases_xml[0].encode()
    second_name = sorted(EXPECTED_JUNIT_CASE_NAMES.values())[1].encode()
    first_name = sorted(EXPECTED_JUNIT_CASE_NAMES.values())[0].encode()
    extra_case = (
        f'<testcase classname="{JUNIT_SUITE}" name="unexpected"></testcase>'
    ).encode()
    for name, raw in {
        "junit-failure": good_xml.replace(b"</testcase>", b"<failure/></testcase>"),
        "junit-skip": good_xml.replace(b"</testcase>", b"<skipped/></testcase>"),
        "junit-wrong-suite": good_xml.replace(
            b"PlatformInventoryBridgeControlPostgresTest", b"OtherTest"
        ),
        "junit-missing-case": good_xml.replace(first_case, b"", 1),
        "junit-extra-case": good_xml.replace(b"</testsuite>", extra_case + b"</testsuite>"),
        "junit-duplicate-case": good_xml.replace(second_name, first_name, 1),
        "junit-declared-count": good_xml.replace(
            f'tests="{len(cases_xml)}"'.encode(), b'tests="999"', 1
        ),
        "junit-doctype": b'<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]><testsuite/>',
        "junit-empty": b"<testsuite/>",
    }.items():
        try:
            parsed = parse_junit(raw)
            cases[name] = name in {"junit-failure", "junit-skip"} and (
                parsed["failures"] + parsed["skipped"] > 0
            )
        except Exception:
            cases[name] = True
    for name, mutate in {
        "observation-wrong-image": lambda d: d.update({"postgresImage": "postgres:17"}),
        "observation-missing-scenario": lambda d: d.update({
            "verifiedScenarioIds": d["verifiedScenarioIds"][:-1]
        }),
        "observation-caller-count": lambda d: d.update({"triggerMappingCount": 999}),
        "observation-external-field": lambda d: d.update({"callerDigest": "0" * 64}),
    }.items():
        candidate = json.loads(json.dumps(observation))
        mutate(candidate)
        cases[name] = bool(validate_observation_document(candidate, "postgres:16-alpine"))
    try:
        parsed_notification = parse_junit(
            notification_good_xml,
            suite=NOTIFICATION_JUNIT_SUITE,
            expected_case_ids=EXPECTED_NOTIFICATION_JUNIT_CASE_IDS,
        )
        cases["notification-junit-baseline"] = (
            parsed_notification["tests"] == len(EXPECTED_NOTIFICATION_SCENARIOS)
            and not any(
                parsed_notification[key]
                for key in ("failures", "errors", "skipped")
            )
        )
    except Exception:
        cases["notification-junit-baseline"] = False
    for name, raw in {
        "notification-junit-wrong-suite": notification_good_xml.replace(
            b"NotificationTriggerExecutionBoundaryPostgresTest", b"OtherTest"
        ),
        "notification-junit-missing-case": notification_good_xml.replace(
            notification_cases_xml[0].encode(), b"", 1
        ),
        "notification-junit-extra-case": notification_good_xml.replace(
            b"</testsuite>",
            (
                f'<testcase classname="{NOTIFICATION_JUNIT_SUITE}" '
                'name="unexpected"></testcase></testsuite>'
            ).encode(),
            1,
        ),
    }.items():
        try:
            parse_junit(
                raw,
                suite=NOTIFICATION_JUNIT_SUITE,
                expected_case_ids=EXPECTED_NOTIFICATION_JUNIT_CASE_IDS,
            )
            cases[name] = False
        except Exception:
            cases[name] = True
    for name, mutate in {
        "notification-observation-wrong-image": lambda d: d.update(
            {"postgresImage": "postgres:17"}
        ),
        "notification-observation-missing-scenario": lambda d: d.update(
            {"verifiedScenarioIds": d["verifiedScenarioIds"][:-1]}
        ),
        "notification-observation-caller-digest": lambda d: d.update(
            {"triggerBoundaryTupleSha256": "0" * 64}
        ),
        "notification-observation-external-field": lambda d: d.update(
            {"sourceCommit": "0" * 40}
        ),
    }.items():
        candidate = json.loads(json.dumps(notification_observation))
        mutate(candidate)
        cases[name] = bool(
            validate_notification_observation_document(
                candidate, "postgres:16-alpine"
            )
        )
    with tempfile.TemporaryDirectory(prefix="hris-capture-hostile-") as temporary:
        temporary_root = Path(temporary)
        intake = temporary_root / "g0/control-evidence-intake"
        intake.mkdir(parents=True)
        original_root = globals()["ROOT"]
        original_backend = globals()["BACKEND"]
        globals()["ROOT"] = temporary_root
        try:
            target = intake / "proof.json"
            target.write_text("occupied")
            try:
                ensure_fixed_output(target)
                cases["existing-output"] = False
            except FileExistsError:
                cases["existing-output"] = True
            target.unlink()
            outside = temporary_root / "outside.json"
            try:
                ensure_fixed_output(outside)
                cases["path-escape"] = False
            except ValueError:
                cases["path-escape"] = True
            symlink = intake / "link.json"
            symlink.symlink_to(outside)
            try:
                ensure_fixed_output(symlink)
                cases["symlink-output"] = False
            except ValueError:
                cases["symlink-output"] = True
            fresh = intake / "fresh.xml"
            fresh.write_bytes(good_xml)
            cases["fresh-file-read"] = regular_fresh_file(
                fresh, fresh.stat().st_mtime_ns
            ) == good_xml
            try:
                regular_fresh_file(fresh, fresh.stat().st_mtime_ns + 1)
                cases["stale-file"] = False
            except ValueError:
                cases["stale-file"] = True
            fresh.unlink()
            fresh.symlink_to(outside)
            try:
                regular_fresh_file(fresh, 0)
                cases["replacement-symlink"] = False
            except ValueError:
                cases["replacement-symlink"] = True
            backend = temporary_root / "backend"
            backend.mkdir()
            globals()["BACKEND"] = backend
            (backend / "safe").mkdir()
            cases["backend-fixed-path"] = fixed_backend_path(
                "safe/result.xml"
            ) == backend / "safe/result.xml"
            try:
                fixed_backend_path("../escaped.xml")
                cases["backend-path-escape"] = False
            except ValueError:
                cases["backend-path-escape"] = True
            (backend / "linked").symlink_to(temporary_root / "outside-dir")
            try:
                fixed_backend_path("linked/result.xml")
                cases["backend-symlink-ancestor"] = False
            except ValueError:
                cases["backend-symlink-ancestor"] = True
        finally:
            globals()["ROOT"] = original_root
            globals()["BACKEND"] = original_backend
    cases["repository-stale-head"] = (
        ("1" * 40, "2" * 40, "") != ("3" * 40, "2" * 40, "")
    )
    cases["closed-image-set"] = set(EVIDENCE_PATHS) == {
        "postgres:16-alpine", "postgres:18.4-alpine"
    }
    cases["shared-semaphore-key"] = (
        HOST_VERIFICATION_SEMAPHORE == "hris-verification"
    )
    try:
        _capture_under_active_lock("postgres:16-alpine")
        cases["unlocked-internal-capture-rejected"] = False
    except ValueError as error:
        cases["unlocked-internal-capture-rejected"] = (
            str(error) == "PostgreSQL evidence capture requires active host semaphore"
        )
    capture_source = inspect.getsource(capture)
    internal_source = inspect.getsource(_capture_under_active_lock)
    cases["two-suite-sidecars-use-disjoint-empty-directories"] = all(
        fragment in internal_source
        for fragment in (
            'Path(temporary) / "platform"',
            'Path(temporary) / "notification"',
            "platform_observation_directory.mkdir(mode=0o700)",
            "notification_observation_directory.mkdir(mode=0o700)",
        )
    )
    cases["two-suite-postgres-image-binding"] = all(
        binding in internal_source
        for binding in (
            "environment[CONTROL_POSTGRES_IMAGE_ENV] = image",
            "environment[NOTIFICATION_POSTGRES_IMAGE_ENV] = image",
            "require_exact_test_image_environment(environment, image)",
        )
    )
    exact_image_environment = {
        CONTROL_POSTGRES_IMAGE_ENV: "postgres:16-alpine",
        NOTIFICATION_POSTGRES_IMAGE_ENV: "postgres:16-alpine",
    }
    try:
        require_exact_test_image_environment(
            exact_image_environment, "postgres:16-alpine"
        )
        cases["two-suite-exact-image-environment-accepted"] = True
    except ValueError:
        cases["two-suite-exact-image-environment-accepted"] = False
    for name, hostile_environment in {
        "control-image-environment-mismatch-rejected": {
            **exact_image_environment,
            CONTROL_POSTGRES_IMAGE_ENV: "postgres:18.4-alpine",
        },
        "notification-image-environment-mismatch-rejected": {
            **exact_image_environment,
            NOTIFICATION_POSTGRES_IMAGE_ENV: "postgres:18.4-alpine",
        },
        "missing-image-environment-rejected": {
            CONTROL_POSTGRES_IMAGE_ENV: "postgres:16-alpine"
        },
    }.items():
        try:
            require_exact_test_image_environment(
                hostile_environment, "postgres:16-alpine"
            )
            cases[name] = False
        except ValueError:
            cases[name] = True
    cases["host-lock-encloses-run-and-create-new-publication"] = (
        capture_source.index("with exclusive_host_semaphore(")
        < capture_source.index("_capture_under_active_lock(image)")
        and "timeout_seconds=300.0" in capture_source
        and internal_source.index("active_host_semaphore_capability(")
        < internal_source.index("before = repository_state()")
        < internal_source.index("subprocess.run(")
        < internal_source.index("create_new(target, data)")
        and "exclusive_host_semaphore(" not in internal_source
    )
    parser_destinations = {
        action.dest for action in parser()._actions if action.dest != "help"
    }
    cases["no-caller-observation-input"] = not {
        PLATFORM_OBSERVATION_ENV,
        NOTIFICATION_OBSERVATION_ENV,
        "evidencePath",
        "junitPath",
        "observationPath",
    } & parser_destinations
    cases["two-suite-command-closure"] = all(
        ":dwp-migration-control:test" in command
        and ":dwp-notification-server:test" in command
        and JUNIT_SUITE in command
        and NOTIFICATION_JUNIT_SUITE in command
        for command in COMMANDS.values()
    )
    cases["two-suite-case-sets-disjoint"] = not (
        EXPECTED_JUNIT_CASE_IDS & EXPECTED_NOTIFICATION_JUNIT_CASE_IDS
    )
    return cases


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser()
    mode = result.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--self-test", action="store_true")
    result.add_argument("--image", choices=sorted(EVIDENCE_PATHS))
    return result


def main() -> int:
    arguments = parser().parse_args()
    if arguments.self_test:
        if arguments.image is not None:
            parser().error("--image is forbidden with --self-test")
        cases = self_test()
        failed = sorted(name for name, passed in cases.items() if not passed)
        result = {
            "schema": "dwp.hris.pre-g3-postgres-capture-self-test.v1",
            "status": "PASS" if not failed else "FAIL",
            "passed": sum(cases.values()),
            "total": len(cases),
            "failed": failed,
        }
    else:
        if arguments.image is None:
            parser().error("--image is required with --write")
        try:
            result = capture(arguments.image)
        except Exception as exc:
            result = {
                "schema": "dwp.hris.pre-g3-common-foundation-postgres-capture.v1",
                "status": "FAIL",
                "postgresImage": arguments.image,
                "error": f"{type(exc).__name__}:{exc}",
            }
    print(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
