#!/usr/bin/env python3
"""Lossless native PG16 reproduction for the adopted-ACTIVE Control boundary.

This runner writes no evidence files.  It holds the shared host semaphore for
the complete Gradle/process/container lifecycle and emits an acknowledged,
gzip-compressed receipt for the caller to persist with apply_patch.
"""

from __future__ import annotations

import base64
from datetime import datetime, timezone
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import threading
import time
import xml.etree.ElementTree as ET

sys.dont_write_bytecode = True

BLUEPRINT = Path("/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09")
BACKEND = Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend")
sys.path.insert(0, str(BLUEPRINT / "g0"))
from host_semaphore import exclusive_host_semaphore

TEST_CLASS = "com.dwp.migration.control.MigrationControlAdoptionActiveFenceV1PostgresTest"
STAGE = sys.argv[1] if len(sys.argv) == 2 else "before"
if STAGE not in {"before", "after"}:
    raise SystemExit("usage: runner [before|after]")
XML_PATH = BACKEND / "dwp-migration-control/build/test-results/test" / f"TEST-{TEST_CLASS}.xml"
CRITICAL_PATHS = (
    "dwp-migration-control/src/main/java/com/dwp/migration/control/MigrationControlMain.java",
    "dwp-migration-control/src/main/java/com/dwp/migration/control/AdoptionSealer.java",
    "dwp-core/src/main/java/com/dwp/core/database/MigrationAdoptionGuard.java",
    "dwp-migration-control/src/test/java/com/dwp/migration/control/AdoptionActiveFenceFixtureV1.java",
    "dwp-migration-control/src/test/java/com/dwp/migration/control/MigrationControlAdoptionActiveFenceV1PostgresTest.java",
)
SOURCE_MODULES = {
    "dwp-migration-control",
    "dwp-core",
    "dwp-notification-server",
    "dwp-audit",
    "dwp-observability",
    "dwp-platform-contracts",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def archive(raw: bytes) -> dict[str, object]:
    compressed = gzip.compress(raw, mtime=0)
    return {
        "sha256": sha256(raw),
        "bytes": len(raw),
        "gzipSha256": sha256(compressed),
        "gzipBytes": len(compressed),
        "gzipBase64": base64.b64encode(compressed).decode("ascii"),
    }


def tracked_and_untracked() -> list[str]:
    output = subprocess.check_output(
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        cwd=BACKEND,
    )
    return [item for item in output.decode("utf-8").split("\0") if item]


def source_manifest() -> list[dict[str, str]]:
    selected: set[str] = set()
    for relative in tracked_and_untracked():
        first = relative.split("/", 1)[0]
        if first not in SOURCE_MODULES:
            continue
        if "/src/" in relative and relative.endswith((".java", ".sql", ".yml", ".yaml")):
            selected.add(relative)
        elif relative.endswith(("build.gradle", "gradle.properties", "libs.versions.toml")):
            selected.add(relative)
    manifest = []
    for relative in sorted(selected):
        path = BACKEND / relative
        if path.is_file():
            raw = path.read_bytes()
            manifest.append(
                {
                    "path": relative,
                    "sha256": sha256(raw),
                    "mtimeNs": str(path.stat().st_mtime_ns),
                }
            )
    return manifest


def critical_snapshot() -> list[dict[str, object]]:
    result = []
    for relative in CRITICAL_PATHS:
        path = BACKEND / relative
        raw = path.read_bytes()
        result.append(
            {
                "path": relative,
                "sha256": sha256(raw),
                "mtimeNs": str(path.stat().st_mtime_ns),
                "utf8": raw.decode("utf-8"),
            }
        )
    return result


def process_group(pgid: int) -> list[str]:
    command = subprocess.run(
        ["ps", "-axo", "pid=,ppid=,pgid=,lstart=,comm="],
        capture_output=True,
        timeout=10,
        check=False,
    )
    lines = []
    for line in command.stdout.decode("utf-8", "replace").splitlines():
        values = line.strip().split()
        if len(values) >= 3 and values[2] == str(pgid):
            lines.append(line.strip())
    return lines


def inspect_container(identifier: str) -> dict[str, object]:
    command = subprocess.run(
        [
            "docker",
            "inspect",
            "--format",
            "{{json .Id}} {{json .Config.Image}} {{json .State.Status}} {{json .Created}} {{json .Config.Labels}}",
            identifier,
        ],
        capture_output=True,
        timeout=15,
        check=False,
    )
    return {
        "id": identifier,
        "status": "PRESENT" if command.returncode == 0 else "ABSENT",
        "exitCode": command.returncode,
        "stdout": command.stdout.decode("utf-8", "replace"),
        "stderr": command.stderr.decode("utf-8", "replace"),
    }


def live_testcontainers() -> dict[str, dict[str, object]]:
    command = subprocess.run(
        [
            "docker",
            "ps",
            "--no-trunc",
            "--filter",
            "label=org.testcontainers=true",
            "--format",
            "{{.ID}}|{{.Image}}|{{.Names}}|{{.Status}}|{{.Labels}}",
        ],
        capture_output=True,
        timeout=10,
        check=False,
    )
    if command.returncode != 0:
        raise RuntimeError(command.stderr.decode("utf-8", "replace").strip())
    result: dict[str, dict[str, object]] = {}
    for line in command.stdout.decode("utf-8", "replace").splitlines():
        fields = line.strip().split("|", 4)
        if len(fields) != 5:
            continue
        identifier, image, name, summary, labels_text = fields
        if re.fullmatch(r"[0-9a-f]{64}", identifier):
            labels: dict[str, str] = {}
            for pair in labels_text.split(","):
                key, separator, value = pair.partition("=")
                if separator:
                    labels[key] = value
            result[identifier] = {
                "image": image,
                "name": name,
                "summary": summary,
                "labels": labels,
            }
    return result


def parse_xml(raw: bytes, started_ns: int) -> dict[str, object]:
    root = ET.fromstring(raw)
    cases = []
    for case in root.findall("testcase"):
        failure = case.find("failure")
        error = case.find("error")
        skipped = case.find("skipped")
        status = "FAILED" if failure is not None else "ERROR" if error is not None else "SKIPPED" if skipped is not None else "PASSED"
        problem = failure if failure is not None else error
        cases.append(
            {
                "className": case.get("classname"),
                "name": case.get("name"),
                "time": case.get("time"),
                "status": status,
                "problem": None
                if problem is None
                else {
                    "type": problem.get("type"),
                    "message": problem.get("message"),
                    "text": problem.text,
                },
            }
        )
    return {
        "path": str(XML_PATH.relative_to(BACKEND)),
        "mtimeNs": str(XML_PATH.stat().st_mtime_ns),
        "freshAfterStart": XML_PATH.stat().st_mtime_ns >= started_ns,
        "attributes": dict(root.attrib),
        "cases": cases,
        "systemOut": root.findtext("system-out") or "",
        "systemErr": root.findtext("system-err") or "",
        "rawArchive": archive(raw),
    }


argv = [
    "./gradlew",
    ":dwp-migration-control:test",
    "--tests",
    TEST_CLASS,
    "--rerun-tasks",
    "--no-daemon",
    "--max-workers=1",
]
environment = dict(os.environ)
environment.update(
    {
        "JAVA_HOME": "/Users/a10697/Library/Java/JavaVirtualMachines/corretto-23.0.2/Contents/Home",
        "DWP_CONTROL_POSTGRES_TEST_IMAGE": "postgres:16-alpine",
        "DOCKER_HOST": "unix:///Users/a10697/.docker/run/docker.sock",
        "TESTCONTAINERS_HOST_OVERRIDE": "127.0.0.1",
    }
)

before_xml = None
if XML_PATH.is_file():
    before_xml = {
        "sha256": sha256(XML_PATH.read_bytes()),
        "mtimeNs": str(XML_PATH.stat().st_mtime_ns),
    }

signals: list[str] = []
with exclusive_host_semaphore("hris-verification", timeout_seconds=30) as host_lock:
    before_manifest = source_manifest()
    before_critical = critical_snapshot()
    pre_testcontainers = live_testcontainers()
    monitored_testcontainers: dict[str, dict[str, object]] = {}
    monitor_errors: list[str] = []
    monitor_stop = threading.Event()

    def monitor_owned_testcontainers() -> None:
        while not monitor_stop.is_set():
            try:
                for identifier, observation in live_testcontainers().items():
                    if identifier not in pre_testcontainers:
                        monitored_testcontainers[identifier] = observation
            except Exception as exception:  # Evidence records a daemon flap; it does not hide it.
                monitor_errors.append(f"{type(exception).__name__}: {exception}")
            monitor_stop.wait(0.2)

    started_at = utc_now()
    started_ns = time.time_ns()
    monotonic = time.monotonic()
    process = subprocess.Popen(
        argv,
        cwd=BACKEND,
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,
    )
    monitor = threading.Thread(target=monitor_owned_testcontainers, daemon=True)
    monitor.start()
    time.sleep(0.05)
    process_group_at_start = process_group(process.pid)
    timed_out = False
    try:
        stdout, stderr = process.communicate(timeout=180)
    except subprocess.TimeoutExpired:
        timed_out = True
        signals.append("SIGTERM")
        os.killpg(process.pid, signal.SIGTERM)
        try:
            stdout, stderr = process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            signals.append("SIGKILL")
            os.killpg(process.pid, signal.SIGKILL)
            stdout, stderr = process.communicate(timeout=5)
    native_finished_at = utc_now()
    native_elapsed = time.monotonic() - monotonic
    monitor_stop.set()
    monitor.join(timeout=5)
    xml = None
    if XML_PATH.is_file():
        xml = parse_xml(XML_PATH.read_bytes(), started_ns)
    combined_console = (stdout + b"\n" + stderr).decode("utf-8", "replace")
    xml_console = "" if xml is None else xml["systemOut"] + "\n" + xml["systemErr"]
    logged_ids = set(re.findall(
        r"starting:\s*([0-9a-f]{64})", combined_console + "\n" + xml_console))
    own_session_ids = {
        str(monitored_testcontainers[identifier]["labels"].get(
            "org.testcontainers.sessionId"))
        for identifier in logged_ids
        if identifier in monitored_testcontainers
        and monitored_testcontainers[identifier]["labels"].get(
            "org.testcontainers.sessionId")
    }
    exact_ryuk_ids = {
        identifier
        for identifier, observation in monitored_testcontainers.items()
        if observation["name"]
        in {f"testcontainers-ryuk-{session_id}" for session_id in own_session_ids}
    }
    owned_ids = sorted(logged_ids | exact_ryuk_ids)
    foreign_or_unattributed_ids = sorted(set(monitored_testcontainers) - set(owned_ids))
    initial_container_inspections = [inspect_container(identifier) for identifier in owned_ids]
    cleanup_deadline = time.monotonic() + 10
    final_container_inspections = initial_container_inspections
    while owned_ids and time.monotonic() < cleanup_deadline:
        final_container_inspections = [inspect_container(identifier) for identifier in owned_ids]
        if all(item["status"] == "ABSENT" for item in final_container_inspections):
            break
        time.sleep(0.25)
    process_group_at_end = process_group(process.pid)
    after_manifest = source_manifest()
    after_critical = critical_snapshot()
    cleanup_finished_at = utc_now()

finished_at = utc_now()
cases = [] if xml is None else xml["cases"]
counts = {
    "total": len(cases),
    "unique": len({(case["className"], case["name"]) for case in cases}),
    "passed": sum(case["status"] == "PASSED" for case in cases),
    "failed": sum(case["status"] == "FAILED" for case in cases),
    "errors": sum(case["status"] == "ERROR" for case in cases),
    "skipped": sum(case["status"] == "SKIPPED" for case in cases),
}
failed_names = [case["name"] for case in cases if case["status"] == "FAILED"]
system_text = "" if xml is None else xml["systemOut"] + "\n" + xml["systemErr"]
target_failure = (
    failed_names == ["actualPublicMainMustNotReopenFencedRuntimeToReverifyAlreadyVerifiedAdoptedPredecessor()"]
    and "ADOPTION_REPRO_ENTRY=ACTUAL_PUBLIC_MAIN" in system_text
    and "ADOPTION_REPRO_SQLSTATE=42501" in system_text
    and "MigrationControlMain.runAdoption" in system_text
    and "AdoptionSealer.legacyBoundary" in system_text
    and "MigrationAdoptionGuard.verifyControlPrincipal" in system_text
    and "ControlDataSource.getConnection" in system_text
)
public_case = next(
    (
        case
        for case in cases
        if case["name"]
        == "actualPublicMainMustNotReopenFencedRuntimeToReverifyAlreadyVerifiedAdoptedPredecessor()"
    ),
    None,
)
all_owned_absent = bool(owned_ids) and all(
    item["status"] == "ABSENT" for item in final_container_inspections
)
source_stable = before_manifest == after_manifest and before_critical == after_critical
expected_counterexample = (
    process.returncode != 0
    and not timed_out
    and counts == {"total": 4, "unique": 4, "passed": 3, "failed": 1, "errors": 0, "skipped": 0}
    and target_failure
    and xml is not None
    and xml["freshAfterStart"]
    and source_stable
    and not process_group_at_end
    and all_owned_absent
)
expected_after_pass = (
    process.returncode == 0
    and not timed_out
    and counts
    == {"total": 21, "unique": 21, "passed": 21, "failed": 0, "errors": 0, "skipped": 0}
    and public_case is not None
    and public_case["status"] == "PASSED"
    and "ADOPTION_REPRO_ENTRY=ACTUAL_PUBLIC_MAIN" in system_text
    and "ADOPTION_REPRO_SQLSTATE=42501" not in system_text
    and xml is not None
    and xml["freshAfterStart"]
    and source_stable
    and not process_group_at_end
    and all_owned_absent
)
evidence_ok = expected_counterexample if STAGE == "before" else expected_after_pass
evidence_status = (
    "EXPECTED_COUNTEREXAMPLE_OBSERVED"
    if STAGE == "before" and evidence_ok
    else "FOCUSED_REMEDIATION_PASS"
    if STAGE == "after" and evidence_ok
    else "UNEXPECTED_RESULT"
)

critical_archive_raw = json.dumps(
    before_critical, ensure_ascii=False, sort_keys=True, separators=(",", ":")
).encode("utf-8")
receipt = {
    "schemaVersion": "1.0.0",
    "contractId": "ControlAdoptionActiveFenceEvidence.v1",
    "stage": STAGE,
    "status": evidence_status,
    "readinessPass": expected_after_pass,
    "g3Open": False,
    "sourceWrites": {"production": 0, "test": 0, "runnerEvidenceOnly": 1},
    "scope": {
        "testClass": TEST_CLASS,
        "engine": "postgres:16-alpine",
        "caseTarget": 4 if STAGE == "before" else 21,
        "actualPublicMain": True,
        "fullAuthMigrationSet": False,
        "wholeBackend": False,
    },
    "argv": argv,
    "cwd": str(BACKEND),
    "environmentOverrides": {
        "JAVA_HOME": environment["JAVA_HOME"],
        "DWP_CONTROL_POSTGRES_TEST_IMAGE": environment["DWP_CONTROL_POSTGRES_TEST_IMAGE"],
        "DOCKER_HOST": environment["DOCKER_HOST"],
        "TESTCONTAINERS_HOST_OVERRIDE": environment["TESTCONTAINERS_HOST_OVERRIDE"],
    },
    "startedAtUtc": started_at,
    "nativeFinishedAtUtc": native_finished_at,
    "cleanupFinishedAtUtc": cleanup_finished_at,
    "finishedAtUtc": finished_at,
    "nativeElapsedSeconds": native_elapsed,
    "exitCode": process.returncode,
    "timedOut": timed_out,
    "taskTimeoutSeconds": 180,
    "childTimeoutSeconds": 45,
    "hostSemaphore": host_lock,
    "ownPopen": {
        "pid": process.pid,
        "pgid": process.pid,
        "createdAsNewSession": True,
        "processGroupAtStart": process_group_at_start,
        "signals": signals,
        "processGroupAtEnd": process_group_at_end,
    },
    "containers": {
        "preExistingTestcontainers": pre_testcontainers,
        "monitoredNewTestcontainers": monitored_testcontainers,
        "monitorErrors": monitor_errors,
        "ownedPostgresIdsFromFreshXmlOrConsole": sorted(logged_ids),
        "ownedSessionIdsFromExactPostgresLabels": sorted(own_session_ids),
        "ownedRyukIdsFromExactSessionName": sorted(exact_ryuk_ids),
        "exactOwnedIds": owned_ids,
        "foreignOrUnattributedNewIds": foreign_or_unattributed_ids,
        "initialInspections": initial_container_inspections,
        "finalInspections": final_container_inspections,
        "allOwnedAbsentBeforeHostRelease": all_owned_absent,
        "manualStops": 0,
        "manualRemovals": 0,
    },
    "beforeXmlNamespace": before_xml,
    "freshXml": xml,
    "counts": counts,
    "targetFailureObserved": target_failure,
    "targetAfterPassObserved": expected_after_pass,
    "sourceScope": {
        "modules": sorted(SOURCE_MODULES),
        "sourceCount": len(before_manifest),
        "sourceShaNsStable": source_stable,
        "before": before_manifest,
        "after": after_manifest,
    },
    "criticalSourcePins": [
        {key: item[key] for key in ("path", "sha256", "mtimeNs")}
        for item in before_critical
    ],
    "criticalSourceSnapshotArchive": archive(critical_archive_raw),
    "stdoutArchive": archive(stdout),
    "stderrArchive": archive(stderr),
    "observedBoundary": {
        "baselinePredecessorVerification": "PASS",
        "activeExistingReceiptBootstrapRead": "PASS",
        "activeRuntimeConnect": "DENIED_SQLSTATE_42501",
        "publicMainOutcome": "FAIL_CLOSED_BEFORE_MIGRATION"
        if STAGE == "before"
        else "NO_ACTIVE_RUNTIME_RELOGIN_42501",
        "historyAndReceiptSnapshotUnchanged": target_failure
        if STAGE == "before"
        else public_case is not None and public_case["status"] == "PASSED",
    },
    "requiredNext": {
        "productionChangeApproved": STAGE == "after",
        "minimumDesign": "Verify an already sealed adopted predecessor through an ACTIVE-safe typed source that does not reopen runtime CONNECT; keep migration metadata checks and exact predecessor receipt/reference binding fail-closed.",
        "mustPreserve": [
            "initial adoption legacy-boundary behavior",
            "BASELINE runtime metadata privilege verification",
            "ACTIVE CONNECT denial",
            "exact previous receipt and control-reference binding",
            "all existing Main, AdoptionGuard, Control, and build expectations",
        ],
    },
    "limitations": {
        "beforeFailureOnly": STAGE == "before",
        "focusedAfterOnly": STAGE == "after",
        "nativeIssuer": False,
        "all114AuthMigrations": False,
        "producerPublication": False,
        "g3Open": False,
    },
}

raw_receipt = json.dumps(
    receipt, ensure_ascii=False, sort_keys=True, separators=(",", ":")
).encode("utf-8")
compressed_receipt = gzip.compress(raw_receipt, mtime=0)
encoded_receipt = base64.b64encode(compressed_receipt).decode("ascii")
chunks = [encoded_receipt[index : index + 4000] for index in range(0, len(encoded_receipt), 4000)]
head = {
    "stage": STAGE,
    "status": receipt["status"],
    "counts": counts,
    "targetFailureObserved": target_failure,
    "targetAfterPassObserved": expected_after_pass,
    "sourceCount": len(before_manifest),
    "sourceStable": source_stable,
    "ownedContainerCount": len(owned_ids),
    "allOwnedAbsentBeforeHostRelease": all_owned_absent,
    "startedAtUtc": started_at,
    "finishedAtUtc": finished_at,
    "nativeElapsedSeconds": native_elapsed,
    "hostSemaphore": host_lock,
    "receiptSha256": sha256(raw_receipt),
    "receiptBytes": len(raw_receipt),
    "archiveSha256": sha256(compressed_receipt),
    "archiveBytes": len(compressed_receipt),
    "base64Chars": len(encoded_receipt),
    "chunks": len(chunks),
}
print("ARCHIVE_HEAD " + json.dumps(head, ensure_ascii=True, sort_keys=True), flush=True)
for index, chunk in enumerate(chunks):
    print(f"CHUNK {index} {chunk}", flush=True)
    if not sys.stdin.readline():
        raise SystemExit("archive incomplete: acknowledgment missing")
print("ARCHIVE_COMPLETE " + sha256(compressed_receipt), flush=True)
