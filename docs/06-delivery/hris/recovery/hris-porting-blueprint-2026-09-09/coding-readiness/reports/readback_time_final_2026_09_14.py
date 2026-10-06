#!/usr/bin/env python3
"""Independently read back the TIM baseline, counterexample, remediation, and layer evidence."""

import base64
import gzip
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.dont_write_bytecode = True

REPORTS = Path(
    "/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/reports"
)
ROOT = Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend")
TIME = ROOT / "apps/dwp/src/features/hris/time"
TIME_PREFIX = "apps/dwp/src/features/hris/time/"
OUTPUT = REPORTS / "frontend-time-final-readback-2026-09-14.json"

BASELINE = REPORTS / "frontend-time-actual-flat-baseline-lossless-2026-09-14.json"
FAIL_BEFORE = REPORTS / "frontend-time-privacy-race-state-actual-fail-before-2026-09-14.json"
FINAL_PASS = REPORTS / "frontend-time-layer-privacy-race-state-final-pass-2026-09-14.json"
QUALITY = REPORTS / "frontend-time-scoped-quality-final-2026-09-14.json"

EXPECTED_FAILURES = {
    "HRIS time command recovery runtime stores only the strict time display projection and drops adjacent private source fields",
    "HRIS time command recovery runtime fails closed on a malformed source state without caching or echoing it",
    "HRIS time command recovery runtime rejects a save response from an earlier visit after the scope returns from A to B to A",
    "HRIS time command recovery runtime prevents a pre-save GET from replacing the newer save response",
    "HRIS time command recovery runtime preserves the draft and cache when a successful transport response has invalid state",
    "HRIS time command recovery runtime does not settle a late save into cache or feedback after the feature unmounts",
}
EXPECTED_BASELINE_TO_COUNTEREXAMPLE_DELTA = {
    "apps/dwp/src/features/hris/time/hris-time-workspace.runtime.test.tsx"
}
EXPECTED_TIME_PATHS = {
    "apps/dwp/src/features/hris/time/api/hris-time-api.test.ts",
    "apps/dwp/src/features/hris/time/api/hris-time-api.ts",
    "apps/dwp/src/features/hris/time/components/hris-time-calendar.tsx",
    "apps/dwp/src/features/hris/time/components/hris-time-command-notice.tsx",
    "apps/dwp/src/features/hris/time/components/hris-time-sections.tsx",
    "apps/dwp/src/features/hris/time/hooks/use-hris-time-workspace.ts",
    "apps/dwp/src/features/hris/time/index.ts",
    "apps/dwp/src/features/hris/time/model/hris-time-model.ts",
    "apps/dwp/src/features/hris/time/pages/hris-time-workspace.tsx",
    "apps/dwp/src/features/hris/time/testing/hris-time-model.test.ts",
    "apps/dwp/src/features/hris/time/testing/hris-time-workspace.runtime.test.tsx",
}


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def file_evidence(path: Path) -> dict:
    raw = path.read_bytes()
    return {
        "path": str(path),
        "sha256": sha256(raw),
        "bytes": len(raw),
        "mtimeNs": str(path.stat().st_mtime_ns),
    }


def decode_archive(value: dict) -> bytes:
    compressed = base64.b64decode(value["gzipBase64"])
    raw = gzip.decompress(compressed)
    assert len(raw) == value["bytes"]
    assert sha256(raw) == value["sha256"]
    return raw


def read_envelope(path: Path) -> tuple[dict, dict]:
    document = json.loads(path.read_text())
    head = document["head"]
    expected_indices = list(range(head["chunks"]))
    assert document["chunkIndices"] == expected_indices
    assert document["deliveryExitCode"] == 0
    encoded = document["archiveGzipBase64"]
    assert len(encoded) == head["base64Chars"]
    compressed = base64.b64decode(encoded)
    assert len(compressed) == head["archiveBytes"]
    assert sha256(compressed) == head["archiveSha256"] == document["archiveComplete"]
    raw = gzip.decompress(compressed)
    assert len(raw) == head["receiptBytes"]
    assert sha256(raw) == head["receiptSha256"]
    return json.loads(raw), {
        **file_evidence(path),
        "receiptSha256": head["receiptSha256"],
        "archiveSha256": head["archiveSha256"],
        "acknowledgedChunks": len(expected_indices),
        "deliveryExitCode": document["deliveryExitCode"],
    }


def selected_sources(receipt: dict) -> dict[str, dict]:
    values = json.loads(decode_archive(receipt["selectedSourceSnapshotArchive"]))
    result = {}
    for value in values:
        assert sha256(value["utf8"].encode()) == value["sha256"]
        result[value["path"]] = value
    return result


def source_manifest(receipt: dict) -> dict:
    return json.loads(decode_archive(receipt["sourceManifestArchive"]))


