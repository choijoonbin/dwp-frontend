import base64
import gzip
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.dont_write_bytecode = True

REPORTS = Path(
    "/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/reports"
)
ROOT = Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend")
FILES = {
    "old": "frontend-performance-provenance-root-remediation-pass-2026-09-14.json",
    "before": "frontend-performance-race-root-actual-fail-before-2026-09-14.json",
    "racePass": "frontend-performance-race-root-remediation-pass-2026-09-14.json",
    "finalPass": "frontend-performance-race-lint-safe-root-final-pass-2026-09-14.json",
    "qualityFail": "frontend-performance-race-scoped-quality-2026-09-14.json",
    "qualityPass": "frontend-performance-race-scoped-quality-final-2026-09-14.json",
}
EXPECTED_FAILURES = {
    "HRIS performance Phase 1 runtime rejects a late mutation from an earlier visit after the scope returns from A to B to A",
    "HRIS performance Phase 1 runtime prevents a pre-mutation GET from replacing a newer mutation response",
}
RUNTIME = (
    "apps/dwp/src/features/hris/performance/testing/"
    "hris-performance-workspace.runtime.test.tsx"
)
HOOK = (
    "apps/dwp/src/features/hris/performance/hooks/"
    "use-hris-performance-workspace.ts"
)
MODEL = (
    "apps/dwp/src/features/hris/performance/model/"
    "performance-goal-model.ts"
)


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def unpack_inner(archive: dict) -> bytes:
    raw = gzip.decompress(base64.b64decode(archive["gzipBase64"], validate=True))
    assert len(raw) == archive["bytes"]
    assert sha256(raw) == archive["sha256"]
    return raw


def unpack_envelope(file_name: str) -> tuple[dict, dict, bytes]:
    envelope = json.loads((REPORTS / file_name).read_text())
    encoded = envelope["archiveGzipBase64"]
    assert envelope["chunkIndices"] == list(range(envelope["head"]["chunks"]))
    assert envelope["deliveryExitCode"] == 0
    assert len(encoded) == envelope["head"]["base64Chars"]
    compressed = base64.b64decode(encoded, validate=True)
    assert len(compressed) == envelope["head"]["archiveBytes"]
    assert sha256(compressed) == envelope["head"]["archiveSha256"]
    assert sha256(compressed) == envelope["archiveComplete"]
    raw = gzip.decompress(compressed)
    assert len(raw) == envelope["head"]["receiptBytes"]
    assert sha256(raw) == envelope["head"]["receiptSha256"]
    receipt = json.loads(raw)
    assert receipt["status"] == envelope["head"]["status"]
    assert receipt["sourceStable"] is True
    assert receipt["hostLock"]["status"] == "RELEASED"
    return envelope, receipt, raw


def case_map(receipt: dict) -> dict[str, str]:
    cases = {case["name"]: case["status"] for case in receipt["caseResults"]}
    assert len(cases) == len(receipt["caseResults"])
    return cases


def source_map(receipt: dict) -> dict[str, dict]:
    values = json.loads(unpack_inner(receipt["selectedSourceSnapshotArchive"]))
    sources = {item["path"]: item for item in values}
    assert len(sources) == len(values) == 10
    for item in values:
        assert sha256(item["utf8"].encode()) == item["sha256"]
    return sources


loaded = {name: unpack_envelope(file_name) for name, file_name in FILES.items()}
old = loaded["old"][1]
before = loaded["before"][1]
race_pass = loaded["racePass"][1]
final_pass = loaded["finalPass"][1]
quality_fail = loaded["qualityFail"][1]
quality_pass = loaded["qualityPass"][1]

assert old["counts"]["numTotalTests"] == old["counts"]["numPassedTests"] == 60
assert old["counts"]["numFailedTests"] == old["counts"]["numPendingTests"] == 0
assert before["counts"]["numTotalTests"] == 62
assert before["counts"]["numPassedTests"] == 60
assert before["counts"]["numFailedTests"] == 2
assert before["counts"]["numPendingTests"] == 0
for receipt in (race_pass, final_pass):
    assert receipt["status"] == "PASS"
    assert receipt["counts"]["numTotalTests"] == receipt["counts"]["numPassedTests"] == 62
    assert receipt["counts"]["numFailedTests"] == receipt["counts"]["numPendingTests"] == 0
    assert receipt["limits"]["nativeSourceCalls"] == 0
    assert receipt["limits"]["g3Open"] is False

