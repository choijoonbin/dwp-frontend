#!/usr/bin/env python3
"""Run TIM-scoped lint and classify TIM findings from the current HRIS layer scan."""

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
TIME_PREFIX = "apps/dwp/src/features/hris/time/"
NODE = "/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
OUTPUT = Path(sys.argv[1]) if len(sys.argv) > 1 else None
COMMANDS = [
    [NODE, "node_modules/eslint/bin/eslint.js", "apps/dwp/src/features/hris/time"],
    [NODE, "scripts/verification/hris-layer-contract-v1.mjs", "--mode", "scan"],
]
LIMIT_SECONDS = 60


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def archive(value: bytes) -> dict:
    return {
        "sha256": sha256(value),
        "bytes": len(value),
        "gzipBase64": base64.b64encode(gzip.compress(value, mtime=0)).decode(),
    }


def selected_paths() -> list[str]:
    selected = {
        str(path.relative_to(ROOT))
        for path in (ROOT / "apps/dwp/src/features/hris").rglob("*")
        if path.is_file() and path.suffix in {".ts", ".tsx"}
    }
    selected.update(
        {
            "eslint.config.mjs",
            "package.json",
            "yarn.lock",
            "tsconfig.base.json",
            "tsconfig.json",
            "scripts/verification/hris-layer-contract-v1.mjs",
            "scripts/verification/fixtures/hris-layer-contract-v1.json",
        }
    )
    return sorted(path for path in selected if (ROOT / path).is_file())


PATHS = selected_paths()


def snapshot() -> list[dict]:
    return [
        {
            "path": path,
            "sha256": sha256((ROOT / path).read_bytes()),
            "mtimeNs": str((ROOT / path).stat().st_mtime_ns),
        }
        for path in PATHS
    ]


results = []
with exclusive_host_semaphore("hris-verification", timeout_seconds=30) as host_lock:
    pre = snapshot()
    started_at = utc_now()
    for argv in COMMANDS:
        command_started_at = utc_now()
        started = time.monotonic()
        try:
            completed = subprocess.run(
                argv,
                cwd=ROOT,
                capture_output=True,
                timeout=LIMIT_SECONDS,
            )
            stdout = completed.stdout
            stderr = completed.stderr
            exit_code = completed.returncode
            timed_out = False
        except subprocess.TimeoutExpired as error:
            stdout = error.stdout or b""
            stderr = error.stderr or b""
            exit_code = None
            timed_out = True
        results.append(
            {
                "argv": argv,
                "timeoutSeconds": LIMIT_SECONDS,
                "startedAt": command_started_at,
                "finishedAt": utc_now(),
                "durationSeconds": time.monotonic() - started,
                "exitCode": exit_code,
                "timedOut": timed_out,
                "stdoutArchive": archive(stdout),
                "stderrArchive": archive(stderr),
            }
        )
    post = snapshot()
    finished_at = utc_now()

layer_evidence = json.loads(
    gzip.decompress(base64.b64decode(results[1]["stdoutArchive"]["gzipBase64"]))
)
layer_result = layer_evidence["result"]
time_sources = {path for path in PATHS if path.startswith(TIME_PREFIX)}
classified = set(layer_result["classified"])


def touches_time(error: dict) -> bool:
    if str(error.get("file", "")).startswith(TIME_PREFIX):
        return True
    return any(str(path).startswith(TIME_PREFIX) for path in error.get("files", []))


time_errors = [error for error in layer_result["errors"] if touches_time(error)]
time_layer_pass = time_sources.issubset(classified) and not time_errors
source_stable = pre == post
status = (
    "PASS"
    if source_stable
    and results[0]["exitCode"] == 0
    and not results[0]["timedOut"]
    and not results[1]["timedOut"]
    and time_layer_pass
    else "FAIL"
)
receipt = {
    "schema": "dwp.hris.time-scoped-quality.v1",
    "status": status,
    "cwd": str(ROOT),
    "startedAt": started_at,
    "finishedAt": finished_at,
    "sourceStable": source_stable,
    "sourceCount": len(pre),
    "preSources": pre,
    "postSources": post,
    "results": results,
    "time": {
        "sourceCount": len(time_sources),
        "allSourcesClassified": time_sources.issubset(classified),
        "layerErrors": time_errors,
        "layerPass": time_layer_pass,
        "eslintPass": results[0]["exitCode"] == 0 and not results[0]["timedOut"],
    },
    "wholeHrisLayerScan": {
        "exitCode": results[1]["exitCode"],
        "structuralPass": layer_evidence["structuralPass"],
        "readinessPass": layer_evidence["readinessPass"],
        "g3StartAuthorized": layer_evidence["g3StartAuthorized"],
        "errorCount": len(layer_result["errors"]),
        "errors": layer_result["errors"],
    },
    "hostLock": host_lock,
    "limits": {
        "timeScopedOnly": True,
        "wholeHrisStructuralPassNotRequiredForThisReceipt": True,
        "nativeSourceCalls": 0,
        "browserRun": False,
        "G3Open": False,
    },
}
raw = json.dumps(receipt, separators=(",", ":")).encode()
if OUTPUT is not None:
    OUTPUT.write_bytes(raw)
compressed = gzip.compress(raw, mtime=0)
encoded = base64.b64encode(compressed).decode()
chunks = [encoded[index : index + 4000] for index in range(0, len(encoded), 4000)]
print(
    "ARCHIVE_HEAD "
    + json.dumps(
        {
            "status": status,
            "time": receipt["time"],
            "wholeHrisLayerScan": {
                key: receipt["wholeHrisLayerScan"][key]
                for key in (
                    "exitCode",
                    "structuralPass",
                    "readinessPass",
                    "g3StartAuthorized",
                    "errorCount",
                )
            },
            "sourceCount": len(pre),
            "sourceStable": source_stable,
            "startedAt": started_at,
            "finishedAt": finished_at,
            "hostLock": host_lock,
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
