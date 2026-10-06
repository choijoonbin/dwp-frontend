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
sys.path.insert(
    0,
    "/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0",
)
from host_semaphore import exclusive_host_semaphore

ROOT = Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend")
TIME = ROOT / "apps/dwp/src/features/hris/time"
SHARED = ROOT / "apps/dwp/src/features/hris/shared"
STAGE = sys.argv[1]
assert STAGE in {"baseline", "privacy-before", "layered", "privacy-after"}
OUTPUT = Path(sys.argv[2]) if len(sys.argv) > 2 else None

feature_paths = [
    str(path.relative_to(ROOT))
    for directory in (TIME, SHARED)
    for path in directory.rglob("*")
    if path.is_file() and path.suffix in {".ts", ".tsx"}
]
paths = sorted(
    set(feature_paths)
    | {
        "apps/dwp/vitest.config.ts",
        "package.json",
        "yarn.lock",
        "vitest.config.ts",
        "tsconfig.base.json",
        "tsconfig.json",
        "libs/shared-utils/src/axios-instance.ts",
        "libs/shared-i18n/src/lib/formatters.ts",
        "libs/shared-i18n/src/index.ts",
        "apps/dwp/src/components/use-product-action-mutation.ts",
        "apps/dwp/src/components/use-product-surface-request-scope.ts",
    }
)
paths = [path for path in paths if (ROOT / path).is_file()]


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def archive(value: bytes) -> dict:
    return {
        "sha256": sha256(value),
        "bytes": len(value),
        "gzipBase64": base64.b64encode(gzip.compress(value, mtime=0)).decode(),
    }


def snapshot() -> list[dict]:
    return [
        {
            "path": path,
            "sha256": sha256((ROOT / path).read_bytes()),
            "mtimeNs": str((ROOT / path).stat().st_mtime_ns),
        }
        for path in paths
    ]


argv = [
    "/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node",
    "node_modules/vitest/vitest.mjs",
    "run",
    "--project",
    "dwp-app",
    "apps/dwp/src/features/hris/time/",
    "--maxWorkers=1",
    "--reporter=json",
]
with exclusive_host_semaphore("hris-verification", timeout_seconds=30) as lock:
    pre = snapshot()
    started_at = datetime.now(timezone.utc).isoformat()
    started = time.monotonic()
    selected_snapshots = [
        {
            "path": path,
            "utf8": (ROOT / path).read_text(),
            "sha256": sha256((ROOT / path).read_bytes()),
            "mtimeNs": str((ROOT / path).stat().st_mtime_ns),
        }
        for path in feature_paths
    ]
    try:
        completed = subprocess.run(argv, cwd=ROOT, capture_output=True, timeout=90)
        stdout = completed.stdout
        stderr = completed.stderr
        exit_code = completed.returncode
        timed_out = False
    except subprocess.TimeoutExpired as error:
        stdout = error.stdout or b""
        stderr = error.stderr or b""
        exit_code = 1
        timed_out = True
    finished_at = datetime.now(timezone.utc).isoformat()
    duration_seconds = time.monotonic() - started
    post = snapshot()

try:
    text = stdout.decode()
    offset = text.find('{"numTotalTestSuites"')
    result = json.loads(text[offset:]) if offset >= 0 else {}
    count_names = [
        "numTotalTests",
        "numPassedTests",
        "numFailedTests",
        "numPendingTests",
        "numTotalTestSuites",
        "numPassedTestSuites",
        "numFailedTestSuites",
    ]
    counts = {name: result.get(name) for name in count_names}
    cases = [
        {
            "name": case["fullName"],
            "status": case["status"],
            "messages": case.get("failureMessages", []),
        }
        for test_file in result.get("testResults", [])
        for case in test_file.get("assertionResults", [])
    ]
except Exception as error:
    counts = {}
    cases = [{"parse": str(error)}]

receipt = {
    "status": "ACTUAL_FAIL_BEFORE_PRESERVED" if exit_code else "ACTUAL_PASS",
    "stage": STAGE,
    "argv": argv,
    "cwd": str(ROOT),
    "startedAt": started_at,
    "finishedAt": finished_at,
    "durationSeconds": duration_seconds,
    "exitCode": exit_code,
    "timeout": timed_out,
    "counts": counts,
    "caseResults": cases,
    "sourceCount": len(pre),
    "sourceStable": pre == post,
    "sourceManifestArchive": archive(
        json.dumps({"pre": pre, "post": post}, separators=(",", ":")).encode()
    ),
    "selectedSourceSnapshotArchive": archive(
        json.dumps(selected_snapshots, separators=(",", ":")).encode()
    ),
    "stdoutArchive": archive(stdout),
    "stderrArchive": archive(stderr),
    "hostLock": lock,
    "limits": {
        "nativeSourceCalls": 0,
        "apiAndAuthorityMocks": True,
        "browserRun": False,
        "g3Open": False,
    },
}
receipt["status"] = (
    "PASS"
    if not timed_out
    and exit_code == 0
    and pre == post
    and counts.get("numTotalTests", 0) > 0
    and counts.get("numPassedTests") == counts.get("numTotalTests")
    and counts.get("numFailedTests") == 0
    and counts.get("numPendingTests") == 0
    and len(cases) == counts.get("numTotalTests")
    and all(case["status"] == "passed" for case in cases)
    else "FAIL"
)
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
            "status": receipt["status"],
            "counts": counts,
            "sourceCount": len(pre),
            "sourceStable": pre == post,
            "startedAt": started_at,
            "finishedAt": finished_at,
            "durationSeconds": duration_seconds,
            "hostLock": lock,
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
