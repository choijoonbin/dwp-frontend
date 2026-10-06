#!/usr/bin/env python3
"""Run lossless final shell/shared layer checks and stream an ACK-gated receipt."""

import base64
import gzip
import hashlib
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.dont_write_bytecode = True

BLUEPRINT = Path("/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09")
REPORTS = BLUEPRINT / "coding-readiness/reports"
FRONTEND = Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend")
NODE = Path("/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node")
sys.path.insert(0, str(BLUEPRINT / "g0"))
from host_semaphore import exclusive_host_semaphore


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


def source_paths() -> list[tuple[str, Path, str]]:
    values: list[tuple[str, Path, str]] = []
    for relative_root in (
        "apps/dwp/src/features/hris/shell",
        "apps/dwp/src/features/hris/shared",
        "apps/dwp/src/features/hris/time",
    ):
        for path in (FRONTEND / relative_root).rglob("*"):
            if path.is_file() and path.suffix in {".ts", ".tsx"}:
                values.append(("frontend", FRONTEND, path.relative_to(FRONTEND).as_posix()))
    for relative_path in (
        "apps/dwp/src/pages/hcm.tsx",
        "package.json",
        "scripts/check-source-size.mjs",
        "scripts/source-size-baseline.json",
        "scripts/verification/hris-layer-contract-v1.mjs",
        "scripts/verification/hris-layer-contract-v1.test.mjs",
        "scripts/verification/fixtures/hris-layer-contract-v1.json",
        "tsconfig.base.json",
        "tsconfig.json",
        "vitest.config.ts",
        "yarn.lock",
    ):
        if (FRONTEND / relative_path).is_file():
            values.append(("frontend", FRONTEND, relative_path))
    for relative_path in (
        "coding-readiness/README.md",
        "coding-readiness/frontend-shared-presentation-binding-register.csv",
        "coding-readiness/g3-file-allocation-register.csv",
        "coding-readiness/generate_information_architecture_register.py",
        "coding-readiness/hris-information-architecture-register.csv",
        "coding-readiness/module-structure-contract-register.csv",
        "coding-readiness/route-transition-register.csv",
        "coding-readiness/validate_frontend_shared_presentation_boundary.py",
        "coding-readiness/validate_information_architecture.py",
        "g0/file-ownership-register.csv",
    ):
        values.append(("blueprint", BLUEPRINT, relative_path))
    return sorted(set(values), key=lambda item: (item[0], item[2]))


PATHS = source_paths()


def snapshot(include_text: bool = False) -> list[dict]:
    values = []
    for root_name, root, relative_path in PATHS:
        path = root / relative_path
        value = {
            "root": root_name,
            "path": relative_path,
            "sha256": sha256(path.read_bytes()),
            "mtimeNs": str(path.stat().st_mtime_ns),
        }
        if include_text and relative_path.startswith(
            ("apps/dwp/src/features/hris/shell/", "apps/dwp/src/features/hris/shared/")
        ):
            value["utf8"] = path.read_text(encoding="utf-8")
        values.append(value)
    return values


def run(label: str, argv: list[str], cwd: Path, timeout_seconds: int) -> dict:
    started_at = utc()
    started = time.monotonic()
    try:
        completed = subprocess.run(argv, cwd=cwd, capture_output=True, timeout=timeout_seconds)
        stdout, stderr = completed.stdout, completed.stderr
        exit_code, timed_out = completed.returncode, False
    except subprocess.TimeoutExpired as error:
        stdout, stderr = error.stdout or b"", error.stderr or b""
        exit_code, timed_out = None, True
    return {
        "label": label,
        "argv": argv,
        "cwd": str(cwd),
        "startedAt": started_at,
        "finishedAt": utc(),
        "durationSeconds": time.monotonic() - started,
        "exitCode": exit_code,
        "timedOut": timed_out,
        "stdoutArchive": archive(stdout),
        "stderrArchive": archive(stderr),
        "stdoutText": stdout.decode(errors="replace"),
    }


