#!/usr/bin/env python3
"""Independently read back the final shell/shared lossless evidence."""

import base64
import gzip
import hashlib
import json
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True

BLUEPRINT = Path("/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09")
FRONTEND = Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend")
REPLAY = BLUEPRINT / "coding-readiness/reports/frontend-shell-shared-layer-final-lossless-replay-2026-09-14.json"


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def unpack(value: dict) -> bytes:
    compressed = base64.b64decode(value["payload"], validate=True)
    assert sha256(compressed) == value["archiveSha256"]
    raw = gzip.decompress(compressed)
    assert sha256(raw) == value["sha256"] and len(raw) == value["bytes"]
    return raw


envelope = json.loads(REPLAY.read_text(encoding="utf-8"))
header = envelope["header"]
assert envelope["schema"] == "dwp.hris.shell-shared-layer-final-replay.v1"
assert [item["index"] for item in envelope["ackSequence"]] == list(range(header["chunks"]))
assert sum(item["chars"] for item in envelope["ackSequence"]) == header["base64Chars"]
compressed = base64.b64decode(envelope["archive"]["gzipBase64"], validate=True)
assert len(compressed) == header["archiveBytes"]
assert sha256(compressed) == header["archiveSha256"]
raw = gzip.decompress(compressed)
assert len(raw) == header["receiptBytes"] and sha256(raw) == header["receiptSha256"]
receipt = json.loads(raw)
assert receipt["schema"] == "dwp.hris.shell-shared-layer-final.v1"
assert receipt["status"] == "PASS" and all(receipt["checks"].values())
assert receipt["wholeTypecheckPass"] is True and receipt["typecheckDiagnostics"] == []
assert receipt["scopedTypecheckDiagnostics"] == []
assert receipt["limits"] == {
    "behaviorOrDesignChanged": False,
    "homeContract": "WIDGET_ONLY_NO_MENU_CATALOG",
    "sidebarWorkbenchCount": 7,
    "explorerIsUtility": True,
    "G3Open": False,
    "productionActivationAuthorized": False,
    "wholeQualityPending": False,
}

source_manifest = json.loads(unpack(receipt["sourceManifestArchive"]))
assert source_manifest["pre"] == source_manifest["post"]
assert len(source_manifest["pre"]) == receipt["sourceCount"] == 53
roots = {"frontend": FRONTEND, "blueprint": BLUEPRINT}
for item in source_manifest["post"]:
    path = roots[item["root"]] / item["path"]
    assert sha256(path.read_bytes()) == item["sha256"]
    assert str(path.stat().st_mtime_ns) == item["mtimeNs"]

selected = json.loads(unpack(receipt["selectedSourceSnapshotArchive"]))
selected_text = [item for item in selected if "utf8" in item]
assert len(selected_text) == 21
for item in selected_text:
    raw_source = item["utf8"].encode()
    path = roots[item["root"]] / item["path"]
    assert sha256(raw_source) == item["sha256"] == sha256(path.read_bytes())

runs = {item["label"]: item for item in receipt["runs"]}
assert set(runs) == {
    "shell-shared-tests", "actual-layer-scan", "scoped-eslint", "source-size",
    "layer-verifier-tests", "whole-typecheck", "catalog-semantic-digest",
    "ia-validator", "ia-validator-self-test", "shared-boundary-self-test",
}
outputs: dict[str, bytes] = {}
for label, run in runs.items():
    assert run["timedOut"] is False
    outputs[label] = unpack(run["stdoutArchive"])
    unpack(run["stderrArchive"])

tests = json.loads(outputs["shell-shared-tests"])
assert tests["numTotalTests"] == tests["numPassedTests"] == 20
assert tests["numFailedTests"] == tests["numPendingTests"] == 0
test_cases = [
    case
    for test_file in tests["testResults"]
    for case in test_file["assertionResults"]
]
assert len(test_cases) == 20 and all(case["status"] == "passed" for case in test_cases)

layer = json.loads(outputs["actual-layer-scan"])
assert layer["structuralPass"] is True and layer["result"]["errors"] == []
assert layer["result"]["unclassifiedCount"] == 0
assert layer["readinessPass"] is False and layer["g3StartAuthorized"] is False

lint = json.loads(outputs["scoped-eslint"])
assert sum(item["errorCount"] for item in lint) == 0
assert sum(item["warningCount"] for item in lint) == 0
assert runs["source-size"]["exitCode"] == 0
assert max(receipt["lineCounts"].values()) == 294
assert all(value <= 300 for value in receipt["lineCounts"].values())

tap = outputs["layer-verifier-tests"].decode()
assert re.search(r"(?:#|ℹ) tests\s+44", tap)
assert re.search(r"(?:#|ℹ) pass\s+44", tap)
assert re.search(r"(?:#|ℹ) fail\s+0", tap)
assert runs["whole-typecheck"]["exitCode"] == 0

semantic = json.loads(outputs["catalog-semantic-digest"])
assert semantic == {
    "schema": "dwp.hris.shell-catalog-semantic-digest.v1",
    "count": 76,
    "ids": semantic["ids"],
    "arrayFrozen": True,
    "everyNodeFrozen": True,
    "semanticJsonBytes": 40909,
    "semanticSha256": "a78a3c893c3f8a2ce33b5dbf7544c98940a4a2ad30b5927a9a303026f907a7c2",
}
assert len(semantic["ids"]) == len(set(semantic["ids"])) == 76

ia = json.loads(outputs["ia-validator"])
ia_self = json.loads(outputs["ia-validator-self-test"])
shared = json.loads(outputs["shared-boundary-self-test"])
assert ia["status"] == "PASS" and ia["coverage"]["nodeCount"] == 98
assert ia["coverage"]["sidebarWorkbenchEntryCount"] == 7
assert ia["coverage"]["fixedHomeEntryCount"] == ia["coverage"]["explorerUtilityEntryCount"] == 1
assert ia_self["status"] == "PASS" and ia_self["tamperRejectedCount"] == ia_self["tamperCaseCount"] == 30
assert shared["status"] == "PASS" and shared["selfTests"] == 5

print(json.dumps({
    "schema": "dwp.hris.shell-shared-layer-final-readback.v1",
    "status": "PASS",
    "receiptSha256": sha256(raw),
    "archiveSha256": sha256(compressed),
    "sourceCount": receipt["sourceCount"],
    "currentSourceShaAndNsStable": True,
    "selectedActualSourceCount": len(selected_text),
    "testCount": len(test_cases),
    "layerVerifierTestCount": 44,
    "layerErrors": 0,
    "unclassifiedCount": 0,
    "maxImplementationLines": max(receipt["lineCounts"].values()),
    "catalogCount": semantic["count"],
    "catalogSemanticSha256": semantic["semanticSha256"],
    "iaNodeCount": ia["coverage"]["nodeCount"],
    "iaTamperRejectedCount": ia_self["tamperRejectedCount"],
    "sharedBoundarySelfTests": shared["selfTests"],
    "wholeTypecheckPass": receipt["wholeTypecheckPass"],
    "readinessPass": layer["readinessPass"],
    "g3StartAuthorized": layer["g3StartAuthorized"],
    "hostLock": receipt["hostLock"],
}, separators=(",", ":")))
