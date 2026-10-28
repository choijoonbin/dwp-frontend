#!/usr/bin/env python3
import hashlib
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
FRONTEND = HERE.parents[4]
BACKEND = FRONTEND.parent / "dwp-backend"
AUTHORITY = HERE / "central-integration-authority.v1.json"
REVIEW = HERE / "independent-review.v1.json"


def require(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def git(repo: Path, *args: str, binary: bool = False):
    return subprocess.check_output(["git", "-C", str(repo), *args], text=not binary).strip()


def digest_bytes(data: bytes) -> tuple[str, int]:
    return hashlib.sha256(data).hexdigest(), len(data)


def digest(path: Path) -> tuple[str, int]:
    return digest_bytes(path.read_bytes())


a = json.loads(AUTHORITY.read_text())
r = json.loads(REVIEW.read_text())
require(a["state"] == "ACTIVE_EXACT_MODULE_COMMITS_TO_DWP_DEV_DEFAULT_OFF_SOURCE_ONLY", "state drift")
require(a["reviewSummary"]["acceptanceCriteriaPassed"] == 12, "acceptance drift")
require(a["reviewSummary"]["finalFindings"] == {"P0": 0, "P1": 0, "P2": 0}, "findings remain")
require(a["postIntegrationState"]["routeOrMenuDelta"] is False, "route/menu delta")
require(a["postIntegrationState"]["tenantEnrollmentCount"] == 0, "tenant enrollment")

for key, repo in (("frontend", FRONTEND), ("backend", BACKEND)):
    pin = a["exactModuleCommits"][key]
    commit_key = "finalEvidenceCommit" if key == "frontend" else "finalCommit"
    commit = pin[commit_key]
    require(git(repo, "rev-parse", f"{commit}^{{tree}}") == pin["finalTree"], f"{key} tree drift")
    require(git(repo, "rev-parse", pin["remoteRef"]) == commit, f"{key} remote drift")

evidence_commit = a["resultEvidencePins"]["carrierCommit"]
for pin in (a["resultEvidencePins"]["evidence"], a["resultEvidencePins"]["independentReview"], a["resultEvidencePins"]["validator"]):
    data = subprocess.check_output(["git", "-C", str(FRONTEND), "show", f'{evidence_commit}:{pin["path"]}'])
    require(digest_bytes(data) == (pin["sha256"], pin["bytes"]), f"evidence pin drift: {pin['path']}")

backend = a["exactModuleCommits"]["backend"]
subprocess.check_call(["git", "-C", str(BACKEND), "merge-base", "--is-ancestor", backend["baseCommit"], backend["finalCommit"]])
authority_sha, authority_bytes = digest(AUTHORITY)
validator_sha, validator_bytes = digest(Path(__file__).resolve())
require(r["authorityPin"] == {"sha256": authority_sha, "bytes": authority_bytes}, "review authority pin drift")
require(r["validatorPin"] == {"sha256": validator_sha, "bytes": validator_bytes}, "review validator pin drift")
require(r["decision"] == "GO_TO_EXACT_DWP_DEV_INTEGRATION", "review decision drift")
require(r["severityCounts"] == {"P0": 0, "P1": 0, "P2": 0}, "review finding drift")
print("PASS: exact PAY-005 module commits and evidence are authorized for default-OFF dwp-dev integration only.")