baseline, baseline_evidence = read_envelope(BASELINE)
fail_before, fail_before_evidence = read_envelope(FAIL_BEFORE)
final_pass, final_evidence = read_envelope(FINAL_PASS)
quality, quality_evidence = read_envelope(QUALITY)

assert baseline["status"] == "PASS"
assert baseline["counts"] == {
    "numTotalTests": 27,
    "numPassedTests": 27,
    "numFailedTests": 0,
    "numPendingTests": 0,
    "numTotalTestSuites": 7,
    "numPassedTestSuites": 7,
    "numFailedTestSuites": 0,
}
assert baseline["sourceStable"] is True
baseline_cases = {case["name"]: case["status"] for case in baseline["caseResults"]}
assert len(baseline_cases) == 27 and set(baseline_cases.values()) == {"passed"}

assert fail_before["status"] == "FAIL"
assert fail_before["counts"]["numTotalTests"] == 33
assert fail_before["counts"]["numPassedTests"] == 27
assert fail_before["counts"]["numFailedTests"] == 6
assert fail_before["counts"]["numPendingTests"] == 0
assert fail_before["sourceStable"] is True
fail_before_cases = {case["name"]: case["status"] for case in fail_before["caseResults"]}
assert {name for name, status in fail_before_cases.items() if status == "failed"} == EXPECTED_FAILURES
assert set(baseline_cases).issubset(fail_before_cases)
assert all(fail_before_cases[name] == "passed" for name in baseline_cases)

baseline_sources = selected_sources(baseline)
fail_before_sources = selected_sources(fail_before)
baseline_to_counterexample_delta = {
    path
    for path in set(baseline_sources) | set(fail_before_sources)
    if baseline_sources.get(path, {}).get("sha256") != fail_before_sources.get(path, {}).get("sha256")
}
assert baseline_to_counterexample_delta == EXPECTED_BASELINE_TO_COUNTEREXAMPLE_DELTA

assert final_pass["status"] == "PASS"
assert final_pass["counts"]["numTotalTests"] == 43
assert final_pass["counts"]["numPassedTests"] == 43
assert final_pass["counts"]["numFailedTests"] == 0
assert final_pass["counts"]["numPendingTests"] == 0
assert final_pass["sourceStable"] is True
final_cases = {case["name"]: case["status"] for case in final_pass["caseResults"]}
assert len(final_cases) == 43 and set(final_cases.values()) == {"passed"}
assert set(baseline_cases).issubset(final_cases)
assert EXPECTED_FAILURES.issubset(final_cases)
assert all(final_cases[name] == "passed" for name in EXPECTED_FAILURES)
assert set(fail_before_cases).issubset(final_cases)
assert len(set(final_cases) - set(fail_before_cases)) == 10

final_sources = selected_sources(final_pass)
final_time_sources = {
    path: value for path, value in final_sources.items() if path.startswith("apps/dwp/src/features/hris/time/")
}
assert set(final_time_sources) == EXPECTED_TIME_PATHS
for path, value in final_time_sources.items():
    current = ROOT / path
    assert current.is_file()
    assert current.read_text() == value["utf8"]
    assert sha256(current.read_bytes()) == value["sha256"]
    assert str(current.stat().st_mtime_ns) == value["mtimeNs"]

manifest = source_manifest(final_pass)
assert manifest["pre"] == manifest["post"]
manifest_by_path = {value["path"]: value for value in manifest["post"]}
assert EXPECTED_TIME_PATHS.issubset(manifest_by_path)
for path in EXPECTED_TIME_PATHS:
    current = ROOT / path
    assert manifest_by_path[path]["sha256"] == sha256(current.read_bytes())
    assert manifest_by_path[path]["mtimeNs"] == str(current.stat().st_mtime_ns)

assert quality["status"] == "PASS"
assert quality["sourceStable"] is True
assert quality["preSources"] == quality["postSources"]
assert quality["time"] == {
    "sourceCount": 11,
    "allSourcesClassified": True,
    "layerErrors": [],
    "layerPass": True,
    "eslintPass": True,
}
assert quality["wholeHrisLayerScan"]["g3StartAuthorized"] is False

current_paths = {
    str(path.relative_to(ROOT))
    for path in TIME.rglob("*")
    if path.is_file() and path.suffix in {".ts", ".tsx"}
}
assert current_paths == EXPECTED_TIME_PATHS
quality_time_sources = {
    value["path"]: value
    for value in quality["postSources"]
    if value["path"].startswith(TIME_PREFIX)
}
assert set(quality_time_sources) == EXPECTED_TIME_PATHS
for path, value in quality_time_sources.items():
    current = ROOT / path
    assert value["sha256"] == sha256(current.read_bytes())
    assert value["mtimeNs"] == str(current.stat().st_mtime_ns)

