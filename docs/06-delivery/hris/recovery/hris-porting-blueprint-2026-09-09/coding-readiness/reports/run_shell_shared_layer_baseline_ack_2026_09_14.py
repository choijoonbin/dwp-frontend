#!/usr/bin/env python3
"""Read-only shell/shared test and real layer-scan baseline with lossless ACK output."""

import base64
import gzip
import hashlib
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.dont_write_bytecode = True

REPORTS = Path(
    "/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/reports"
)
sys.path.insert(0, str(REPORTS.parent.parent / "g0"))
from host_semaphore import exclusive_host_semaphore

ROOT = Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend")
REGISTER = REPORTS.parent / "module-structure-contract-register.csv"
NODE = Path(
    "/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
)


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def archive(value: bytes) -> dict:
    compressed = gzip.compress(value, mtime=0)
    return {
        "encoding": "gzip+base64",
        "sha256": sha256(value),
        "bytes": len(value),
        "archiveSha256": sha256(compressed),
        "payload": base64.b64encode(compressed).decode(),
    }


def utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def source_paths() -> list[str]:
    paths = []
    for directory in (
        ROOT / "apps/dwp/src/features/hris/shell",
        ROOT / "apps/dwp/src/features/hris/shared",
    ):
        paths.extend(
            str(path.relative_to(ROOT))
            for path in directory.rglob("*")
            if path.is_file() and path.suffix in {".ts", ".tsx"}
        )
    paths.extend(
        [
            "apps/dwp/src/pages/hcm.tsx",
            "apps/dwp/vitest.config.ts",
            "eslint.config.mjs",
            "package.json",
            "scripts/source-size-baseline.json",
            "scripts/verification/hris-layer-contract-v1.mjs",
            "scripts/verification/hris-layer-contract-v1.test.mjs",
            "scripts/verification/fixtures/hris-layer-contract-v1.json",
            "tsconfig.base.json",
            "tsconfig.json",
            "vitest.config.ts",
            "yarn.lock",
        ]
    )
    return sorted({path for path in paths if (ROOT / path).is_file()})


PATHS = source_paths()


def snapshot() -> list[dict]:
    return [
        {
            "path": path,
            "sha256": sha256((ROOT / path).read_bytes()),
            "mtimeNs": str((ROOT / path).stat().st_mtime_ns),
        }
        for path in PATHS
    ]


def run(label: str, argv: list[str], timeout_seconds: int) -> dict:
    started_at = utc()
    started = time.monotonic()
    try:
        completed = subprocess.run(argv, cwd=ROOT, capture_output=True, timeout=timeout_seconds)
        stdout = completed.stdout
        stderr = completed.stderr
        exit_code = completed.returncode
        timed_out = False
    except subprocess.TimeoutExpired as error:
        stdout = error.stdout or b""
        stderr = error.stderr or b""
        exit_code = None
        timed_out = True
    result = {
        "label": label,
        "argv": argv,
        "timeoutSeconds": timeout_seconds,
        "startedAt": started_at,
        "finishedAt": utc(),
        "durationSeconds": time.monotonic() - started,
        "exitCode": exit_code,
        "timedOut": timed_out,
        "stdoutArchive": archive(stdout),
        "stderrArchive": archive(stderr),
    }
    try:
        text = stdout.decode()
        offset = text.find('{"numTotalTestSuites"')
        parsed = json.loads(text[offset:] if offset >= 0 else text)
        if label == "shell-tests":
            result["summary"] = {
                key: parsed.get(key)
                for key in (
                    "numTotalTests",
                    "numPassedTests",
                    "numFailedTests",
                    "numPendingTests",
                    "numTotalTestSuites",
                    "numPassedTestSuites",
                    "numFailedTestSuites",
                )
            }
            result["caseResults"] = [
                {"name": case["fullName"], "status": case["status"]}
                for test_file in parsed.get("testResults", [])
                for case in test_file.get("assertionResults", [])
            ]
        else:
            errors = parsed.get("result", {}).get("errors", [])
            owned_errors = [
                error
                for error in errors
                if error.get("file", "").startswith(
                    (
                        "apps/dwp/src/features/hris/shell/",
                        "apps/dwp/src/features/hris/shared/",
                    )
                )
            ]
            result["summary"] = {
                "structuralPass": parsed.get("structuralPass"),
                "readinessPass": parsed.get("readinessPass"),
                "g3StartAuthorized": parsed.get("g3StartAuthorized"),
                "sourceCount": parsed.get("result", {}).get("sourceCount"),
                "classifiedCount": parsed.get("result", {}).get("classifiedCount"),
                "layeredCount": parsed.get("result", {}).get("layeredCount"),
                "unclassifiedCount": parsed.get("result", {}).get("unclassifiedCount"),
                "totalErrorCount": len(errors),
                "ownedErrorCount": len(owned_errors),
                "ownedErrors": owned_errors,
                "sourceEvidence": parsed.get("sourceEvidence"),
            }
    except Exception as error:
        result["parseError"] = str(error)
    return result


