#!/usr/bin/env python3
import hashlib
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
RECEIPT = HERE / "sequencing-exit-receipt.v1.json"
REVIEW = HERE / "independent-review.v1.json"


def digest(path: Path) -> tuple[str, int]:
    data = path.read_bytes()
    return hashlib.sha256(data).hexdigest(), len(data)


def require(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def git(repo: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(repo), *args], text=True).strip()


receipt = json.loads(RECEIPT.read_text())
review = json.loads(REVIEW.read_text())

require(receipt["state"] == "HRM013_DEFAULT_OFF_SOURCE_INTEGRATION_SEQUENCE_CLOSED_PAY005_NEXT_EXACT_SLICE", "unexpected receipt state")
require(receipt["matrixSummary"] == {
    "invocationCount": 1, "taskCount": 5, "selectorCount": 21,
    "testCount": 22, "xmlFileCount": 19, "failures": 0,
    "errors": 0, "skipped": 0, "conditionPassCount": 12,
    "broadRepositoryRerunExecuted": False,
}, "matrix summary drift")
require(len(receipt["activationOnlyOpenConditions"]) == 3, "activation-only conditions must remain open")
require(receipt["nextSlice"]["order"] == 2 and receipt["nextSlice"]["sliceId"] == "BASE-TFR-PAY-005", "next slice drift")
require(receipt["remainingFixedOrder"] == ["BASE-TFR-PAY-005", "BASE-TFR-PER-009", "BASE-TFR-SYS-010", "BASE-TFR-TIM-005"], "remaining order drift")
require(receipt["authority"]["hrm013SequenceClosed"] is True, "sequence not closed")
for key in ("hrm013FullBusinessSliceComplete", "pay005SourceAuthoringAuthorizedByThisReceipt", "pay005MigrationAuthoringAuthorizedByThisReceipt", "laterLaneWorkMayBeginBeforePay005Exit", "reorderingAuthorized", "directDwpDevSourceMergeAuthorized", "activationAuthorized", "tenantEnrollmentAuthorized", "productionBindingAuthorized", "productionReleaseAuthorized"):
    require(receipt["authority"][key] is False, f"unsafe authority {key}")

for pin in receipt["predecessorPins"].values():
    path = (HERE / pin["path"]).resolve()
    actual_sha, actual_bytes = digest(path)
    require((actual_sha, actual_bytes) == (pin["sha256"], pin["bytes"]), f"pin drift: {path}")

receipt_sha, receipt_bytes = digest(RECEIPT)
validator_sha, validator_bytes = digest(Path(__file__).resolve())
require(review["receiptPin"] == {"sha256": receipt_sha, "bytes": receipt_bytes}, "review receipt pin drift")
require(review["validatorPin"] == {"sha256": validator_sha, "bytes": validator_bytes}, "review validator pin drift")
require(review["decision"] == "GO_TO_PAY005_AUTHORITY_PREPARATION_ONLY", "review decision drift")
require(review["newSeverityCounts"] == {"P0": 0, "P1": 0, "P2": 0}, "unexpected new finding")
require(review["inheritedActivationOnlySeverityCounts"] == {"P0": 0, "P1": 0, "P2": 3}, "activation finding drift")

frontend = ROOT
backend = ROOT.parent / "dwp-backend"
agent = ROOT.parent / "dwp_agent"
for name, repo, pin in (
    ("frontend", frontend, receipt["repositoryPins"]["frontendAuthorityCarrierBase"]),
    ("backend", backend, receipt["repositoryPins"]["backendCurrentDescendant"]),
    ("agent", agent, receipt["repositoryPins"]["agentReadOnly"]),
):
    require(git(repo, "cat-file", "-t", pin["commit"]) == "commit", f"missing {name} commit")
    require(git(repo, "rev-parse", f'{pin["commit"]}^{{tree}}') == pin["tree"], f"{name} tree drift")

subprocess.check_call(["git", "-C", str(backend), "merge-base", "--is-ancestor", receipt["repositoryPins"]["backendCurrentDescendant"]["containsHrm013MatrixCommit"], receipt["repositoryPins"]["backendCurrentDescendant"]["commit"]])
print("PASS: HRM-013 sequencing exit is sealed; PAY-005 authority preparation is next; no matrix rerun performed.")