old_cases = case_map(old)
before_cases = case_map(before)
race_pass_cases = case_map(race_pass)
final_cases = case_map(final_pass)
assert len(old_cases) == 60
assert len(before_cases) == len(race_pass_cases) == len(final_cases) == 62
assert set(before_cases) == set(race_pass_cases) == set(final_cases) == set(old_cases) | EXPECTED_FAILURES
assert all(before_cases[name] == "passed" for name in old_cases)
assert {name for name, status in before_cases.items() if status == "failed"} == EXPECTED_FAILURES
assert all(status == "passed" for status in race_pass_cases.values())
assert all(status == "passed" for status in final_cases.values())

old_sources = source_map(old)
before_sources = source_map(before)
race_pass_sources = source_map(race_pass)
final_sources = source_map(final_pass)


def delta(left: dict[str, dict], right: dict[str, dict]) -> set[str]:
    assert set(left) == set(right)
    return {path for path in left if left[path]["sha256"] != right[path]["sha256"]}


assert delta(old_sources, before_sources) == {RUNTIME}
assert delta(before_sources, race_pass_sources) == {HOOK}
assert delta(race_pass_sources, final_sources) == {MODEL}
assert before_sources[HOOK]["sha256"] == (
    "38c32b326e35a83c40cf12e612e8c8c4b703ff42809e56cedb8c08ec72b9b1a7"
)
assert final_sources[HOOK]["sha256"] == (
    "bb97b6f56ed225fa07ea22b3acfb73b5d9e4e11cbd026521fb51272218e57eab"
)
assert final_sources[MODEL]["sha256"] == (
    "a7d8ef35363f0dcaffdb8d51b96384f3ea819189f5cb48db03eae34b44176f65"
)
assert final_sources[RUNTIME]["sha256"] == (
    "a16a5b28127ee19b4ffa70adbdd7448d9a6bb726438088af2cab0849f9aeebe7"
)

current = []
for path, item in sorted(final_sources.items()):
    source = ROOT / path
    current_sha = sha256(source.read_bytes())
    assert current_sha == item["sha256"]
    current.append(
        {
            "path": path,
            "sha256": current_sha,
            "mtimeNs": str(source.stat().st_mtime_ns),
        }
    )

assert quality_fail["status"] == "FAIL"
assert quality_fail["performance"]["layerPass"] is True
assert quality_fail["performance"]["layerErrors"] == []
assert quality_fail["performance"]["eslintPass"] is False
quality_failure_stdout = unpack_inner(quality_fail["results"][0]["stdoutArchive"]).decode()
assert quality_failure_stdout.count("no-control-regex") == 1
assert "performance-goal-model.ts" in quality_failure_stdout
assert "1 problem (1 error, 0 warnings)" in quality_failure_stdout

assert quality_pass["status"] == "PASS"
assert quality_pass["performance"] == {
    "sourceCount": 10,
    "allSourcesClassified": True,
    "layerErrors": [],
    "layerPass": True,
    "eslintPass": True,
}
assert quality_pass["wholeHrisLayerScan"]["g3StartAuthorized"] is False
assert quality_pass["wholeHrisLayerScan"]["structuralPass"] is False
assert quality_pass["wholeHrisLayerScan"]["errorCount"] == 21
assert quality_pass["limits"]["G3Open"] is False

result = {
    "schema": "dwp.hris.performance-race-final-readback.v1",
    "status": "PASS",
    "readbackAt": datetime.now(timezone.utc).isoformat(),
    "tests": {
        "oldSixtyPreserved": True,
        "counterexamples": sorted(EXPECTED_FAILURES),
        "beforeCounts": before["counts"],
        "finalCounts": final_pass["counts"],
        "finalStartedAt": final_pass["startedAt"],
        "finalFinishedAt": final_pass["finishedAt"],
        "finalReceiptSha256": loaded["finalPass"][0]["head"]["receiptSha256"],
        "finalArchiveSha256": loaded["finalPass"][0]["archiveComplete"],
    },
    "sourceDelta": {
        "oldSixtyToCounterexampleBefore": [RUNTIME],
        "counterexampleBeforeToRacePass": [HOOK],
        "racePassToLintSafeFinal": [MODEL],
        "currentMatchesFinalPass": True,
        "currentSources": current,
    },
    "quality": {
        "historicalLintFailurePreserved": True,
        "performanceEslintPass": True,
        "performanceLayerPass": True,
        "performanceLayerErrors": 0,
        "wholeHrisLayerErrorCountOutsideThisScopedClosure": 21,
        "wholeHrisStructuralPass": False,
    },
    "limits": {
        "nativeSourceCalls": 0,
        "nativeCasOrPepChanged": False,
        "G3Open": False,
        "globalTypecheckPendingCoordinatedStableWindow": True,
    },
}
print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