with exclusive_host_semaphore("hris-verification", timeout_seconds=30) as lock:
    pre = snapshot()
    started_at = utc()
    tests = run(
        "shell-tests",
        [
            str(NODE),
            "node_modules/vitest/vitest.mjs",
            "run",
            "--project",
            "dwp-app",
            "apps/dwp/src/features/hris/shell/",
            "--maxWorkers=1",
            "--reporter=json",
        ],
        90,
    )
    scan = run(
        "actual-layer-scan",
        [
            str(NODE),
            "scripts/verification/hris-layer-contract-v1.mjs",
            "--mode",
            "scan",
            "--register",
            str(REGISTER),
        ],
        120,
    )
    post = snapshot()
    finished_at = utc()

test_summary = tests.get("summary", {})
scan_summary = scan.get("summary", {})
status = (
    "PASS_BASELINE_FAIL_BEFORE_PRESERVED"
    if pre == post
    and not tests["timedOut"]
    and tests["exitCode"] == 0
    and test_summary.get("numTotalTests", 0) > 0
    and test_summary.get("numTotalTests") == test_summary.get("numPassedTests")
    and test_summary.get("numFailedTests") == 0
    and test_summary.get("numPendingTests") == 0
    and not scan["timedOut"]
    and scan["exitCode"] == 1
    and scan_summary.get("structuralPass") is False
    and scan_summary.get("g3StartAuthorized") is False
    and scan_summary.get("ownedErrorCount", 0) > 0
    else "FAIL"
)
receipt = {
    "schema": "dwp.hris.shell-shared-layer-baseline.v1",
    "status": status,
    "cwd": str(ROOT),
    "startedAt": started_at,
    "finishedAt": finished_at,
    "hostLock": lock,
    "sourceCount": len(pre),
    "sourceStable": pre == post,
    "preSources": pre,
    "postSources": post,
    "runs": [tests, scan],
    "limits": {
        "behaviorChanged": False,
        "domainRuntimeExecuted": False,
        "browserRun": False,
        "G3Open": False,
        "productionActivationAuthorized": False,
    },
}
raw = json.dumps(receipt, separators=(",", ":")).encode()
compressed = gzip.compress(raw, mtime=0)
encoded = base64.b64encode(compressed).decode()
chunks = [encoded[index : index + 4000] for index in range(0, len(encoded), 4000)]
print(
    "ARCHIVE_HEAD "
    + json.dumps(
        {
            "status": status,
            "testSummary": test_summary,
            "scanSummary": scan_summary,
            "sourceCount": len(pre),
            "sourceStable": pre == post,
            "startedAt": started_at,
            "finishedAt": finished_at,
            "receiptSha256": sha256(raw),
            "receiptBytes": len(raw),
            "archiveSha256": sha256(compressed),
            "archiveBytes": len(compressed),
            "base64Chars": len(encoded),
            "chunks": len(chunks),
        }
    ),
    flush=True,
)
for index, chunk in enumerate(chunks):
    print(f"CHUNK {index} {chunk}", flush=True)
    if not sys.stdin.readline():
        raise SystemExit("archive incomplete: acknowledgment missing")
print("ARCHIVE_COMPLETE " + sha256(compressed), flush=True)
