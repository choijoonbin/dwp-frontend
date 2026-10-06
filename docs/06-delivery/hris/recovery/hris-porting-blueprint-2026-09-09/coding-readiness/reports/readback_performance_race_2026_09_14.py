import base64
import gzip
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.dont_write_bytecode = True

REPORT_ROOT = Path(
    "/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/reports"
)
SOURCE_ROOT = Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend")
OLD_PASS = REPORT_ROOT / "frontend-performance-provenance-root-remediation-pass-2026-09-14.json"
FAIL_BEFORE = REPORT_ROOT / "frontend-performance-race-root-actual-fail-before-2026-09-14.json"
PASS_AFTER = REPORT_ROOT / "frontend-performance-race-root-remediation-pass-2026-09-14.json"
EXPECTED_FAILURES = {
    "HRIS performance Phase 1 runtime rejects a late mutation from an earlier visit after the scope returns from A to B to A",
    "HRIS performance Phase 1 runtime prevents a pre-mutation GET from replacing a newer mutation response",
}


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def unpack_archive(archive: dict) -> bytes:
    compressed = base64.b64decode(archive["gzipBase64"], validate=True)
    raw = gzip.decompress(compressed)
    assert len(raw) == archive["bytes"]
    assert sha256(raw) == archive["sha256"]
    return raw


def read_envelope(path: Path) -> tuple[dict, dict, bytes]:
    envelope = json.loads(path.read_text())
    encoded = envelope["archiveGzipBase64"]
    assert envelope["chunkIndices"] == list(range(envelope["head"]["chunks"]))
    assert len(encoded) == envelope["head"]["base64Chars"]
    assert envelope["deliveryExitCode"] == 0
    compressed = base64.b64decode(encoded, validate=True)
    assert len(compressed) == envelope["head"]["archiveBytes"]
    assert sha256(compressed) == envelope["head"]["archiveSha256"]
    assert sha256(compressed) == envelope["archiveComplete"]
    raw = gzip.decompress(compressed)
    assert len(raw) == envelope["head"]["receiptBytes"]
    assert sha256(raw) == envelope["head"]["receiptSha256"]
    receipt = json.loads(raw)
    for field in (
        "status",
        "counts",
        "sourceCount",
        "sourceStable",
        "startedAt",
        "finishedAt",
    ):
        assert receipt[field] == envelope["head"][field]
    assert receipt["hostLock"] == envelope["head"]["hostLock"]
    assert receipt["hostLock"]["status"] == "RELEASED"
    assert receipt["timeout"] is False
    assert receipt["sourceStable"] is True
    assert receipt["limits"] == {
        "nativeSourceCalls": 0,
        "apiAndAuthorityMocks": True,
        "g3Open": False,
    }
    for archive_name in (
        "sourceManifestArchive",
        "selectedSourceSnapshotArchive",
        "stdoutArchive",
        "stderrArchive",
    ):
        unpack_archive(receipt[archive_name])
    return envelope, receipt, raw


old_envelope, old_receipt, _ = read_envelope(OLD_PASS)
before_envelope, before, before_raw = read_envelope(FAIL_BEFORE)
after_envelope, after, after_raw = read_envelope(PASS_AFTER)

assert old_receipt["status"] == "PASS"
assert old_receipt["counts"] == {
    "numTotalTests": 60,
    "numPassedTests": 60,
    "numFailedTests": 0,
    "numPendingTests": 0,
    "numTotalTestSuites": 8,
    "numPassedTestSuites": 8,
    "numFailedTestSuites": 0,
}
assert before["status"] == "FAIL"
assert before["counts"]["numTotalTests"] == 62
assert before["counts"]["numPassedTests"] == 60
assert before["counts"]["numFailedTests"] == 2
assert before["counts"]["numPendingTests"] == 0
assert after["status"] == "PASS"
assert after["counts"] == {
    "numTotalTests": 62,
    "numPassedTests": 62,
    "numFailedTests": 0,
    "numPendingTests": 0,
    "numTotalTestSuites": 8,
    "numPassedTestSuites": 8,
    "numFailedTestSuites": 0,
}