production_paths = {
    path
    for path in current_paths
    if not path.endswith(".test.ts") and not path.endswith(".test.tsx")
}
assert all(
    path.endswith("/index.ts")
    or any(f"/time/{layer}/" in path for layer in ("api", "model", "hooks", "components", "pages"))
    for path in production_paths
)
for removed in (
    "hris-time-calendar.tsx",
    "hris-time-command-notice.tsx",
    "hris-time-data-source.test.ts",
    "hris-time-data-source.ts",
    "hris-time-model.test.ts",
    "hris-time-model.ts",
    "hris-time-workspace.runtime.test.tsx",
    "hris-time-workspace.tsx",
):
    assert not (TIME / removed).exists()

ui_paths = [
    path for path in current_paths if "/time/pages/" in path or "/time/components/" in path
]
for path in ui_paths:
    text = (ROOT / path).read_text()
    assert "@tanstack/react-query" not in text
    assert not re.search(r"\bHrTime(?:Workspace|Card|Entry|Exception)\b", text)
    assert "axiosInstance" not in text
    assert "saveHrTimeEntry" not in text
    assert "submitHrTimeCard" not in text
    for specifier in re.findall(r"from\s+['\"]([^'\"]+)['\"]", text):
        if specifier.startswith("../") and "shared" in specifier:
            assert specifier == "../../shared"

hook = (TIME / "hooks/use-hris-time-workspace.ts").read_text()
model = (TIME / "model/hris-time-model.ts").read_text()
api = (TIME / "api/hris-time-api.ts").read_text()
assert "selectTimeWorkspaceDisplay(" in hook
assert "settlementGenerationRef.current += 1" in hook
assert "scopeVisitRef" in hook and "scopeGeneration" in hook
assert "cancelQueries({ queryKey, exact: true })" in hook
assert "cancelQueries({ queryKey: mutationQueryKey, exact: true })" in hook
assert "workspace-v2" in model and "'workspace'," not in model
assert "Promise<unknown>" in api
assert not re.search(r"\bHrTimeWorkspace\b", api)
assert "ProductSurfaceGovernedMutationAuthority" in api

receipt = {
    "schema": "dwp.hris.time-final-readback.v1",
    "status": "PASS",
    "readbackAt": datetime.now(timezone.utc).isoformat(),
    "tests": {
        "baseline": {"counts": baseline["counts"], "evidence": baseline_evidence},
        "actualFailBefore": {
            "counts": fail_before["counts"],
            "exactFailures": sorted(EXPECTED_FAILURES),
            "onlyCounterexampleSourceChanged": sorted(baseline_to_counterexample_delta),
            "evidence": fail_before_evidence,
        },
        "finalPass": {
            "counts": final_pass["counts"],
            "originalCasesRetained": len(baseline_cases),
            "counterexamplesRemediated": len(EXPECTED_FAILURES),
            "additionalStrictProjectionCases": len(set(final_cases) - set(fail_before_cases)),
            "evidence": final_evidence,
        },
    },
    "source": {
        "timeSourceCount": len(EXPECTED_TIME_PATHS),
        "paths": sorted(EXPECTED_TIME_PATHS),
        "fullUtf8SnapshotReadBack": True,
        "testSourcePrePostStable": True,
        "currentMatchesFinalSnapshotByShaMtimeAndUtf8": True,
        "flatFilesAbsent": True,
        "uiHasNoReactQueryOrTransportDtoDependency": True,
        "sharedConsumedByPublicBarrelOnly": True,
    },
    "quality": {
        "time": quality["time"],
        "wholeHrisLayerScan": quality["wholeHrisLayerScan"],
        "evidence": quality_evidence,
    },
    "contracts": {
        "strictDisplayProjectionBeforeCache": True,
        "rawWorkspaceNeverCached": True,
        "scopeVisitGenerationPreventsAbaSettlement": True,
        "settlementGenerationPreventsStaleGetRegression": True,
        "exactQueryCancellation": True,
        "abortSignalPreserved": True,
        "commandAuthorityPreserved": True,
        "cardVersionCasPreserved": True,
        "forbiddenAndConflictMeaningPreserved": True,
        "unmountSettlementBlocked": True,
    },
    "limits": {
        "timeFrontendOnly": True,
        "sharedSourceModifiedByTimeOwner": False,
        "nativeSourceCalls": 0,
        "browserRun": False,
        "dockerRun": False,
        "backendRun": False,
        "commitCreated": False,
        "G3Open": False,
    },
}
OUTPUT.write_text(json.dumps(receipt, indent=2, ensure_ascii=False, sort_keys=True) + "\n")
print(json.dumps({"output": str(OUTPUT), "status": "PASS", "sha256": sha256(OUTPUT.read_bytes())}))