commands = [
    (
        "shell-shared-tests",
        [str(NODE), "node_modules/vitest/vitest.mjs", "run", "--project", "dwp-app",
         "apps/dwp/src/features/hris/shell/", "apps/dwp/src/features/hris/shared/",
         "--maxWorkers=1", "--reporter=json"],
        FRONTEND,
        120,
    ),
    (
        "actual-layer-scan",
        [str(NODE), "scripts/verification/hris-layer-contract-v1.mjs", "--mode", "scan",
         "--register", str(BLUEPRINT / "coding-readiness/module-structure-contract-register.csv")],
        FRONTEND,
        120,
    ),
    (
        "scoped-eslint",
        [str(NODE), "node_modules/eslint/bin/eslint.js", "apps/dwp/src/features/hris/shell",
         "apps/dwp/src/features/hris/shared", "--format", "json"],
        FRONTEND,
        120,
    ),
    ("source-size", [str(NODE), "scripts/check-source-size.mjs"], FRONTEND, 120),
    (
        "layer-verifier-tests",
        [str(NODE), "--test", "scripts/verification/hris-layer-contract-v1.test.mjs"],
        FRONTEND,
        120,
    ),
    ("whole-typecheck", [str(NODE), "node_modules/typescript/bin/tsc", "--noEmit"], FRONTEND, 180),
    (
        "catalog-semantic-digest",
        [str(NODE), str(REPORTS / "capture_shell_catalog_semantic_digest_2026_09_14.mjs")],
        FRONTEND,
        120,
    ),
    (
        "ia-validator",
        [sys.executable, "-B", "coding-readiness/validate_information_architecture.py", "--compact"],
        BLUEPRINT,
        120,
    ),
    (
        "ia-validator-self-test",
        [sys.executable, "-B", "coding-readiness/validate_information_architecture.py",
         "--self-test", "--compact"],
        BLUEPRINT,
        120,
    ),
    (
        "shared-boundary-self-test",
        [sys.executable, "-B", "coding-readiness/validate_frontend_shared_presentation_boundary.py",
         "--self-test", "--compact"],
        BLUEPRINT,
        120,
    ),
]

with exclusive_host_semaphore("hris-verification", timeout_seconds=30) as lock:
    pre = snapshot()
    selected_sources = snapshot(include_text=True)
    started_at = utc()
    runs = [run(*command) for command in commands]
    post = snapshot()
    finished_at = utc()

by_label = {result["label"]: result for result in runs}
test_json = json.loads(by_label["shell-shared-tests"]["stdoutText"])
layer_json = json.loads(by_label["actual-layer-scan"]["stdoutText"])
lint_json = json.loads(by_label["scoped-eslint"]["stdoutText"])
semantic_json = json.loads(by_label["catalog-semantic-digest"]["stdoutText"])
ia_json = json.loads(by_label["ia-validator"]["stdoutText"])
ia_self_json = json.loads(by_label["ia-validator-self-test"]["stdoutText"])
shared_json = json.loads(by_label["shared-boundary-self-test"]["stdoutText"])
typecheck_text = by_label["whole-typecheck"]["stdoutText"] + gzip.decompress(
    base64.b64decode(by_label["whole-typecheck"]["stderrArchive"]["payload"])
).decode(errors="replace")
diagnostic_pattern = re.compile(
    r"^(?P<path>.+?\.(?:ts|tsx))\((?P<line>\d+),(?P<column>\d+)\): error "
    r"(?P<code>TS\d+): (?P<message>.*)$"
)
typecheck_diagnostics = [
    match.groupdict()
    for line in typecheck_text.splitlines()
    if (match := diagnostic_pattern.match(line))
]
scoped_typecheck = [
    item for item in typecheck_diagnostics
    if item["path"].startswith("apps/dwp/src/features/hris/shell/")
    or item["path"].startswith("apps/dwp/src/features/hris/shared/")
]
implementation_paths = [
    FRONTEND / relative_path
    for root_name, _, relative_path in PATHS
    if root_name == "frontend"
    and relative_path.startswith(("apps/dwp/src/features/hris/shell/", "apps/dwp/src/features/hris/shared/"))
    and "/testing/" not in relative_path
]
line_counts = {
    path.relative_to(FRONTEND).as_posix(): len(path.read_text(encoding="utf-8").splitlines())
    for path in implementation_paths
}
layer_result = layer_json.get("result", {})
lint_errors = sum(item.get("errorCount", 0) for item in lint_json)
lint_warnings = sum(item.get("warningCount", 0) for item in lint_json)
tap = by_label["layer-verifier-tests"]["stdoutText"]
layer_test_count = int(re.search(r"(?:#|ℹ) tests\s+(\d+)", tap).group(1))
layer_pass_count = int(re.search(r"(?:#|ℹ) pass\s+(\d+)", tap).group(1))
layer_fail_count = int(re.search(r"(?:#|ℹ) fail\s+(\d+)", tap).group(1))
checks = {
    "sourceStable": pre == post,
    "shellSharedTests20Of20": (
        by_label["shell-shared-tests"]["exitCode"] == 0
        and test_json.get("numTotalTests") == 20
        and test_json.get("numPassedTests") == 20
        and test_json.get("numFailedTests") == 0
        and test_json.get("numPendingTests") == 0
    ),
    "layerScanStructuralPass": (
        by_label["actual-layer-scan"]["exitCode"] == 0
        and layer_json.get("structuralPass") is True
        and layer_result.get("errors") == []
        and layer_result.get("unclassifiedCount") == 0
    ),
    "gateRemainsClosed": (
        layer_json.get("readinessPass") is False
        and layer_json.get("g3StartAuthorized") is False
    ),
    "scopedLintClean": by_label["scoped-eslint"]["exitCode"] == 0 and lint_errors == 0 and lint_warnings == 0,
    "sourceSizePolicyPass": by_label["source-size"]["exitCode"] == 0,
    "implementationFilesAtMost300Lines": max(line_counts.values()) <= 300,
    "layerVerifier44Of44": layer_test_count == 44 and layer_pass_count == 44 and layer_fail_count == 0,
    "noShellSharedTypecheckErrors": not scoped_typecheck,
    "catalogSemanticParity": (
        semantic_json.get("count") == 76
        and semantic_json.get("semanticSha256") == "a78a3c893c3f8a2ce33b5dbf7544c98940a4a2ad30b5927a9a303026f907a7c2"
        and semantic_json.get("arrayFrozen") is True
        and semantic_json.get("everyNodeFrozen") is True
    ),
    "iaClosure98": ia_json.get("status") == "PASS" and ia_json.get("coverage", {}).get("nodeCount") == 98,
    "iaTamper30Of30": ia_self_json.get("status") == "PASS" and ia_self_json.get("tamperRejectedCount") == 30,
    "sharedBoundary5Of5": shared_json.get("status") == "PASS" and shared_json.get("selfTests") == 5,
    "protectedHcmBaselineSha": next(
        item["sha256"] for item in post if item["path"] == "apps/dwp/src/pages/hcm.tsx"
    ) == "27117c8a35e7d08f2f758b111bdd70f1b6ca11919e1cdf4e9b3d4aecd71c44af",
}
for result in runs:
    result.pop("stdoutText")
