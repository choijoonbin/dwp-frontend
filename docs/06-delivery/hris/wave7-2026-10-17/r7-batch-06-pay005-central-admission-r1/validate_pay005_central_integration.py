#!/usr/bin/env python3
import hashlib
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
FRONTEND = HERE.parents[4]
BACKEND = FRONTEND.parent / "dwp-backend"
AGENT = FRONTEND.parent / "dwp_agent"
RECEIPT = HERE / "central-integration-receipt.v1.json"
REVIEW = HERE / "independent-review.v1.json"


def require(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def git(repo: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(repo), *args], text=True).strip()


def digest(path: Path) -> tuple[str, int]:
    data = path.read_bytes()
    return hashlib.sha256(data).hexdigest(), len(data)


receipt = json.loads(RECEIPT.read_text())
review = json.loads(REVIEW.read_text())
require(receipt["state"] == "EXACT_PAY005_SOURCE_AND_EVIDENCE_MERGED_PUSHED_DEFAULT_OFF_SEQUENCE_CLOSED_PER009_NEXT", "state drift")
for key, repo in (("frontend", FRONTEND), ("backend", BACKEND), ("agent", AGENT)):
    pin = receipt["integrationPins"][key]
    require(git(repo, "rev-parse", f'{pin["commit"]}^{{tree}}') == pin["tree"], f"{key} tree drift")
    require(git(repo, "rev-parse", "origin/dwp-dev") == pin["commit"], f"{key} origin drift")
    if key != "agent":
        require(git(repo, "rev-parse", f'{pin["commit"]}^1') == pin["firstParent"], f"{key} first parent drift")
        require(git(repo, "rev-parse", f'{pin["commit"]}^2') == pin["secondParent"], f"{key} second parent drift")

for pin in receipt["evidencePins"].values():
    path = (HERE / pin["path"]).resolve()
    require(digest(path) == (pin["sha256"], pin["bytes"]), f"evidence drift: {path}")

require(receipt["resultSummary"]["acceptanceCriteriaPassed"] == 12, "acceptance drift")
require(receipt["resultSummary"]["finalFindings"] == {"P0": 0, "P1": 0, "P2": 0}, "finding drift")
require(receipt["sequenceDisposition"]["nextSlice"] == "BASE-TFR-PER-009", "next slice drift")
require(receipt["sequenceDisposition"]["businessCompletionCredit"] == 0, "business credit drift")
for key in ("routeOrMenuMountAuthorized", "featureEnablementAuthorized", "tenantEnrollmentAuthorized", "officialLegalRateOrProviderBindingAuthorized", "productionReleaseAuthorized", "pay005BusinessComplete", "batch06Complete", "hrisComplete"):
    require(receipt["authority"][key] is False, f"unsafe authority {key}")

receipt_sha, receipt_bytes = digest(RECEIPT)
validator_sha, validator_bytes = digest(Path(__file__).resolve())
require(review["receiptPin"] == {"sha256": receipt_sha, "bytes": receipt_bytes}, "review receipt pin drift")
require(review["validatorPin"] == {"sha256": validator_sha, "bytes": validator_bytes}, "review validator pin drift")
require(review["decision"] == "GO_TO_SEAL_PAY005_DEFAULT_OFF_SOURCE_INTEGRATION_AND_PER009_SEMANTIC_CLOSURE", "review decision drift")
require(review["severityCounts"] == {"P0": 0, "P1": 0, "P2": 0}, "review findings")
print("PASS: PAY-005 exact dwp-dev integration is sealed default-OFF; sequence advances only to PER-009 semantic closure.")