old_cases = {case["name"]: case["status"] for case in old_receipt["caseResults"]}
before_cases = {case["name"]: case["status"] for case in before["caseResults"]}
after_cases = {case["name"]: case["status"] for case in after["caseResults"]}
assert len(old_cases) == len(old_receipt["caseResults"]) == 60
assert len(before_cases) == len(before["caseResults"]) == 62
assert len(after_cases) == len(after["caseResults"]) == 62
assert set(before_cases) == set(after_cases) == set(old_cases) | EXPECTED_FAILURES
assert all(before_cases[name] == "passed" for name in old_cases)
assert {name for name, status in before_cases.items() if status == "failed"} == EXPECTED_FAILURES
assert all(status == "passed" for status in after_cases.values())


def selected_sources(receipt: dict) -> dict[str, dict]:
    snapshots = json.loads(unpack_archive(receipt["selectedSourceSnapshotArchive"]))
    result = {item["path"]: item for item in snapshots}
    assert len(result) == len(snapshots) == 10
    for path, item in result.items():
        content = item["utf8"].encode()
        assert sha256(content) == item["sha256"]
        assert path.startswith("apps/dwp/src/features/hris/performance/")
    return result


old_sources = selected_sources(old_receipt)
before_sources = selected_sources(before)
after_sources = selected_sources(after)
runtime_path = (
    "apps/dwp/src/features/hris/performance/testing/"
    "hris-performance-workspace.runtime.test.tsx"
)
hook_path = (
    "apps/dwp/src/features/hris/performance/hooks/"
    "use-hris-performance-workspace.ts"
)
old_to_before = {
    path for path in old_sources if old_sources[path]["sha256"] != before_sources[path]["sha256"]
}
before_to_after = {
    path
    for path in before_sources
    if before_sources[path]["sha256"] != after_sources[path]["sha256"]
}
assert old_to_before == {runtime_path}
assert before_to_after == {hook_path}
assert before_sources[hook_path]["sha256"] == (
    "38c32b326e35a83c40cf12e612e8c8c4b703ff42809e56cedb8c08ec72b9b1a7"
)
assert after_sources[hook_path]["sha256"] == (
    "bb97b6f56ed225fa07ea22b3acfb73b5d9e4e11cbd026521fb51272218e57eab"
)

current_mismatches = []
for path, item in after_sources.items():
    current = (SOURCE_ROOT / path).read_bytes()
    if sha256(current) != item["sha256"]:
        current_mismatches.append(path)
assert current_mismatches == []

result = {
    "schema": "dwp.hris.performance-race-readback.v1",
    "status": "PASS",
    "readbackAt": datetime.now(timezone.utc).isoformat(),
    "oldSixtyPreserved": True,
    "newCounterexamples": sorted(EXPECTED_FAILURES),
    "before": {
        "startedAt": before["startedAt"],
        "finishedAt": before["finishedAt"],
        "counts": before["counts"],
        "receiptSha256": sha256(before_raw),
        "archiveSha256": before_envelope["archiveComplete"],
        "sourceStable": before["sourceStable"],
    },
    "after": {
        "startedAt": after["startedAt"],
        "finishedAt": after["finishedAt"],
        "counts": after["counts"],
        "receiptSha256": sha256(after_raw),
        "archiveSha256": after_envelope["archiveComplete"],
        "sourceStable": after["sourceStable"],
    },
    "sourceDelta": {
        "oldPassToFailBefore": sorted(old_to_before),
        "failBeforeToPassAfter": sorted(before_to_after),
        "currentMatchesPassSnapshot": current_mismatches == [],
        "fullUtf8Snapshots": len(after_sources),
    },
    "limits": {
        "nativeSourceCalls": 0,
        "g3Open": False,
        "authorityContractChanged": False,
    },
}
print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