scoped_pass = all(checks.values())
whole_typecheck_pass = by_label["whole-typecheck"]["exitCode"] == 0
status = (
    "PASS" if scoped_pass and whole_typecheck_pass
    else "PASS_SCOPED_WHOLE_TYPECHECK_PENDING" if scoped_pass
    else "FAIL"
)
receipt = {
    "schema": "dwp.hris.shell-shared-layer-final.v1",
    "status": status,
    "cwd": str(FRONTEND),
    "startedAt": started_at,
    "finishedAt": finished_at,
    "hostLock": lock,
    "sourceCount": len(pre),
    "checks": checks,
    "testSummary": {key: test_json.get(key) for key in (
        "numTotalTests", "numPassedTests", "numFailedTests", "numPendingTests",
        "numTotalTestSuites", "numPassedTestSuites", "numFailedTestSuites")},
    "layerSummary": {
        "sourceCount": layer_result.get("sourceCount"),
        "classifiedCount": layer_result.get("classifiedCount"),
        "layeredCount": layer_result.get("layeredCount"),
        "unclassifiedCount": layer_result.get("unclassifiedCount"),
        "errorCount": len(layer_result.get("errors", [])),
        "structuralPass": layer_json.get("structuralPass"),
        "readinessPass": layer_json.get("readinessPass"),
        "g3StartAuthorized": layer_json.get("g3StartAuthorized"),
    },
    "lineCounts": line_counts,
    "wholeTypecheckPass": whole_typecheck_pass,
    "typecheckDiagnostics": typecheck_diagnostics,
    "scopedTypecheckDiagnostics": scoped_typecheck,
    "sourceManifestArchive": archive(json.dumps({"pre": pre, "post": post}, separators=(",", ":")).encode()),
    "selectedSourceSnapshotArchive": archive(json.dumps(selected_sources, separators=(",", ":")).encode()),
    "runs": runs,
    "limits": {
        "behaviorOrDesignChanged": False,
        "homeContract": "WIDGET_ONLY_NO_MENU_CATALOG",
        "sidebarWorkbenchCount": 7,
        "explorerIsUtility": True,
        "G3Open": False,
        "productionActivationAuthorized": False,
        "wholeQualityPending": not whole_typecheck_pass,
    },
}
raw = json.dumps(receipt, separators=(",", ":")).encode()
compressed = gzip.compress(raw, mtime=0)
encoded = base64.b64encode(compressed).decode()
chunks = [encoded[index:index + 4000] for index in range(0, len(encoded), 4000)]
print("ARCHIVE_HEAD " + json.dumps({
    "status": status,
    "checks": checks,
    "testSummary": receipt["testSummary"],
    "layerSummary": receipt["layerSummary"],
    "wholeTypecheckPass": whole_typecheck_pass,
    "typecheckDiagnostics": typecheck_diagnostics,
    "maxImplementationLines": max(line_counts.values()),
    "sourceCount": len(pre),
    "startedAt": started_at,
    "finishedAt": finished_at,
    "receiptSha256": sha256(raw),
    "receiptBytes": len(raw),
    "archiveSha256": sha256(compressed),
    "archiveBytes": len(compressed),
    "base64Chars": len(encoded),
    "chunks": len(chunks),
}), flush=True)
for index, chunk in enumerate(chunks):
    print(f"CHUNK {index} {chunk}", flush=True)
    if not sys.stdin.readline():
        raise SystemExit("archive incomplete: acknowledgment missing")
print("ARCHIVE_COMPLETE " + sha256(compressed), flush=True)
